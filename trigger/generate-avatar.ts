import { createAdminClient } from "@insforge/sdk";
import sharp from "sharp";
import { AbortTaskRunError, metadata, task } from "@trigger.dev/sdk";
import { AvatarServiceError, avatarErrorDiagnostic, avatarServiceError, formatAvatarErrorDiagnostic } from "@/lib/avatars/errors";
import { decodeCloudflareImage, inspectCloudflareResponse, validateCloudflareImage } from "@/lib/avatars/cloudflare-response";

type AvatarPayload = {
  avatarId: string;
  userId: string;
  sourceImageUrl: string;
  sourceImageKey: string;
  generationAttempt: number;
  style: "Podcast" | "Casual" | "3D Cartoon" | "Stylized";
  prompt: string;
};

type GeneratedImage = { data: Buffer; mimeType: string };

export const generateAvatar = task({
  id: "generate-ai-avatar",
  maxDuration: 900,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10000, randomize: true },
  run: async (payload: AvatarPayload, { ctx }) => {
    let admin: ReturnType<typeof createAdminClient> | null = null;
    let image16Key: string | null = null;
    let image916Key: string | null = null;
    let currentService: "insforge" | "cloudflare" = "insforge";
    let currentPhase = "client_configuration";

    try {
      metadata.set("stage", "queued").set("status", "queued").set("progress", 4);
      admin = createAdminClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
        apiKey: requiredEnv("INSFORGE_API_KEY"),
      });
      await setStage(admin, payload, "preparing", 10);

      currentService = "insforge";
      currentPhase = "source_download";
      const { data: source, error: sourceError } = await admin.storage.from("avatars").download(payload.sourceImageKey);
      if (sourceError || !source) throw avatarServiceError("insforge", currentPhase, sourceError, "Could not read the uploaded reference image.", [payload.sourceImageKey, payload.sourceImageUrl, payload.prompt]);
      const sourceBuffer = Buffer.from(await source.arrayBuffer());
      if (sourceBuffer.length === 0) throw new Error("The uploaded reference image is empty.");
      let referenceImage: Buffer;
      try {
        referenceImage = await sharp(sourceBuffer, { failOn: "error" })
          .rotate()
          .resize({ width: 511, height: 511, fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
      } catch {
        throw avatarServiceError("application", "reference_image_resize", null, "The uploaded reference image could not be processed.");
      }
      const referenceMetadata = await sharp(referenceImage).metadata();
      if (!referenceMetadata.width || !referenceMetadata.height || referenceMetadata.width >= 512 || referenceMetadata.height >= 512) {
        throw avatarServiceError("application", "reference_image_resize", null, "The uploaded reference image could not be resized for generation.");
      }
      const description = buildImageEditInstruction(payload.style, payload.prompt);

      await setStage(admin, payload, "generating_16_9", 24);
      currentService = "cloudflare";
      currentPhase = "generate_16_9";
      const landscape = await generateImage(description, referenceImage, sourceBuffer, "landscape", 1024, 576, [payload.prompt]);
      await setStage(admin, payload, "generating_9_16", 55);
      currentService = "cloudflare";
      currentPhase = "generate_9_16";
      const portrait = await generateImage(description, referenceImage, sourceBuffer, "portrait", 576, 1024, [payload.prompt]);

      await setStage(admin, payload, "saving", 83);
      currentService = "insforge";
      currentPhase = "generated_storage_upload";
      const attemptFolder = `attempt-${payload.generationAttempt}`;
      image16Key = `${payload.userId}/${payload.avatarId}/${attemptFolder}/avatar-16-9.${extensionFromMime(landscape.mimeType)}`;
      image916Key = `${payload.userId}/${payload.avatarId}/${attemptFolder}/avatar-9-16.${extensionFromMime(portrait.mimeType)}`;
      const [upload16, upload916] = await Promise.all([
        admin.storage.from("avatars").upload(image16Key, new Blob([Uint8Array.from(landscape.data)], { type: landscape.mimeType })),
        admin.storage.from("avatars").upload(image916Key, new Blob([Uint8Array.from(portrait.data)], { type: portrait.mimeType })),
      ]);
      if (upload16.error || !upload16.data) throw avatarServiceError("insforge", currentPhase, upload16.error, "Could not save the 16:9 avatar image.", [payload.sourceImageKey, payload.sourceImageUrl, payload.prompt]);
      if (upload916.error || !upload916.data) throw avatarServiceError("insforge", currentPhase, upload916.error, "Could not save the 9:16 avatar image.", [payload.sourceImageKey, payload.sourceImageUrl, payload.prompt]);

      currentPhase = "generated_preview_signing";
      const [signed16, signed916] = await Promise.all([
        admin.storage.from("avatars").createSignedUrl(upload16.data.key, 60 * 60 * 12),
        admin.storage.from("avatars").createSignedUrl(upload916.data.key, 60 * 60 * 12),
      ]);
      const image16Url = signed16.data?.signedUrl;
      const image916Url = signed916.data?.signedUrl;
      if (signed16.error || !image16Url) throw avatarServiceError("insforge", currentPhase, signed16.error, "Could not create a secure 16:9 preview URL.", [payload.sourceImageKey, payload.sourceImageUrl, payload.prompt]);
      if (signed916.error || !image916Url) throw avatarServiceError("insforge", currentPhase, signed916.error, "Could not create a secure 9:16 preview URL.", [payload.sourceImageKey, payload.sourceImageUrl, payload.prompt]);

      currentPhase = "avatar_update";
      const { error: updateError, data: updated } = await admin.database.from("avatars").update({
        image_16_9_url: upload16.data.url,
        image_16_9_key: upload16.data.key,
        image_9_16_url: upload916.data.url,
        image_9_16_key: upload916.data.key,
        status: "completed",
        error_message: null,
        error_service: null,
        error_phase: null,
        error_status: null,
        error_code: null,
      }).eq("id", payload.avatarId).eq("user_id", payload.userId)
        .eq("generation_attempt", payload.generationAttempt).select("id").maybeSingle();
      if (updateError) throw avatarServiceError("insforge", currentPhase, updateError, "Could not save generated avatar details.", [payload.sourceImageKey, payload.sourceImageUrl, payload.prompt]);
      if (!updated) throw new AbortTaskRunError("This avatar generation was superseded by a newer attempt.");

      metadata.set("stage", "completed").set("status", "completed").set("progress", 100);
      return { avatarId: payload.avatarId, generationAttempt: payload.generationAttempt, image16Url, image916Url };
    } catch (reason) {
      const diagnostic = reason instanceof AvatarServiceError
        ? {
            service: reason.service,
            phase: reason.phase,
            status: reason.status,
            code: reason.code,
            message: reason.message,
          }
        : avatarErrorDiagnostic(currentService, currentPhase, reason, "Avatar generation failed. Please try again.", [payload.sourceImageKey, payload.sourceImageUrl, payload.prompt]);
      const isSuperseded = reason instanceof AbortTaskRunError;
      const isContentSafetyRejection = diagnostic.service === "cloudflare"
        && diagnostic.code?.startsWith("content_safety_rejected") === true;
      const isFinalAttempt = ctx.attempt.number >= (ctx.run.maxAttempts ?? 2);
      const shouldMarkFailed = !isSuperseded && (isFinalAttempt || isContentSafetyRejection);
      const stage = isSuperseded ? "superseded" : shouldMarkFailed ? "failed" : "retrying";
      metadata.set("stage", stage).set("status", shouldMarkFailed ? "failed" : "generating")
        .set("progress", 0).set("error", diagnostic.message)
        .set("errorService", diagnostic.service).set("errorPhase", diagnostic.phase)
        .set("errorStatus", diagnostic.status).set("errorCode", diagnostic.code);

      console.error("Avatar generation attempt failed", {
        errorPhase: diagnostic.phase,
        errorCode: diagnostic.code,
        errorStatus: diagnostic.status,
      });

      if (admin && !isSuperseded) {
        if (image16Key) await admin.storage.from("avatars").remove(image16Key).catch(() => undefined);
        if (image916Key) await admin.storage.from("avatars").remove(image916Key).catch(() => undefined);
        await admin.database.from("avatars").update({
          status: shouldMarkFailed ? "failed" : "generating",
          error_message: diagnostic.message,
          error_service: diagnostic.service,
          error_phase: diagnostic.phase,
          error_status: diagnostic.status,
          error_code: diagnostic.code,
        }).eq("id", payload.avatarId).eq("user_id", payload.userId)
          .eq("generation_attempt", payload.generationAttempt);
      }

      if (isSuperseded) throw reason;
      if (isContentSafetyRejection) throw new AbortTaskRunError(formatAvatarErrorDiagnostic(diagnostic));
      throw new Error(formatAvatarErrorDiagnostic(diagnostic));
    }
  },
});

async function generateImage(
  prompt: string,
  referenceImage: Buffer,
  sourceBuffer: Buffer,
  aspect: "landscape" | "portrait",
  width: number,
  height: number,
  sensitiveValues: string[] = [],
): Promise<GeneratedImage> {
  const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = requiredEnv("CLOUDFLARE_API_TOKEN");
  const form = new FormData();
  form.set("prompt", `${prompt}\n\nCompose the image in ${aspect} orientation.`);
  form.set("input_image_0", new Blob([Uint8Array.from(referenceImage)], { type: "image/png" }), "reference.png");
  form.set("width", String(width));
  form.set("height", String(height));
  let response: Response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(8 * 60 * 1000),
    });
  } catch {
    throw avatarServiceError("cloudflare", `generate_${aspect}`, null, "Cloudflare Workers AI could not be reached.");
  }
  let body: unknown;
  let jsonParsed = true;
  try { body = await response.json(); } catch { jsonParsed = false; }
  const inspection = inspectCloudflareResponse(response.status, body, jsonParsed, [
    ...sensitiveValues,
    prompt,
    accountId,
    token,
  ]);
  if (!inspection.ok) {
    throw new AvatarServiceError({ service: "cloudflare", phase: `generate_${aspect}`, status: inspection.status, code: inspection.code, message: inspection.message });
  }
  const decodedImage = decodeCloudflareImage(inspection.image);
  if (!decodedImage.ok) {
    throw new AvatarServiceError({ service: "cloudflare", phase: `generate_${aspect}`, status: response.status, code: decodedImage.code, message: decodedImage.message });
  }
  const generatedBuffer = decodedImage.data;
  const validation = await validateCloudflareImage(generatedBuffer, sourceBuffer);
  if (!validation.ok) {
    throw new AvatarServiceError({ service: "cloudflare", phase: `generate_${aspect}`, status: response.status, code: validation.code, message: validation.message });
  }
  return { data: generatedBuffer, mimeType: validation.mimeType };
}

function buildImageEditInstruction(style: AvatarPayload["style"], prompt: string) {
  const customization = prompt.trim() || "Create a polished on-camera avatar consistent with the selected style.";
  return [
    "EDIT the attached reference photo into a newly generated avatar image; do not return, copy, or merely re-encode the original photo.",
    "The attached image is the direct visual reference for the same real person. Preserve that person's recognizable identity, face shape, facial features, age, skin tone, and hair.",
    `Apply the ${style} visual style while keeping the person recognizable and photorealistic enough to match the reference.`,
    `Make this requested customization visibly true in the generated image: ${customization}`,
    "Change the outfit and other appearance details exactly as requested while keeping the face and identity consistent.",
    "Frame the person from the waist or mid-thigh upward so requested clothing is visible. Use flattering natural studio lighting, a clean background, and no text or watermark.",
  ].join(" ");
}

async function setStage(admin: ReturnType<typeof createAdminClient>, payload: AvatarPayload, stage: string, progress: number) {
  metadata.set("stage", stage).set("status", "generating").set("progress", progress);
  const { error, data } = await admin.database.from("avatars").update({
    status: "generating",
    error_message: null,
    error_service: null,
    error_phase: null,
    error_status: null,
    error_code: null,
  })
    .eq("id", payload.avatarId).eq("user_id", payload.userId)
    .eq("generation_attempt", payload.generationAttempt).select("id").maybeSingle();
  if (error) throw avatarServiceError("insforge", "status_update", error, "Could not update avatar generation status.");
  if (!data) throw new AbortTaskRunError("This avatar generation was superseded by a newer attempt.");
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured for avatar generation.`);
  return value;
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}
