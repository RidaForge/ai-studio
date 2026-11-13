import { auth, runs, tasks } from "@trigger.dev/sdk";
import type { generateAvatar } from "@/trigger/generate-avatar";
import { avatarErrorDetails, avatarErrorDiagnostic, sanitizeAvatarErrorMessage } from "@/lib/avatars/errors";
import { getAvatarName, getAvatarRequestClient, type AvatarRecord } from "@/lib/avatars/server";

export const maxDuration = 20;

const terminalFailureStatuses = new Set(["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"]);
type AvatarStyle = "Podcast" | "Casual" | "3D Cartoon" | "Stylized";

export async function POST(request: Request) {
  const { client, user, error } = await getAvatarRequestClient(request);
  if (error || !client || !user) return Response.json({ error, diagnostic: { service: "insforge", phase: "auth_validation", status: 401, code: null, message: error ?? "Authentication failed." } }, { status: 401 });
  if (!process.env.TRIGGER_SECRET_KEY) return apiError(503, "trigger.dev", "configuration", new Error("TRIGGER_SECRET_KEY is not configured."), "Trigger.dev is not configured on the server.");
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) return apiError(503, "cloudflare", "configuration", new Error("Cloudflare Workers AI is not configured."), "Cloudflare Workers AI generation is not configured on the server.");

  const form = await request.formData();
  const requestedAvatarId = String(form.get("avatarId") ?? "");
  const sourceAvatarId = String(form.get("sourceAvatarId") ?? "");
  const retry = form.get("retry") === "true";
  const image = form.get("image");
  const style = String(form.get("style") ?? "");
  const prompt = String(form.get("prompt") ?? "").trim().slice(0, 1200);
  const hasRequestedId = isUuid(requestedAvatarId);

  if (!hasRequestedId && !isUuid(sourceAvatarId)) {
    if (!(image instanceof File) || !isSupportedImage(image.type)) {
      return Response.json({ error: "Choose a PNG, JPEG, or WebP reference image before generating." }, { status: 400 });
    }
    if (image.size > 10 * 1024 * 1024) return Response.json({ error: "Choose an image smaller than 10 MB." }, { status: 413 });
    if (!isAvatarStyle(style)) return Response.json({ error: "Choose one of the available avatar styles." }, { status: 400 });
  }

  const avatarId = hasRequestedId ? requestedAvatarId : crypto.randomUUID();
  const existingResult = await client.database.from("avatars")
    .select("id,user_id,name,source,style,prompt,source_image_url,source_image_key,image_16_9_url,image_16_9_key,image_9_16_url,image_9_16_key,trigger_run_id,generation_attempt,status,error_message,error_service,error_phase,error_status,error_code,created_at,updated_at")
    .eq("id", avatarId).eq("user_id", user.id).maybeSingle();
  if (existingResult.error) return apiError(502, "insforge", "avatar_lookup", existingResult.error, "Could not check the previous generation attempt.");

  let avatar = existingResult.data as AvatarRecord | null;
  if (avatar && avatar.source !== "ai") return Response.json({ error: "This avatar is not an AI generation." }, { status: 409 });
  if (!avatar && isUuid(sourceAvatarId)) {
    if (sourceAvatarId === avatarId) return Response.json({ error: "Choose a different avatar for the new generation." }, { status: 400 });
    const sourceResult = await client.database.from("avatars")
    .select("id,user_id,name,source,style,prompt,source_image_url,source_image_key,generation_attempt,status,error_message,error_service,error_phase,error_status,error_code,created_at,updated_at")
      .eq("id", sourceAvatarId).eq("user_id", user.id).maybeSingle();
    if (sourceResult.error) return apiError(502, "insforge", "source_avatar_lookup", sourceResult.error, "Could not load the saved reference for this avatar.");
    const sourceAvatar = sourceResult.data as AvatarRecord | null;
    if (!sourceAvatar || sourceAvatar.source !== "ai" || !sourceAvatar.source_image_key || !sourceAvatar.source_image_url) {
      return Response.json({ error: "The saved reference image is unavailable for a new generation." }, { status: 404 });
    }
    if (!isAvatarStyle(sourceAvatar.style)) return Response.json({ error: "The saved avatar has no valid generation style." }, { status: 409 });
    const { data: created, error: insertError } = await client.database.from("avatars").insert([{
      id: avatarId,
      user_id: user.id,
      name: sourceAvatar.name,
      source: "ai",
      style: sourceAvatar.style,
      prompt: sourceAvatar.prompt,
      source_image_url: sourceAvatar.source_image_url,
      source_image_key: sourceAvatar.source_image_key,
      generation_attempt: 1,
      status: "queued",
    }]).select("id,user_id,name,source,style,prompt,source_image_url,source_image_key,image_16_9_url,image_16_9_key,image_9_16_url,image_9_16_key,trigger_run_id,generation_attempt,status,error_message,error_service,error_phase,error_status,error_code,created_at,updated_at").single();
    if (insertError || !created) return apiError(502, "insforge", "avatar_insert", insertError, "Could not create the new avatar record.", [sourceAvatar.prompt ?? "", sourceAvatar.source_image_key]);
    avatar = created as AvatarRecord;
  }

  if (!avatar) {
    if (!(image instanceof File) || !isSupportedImage(image.type)) {
      return Response.json({ error: "Choose a PNG, JPEG, or WebP reference image before generating." }, { status: 400 });
    }
    if (image.size > 10 * 1024 * 1024) return Response.json({ error: "Choose an image smaller than 10 MB." }, { status: 413 });
    if (!isAvatarStyle(style)) return Response.json({ error: "Choose one of the available avatar styles." }, { status: 400 });

    const sourceKey = `${user.id}/${avatarId}/source.${extensionFor(image.type)}`;
    const { data: uploaded, error: uploadError } = await client.storage.from("avatars").upload(sourceKey, image);
    if (uploadError || !uploaded) return apiError(502, "insforge", "source_upload", uploadError, "The reference image could not be uploaded.", [prompt, sourceKey]);
    const { data: created, error: insertError } = await client.database.from("avatars").insert([{
      id: avatarId,
      user_id: user.id,
      name: getAvatarName(image.name),
      source: "ai",
      style,
      prompt,
      source_image_url: uploaded.url,
      source_image_key: uploaded.key,
      generation_attempt: 1,
      status: "queued",
    }]).select("id,user_id,name,source,style,prompt,source_image_url,source_image_key,image_16_9_url,image_16_9_key,image_9_16_url,image_9_16_key,trigger_run_id,generation_attempt,status,error_message,error_service,error_phase,error_status,error_code,created_at,updated_at").single();
    if (insertError || !created) {
      await client.storage.from("avatars").remove(uploaded.key);
      return apiError(502, "insforge", "avatar_insert", insertError, "The avatar record could not be created.", [prompt, sourceKey]);
    }
    avatar = created as AvatarRecord;
  }

  if (!avatar.source_image_key || !avatar.source_image_url) {
    return Response.json({ avatarId, error: "The saved reference image is unavailable. Upload a new reference to continue." }, { status: 409 });
  }
  if (!isAvatarStyle(avatar.style)) return Response.json({ avatarId, error: "The saved avatar has no valid generation style." }, { status: 409 });
  const sourceImageUrl = avatar.source_image_url;
  const sourceImageKey = avatar.source_image_key;
  const savedStyle = avatar.style as AvatarStyle;

  if (avatar.trigger_run_id) {
    let run: Awaited<ReturnType<typeof runs.retrieve>>;
    try {
      run = await runs.retrieve(avatar.trigger_run_id);
    } catch (reason) {
      const diagnostic = avatarErrorDiagnostic("trigger.dev", "run_lookup", reason, "Could not check the existing Trigger.dev run.");
      console.error("Avatar run lookup failed", {
        avatarId: avatar.id,
        generationAttempt: avatar.generation_attempt,
        errorName: avatarErrorDetails(reason, "Run lookup failed.").name,
        errorCode: diagnostic.code,
        errorStatus: diagnostic.status,
        errorPhase: diagnostic.phase,
      });
      return Response.json({ avatarId: avatar.id, generationAttempt: avatar.generation_attempt, retryable: true, error: diagnostic.message, diagnostic }, { status: 503 });
    }

    if (terminalFailureStatuses.has(run.status)) {
      const message = safeMessage(avatar.error_message, `Avatar generation ended with status ${run.status.toLowerCase()}.`);
      const { data: reconciled } = await client.database.from("avatars").update({ status: "failed", error_message: message, error_service: "trigger.dev", error_phase: "task_execution" })
        .eq("id", avatar.id).eq("user_id", user.id).eq("generation_attempt", avatar.generation_attempt)
        .eq("trigger_run_id", avatar.trigger_run_id).select("*").maybeSingle();
      if (reconciled) avatar = reconciled as AvatarRecord;
    } else if (run.status === "COMPLETED" && (!avatar.image_16_9_key || !avatar.image_9_16_key)) {
      const message = "The generation run completed without saving both preview images.";
      const { data: reconciled } = await client.database.from("avatars").update({ status: "failed", error_message: message, error_service: "trigger.dev", error_phase: "task_execution" })
        .eq("id", avatar.id).eq("user_id", user.id).eq("generation_attempt", avatar.generation_attempt)
        .eq("trigger_run_id", avatar.trigger_run_id).select("*").maybeSingle();
      if (reconciled) avatar = reconciled as AvatarRecord;
    } else if (!retry || run.status !== "FAILED") {
      return createRunResponse(avatar.id, avatar.generation_attempt, avatar.trigger_run_id);
    }
  }

  if (retry && avatar.status === "failed") {
    const previousAttempt = avatar.generation_attempt;
    const { data: nextAttempt, error: retryError } = await client.database.from("avatars").update({
      generation_attempt: previousAttempt + 1,
      status: "queued",
      trigger_run_id: null,
      image_16_9_url: null,
      image_16_9_key: null,
      image_9_16_url: null,
      image_9_16_key: null,
      error_message: null,
      error_service: null,
      error_phase: null,
      error_status: null,
      error_code: null,
    }).eq("id", avatar.id).eq("user_id", user.id).eq("generation_attempt", previousAttempt)
      .eq("status", "failed").select("*").maybeSingle();
    if (retryError) return Response.json({ error: safeMessage(retryError.message, "Could not start a safe retry.") }, { status: 502 });
    if (nextAttempt) {
      avatar = nextAttempt as AvatarRecord;
    } else {
      const latest = await client.database.from("avatars")
        .select("id,user_id,name,source,style,prompt,source_image_url,source_image_key,image_16_9_url,image_16_9_key,image_9_16_url,image_9_16_key,trigger_run_id,generation_attempt,status,error_message,error_service,error_phase,error_status,error_code,created_at,updated_at")
        .eq("id", avatar.id).eq("user_id", user.id).single();
      if (latest.error || !latest.data) return Response.json({ error: "Could not reconnect to this avatar generation." }, { status: 409 });
      avatar = latest.data as AvatarRecord;
      if (avatar.status === "failed") return Response.json({ avatarId: avatar.id, error: "Another retry changed this avatar at the same time. Refresh and try again." }, { status: 409 });
      if (avatar.trigger_run_id) return createRunResponse(avatar.id, avatar.generation_attempt, avatar.trigger_run_id);
    }
  } else if (avatar.status === "failed") {
    const diagnostic = diagnosticFromAvatar(avatar, "This generation failed. Retry it to try again.");
    return Response.json({ avatarId: avatar.id, generationAttempt: avatar.generation_attempt, retryable: true, error: diagnostic.message, diagnostic }, { status: 409 });
  } else if (["completed", "ready"].includes(avatar.status)) {
    return Response.json({ avatarId: avatar.id, generationAttempt: avatar.generation_attempt, error: "This avatar is already complete. Start a new avatar to generate another version." }, { status: 409 });
  }

  const generationAttempt = avatar.generation_attempt;
  let handle: Awaited<ReturnType<typeof tasks.trigger<typeof generateAvatar>>>;
  try {
    handle = await tasks.trigger<typeof generateAvatar>("generate-ai-avatar", {
      avatarId: avatar.id,
      userId: user.id,
      sourceImageUrl,
      sourceImageKey,
      generationAttempt,
      style: savedStyle,
      prompt: avatar.prompt ?? "",
    }, {
      idempotencyKey: `avatar-generation-${avatar.id}-${generationAttempt}`,
      idempotencyKeyTTL: "7d",
      tags: [`user:${user.id}`, `avatar:${avatar.id}`, `attempt:${generationAttempt}`],
    });
  } catch (reason) {
    const diagnostic = avatarErrorDiagnostic("trigger.dev", "task_submission", reason, "Trigger.dev could not accept the avatar task.", [avatar.prompt ?? "", sourceImageKey, sourceImageUrl]);
    const ambiguous = isAmbiguousTriggerFailure(diagnostic.status);
    console.error("Avatar task submission failed", {
      avatarId: avatar.id,
      generationAttempt,
      errorName: avatarErrorDetails(reason, "Task submission failed.").name,
      errorCode: diagnostic.code,
      errorStatus: diagnostic.status,
      errorPhase: diagnostic.phase,
      outcome: ambiguous ? "unknown" : "rejected",
    });
    await client.database.from("avatars").update({
      status: ambiguous ? "queued" : "failed",
      error_message: diagnostic.message,
      error_service: diagnostic.service,
      error_phase: diagnostic.phase,
      error_status: diagnostic.status,
      error_code: diagnostic.code,
    }).eq("id", avatar.id).eq("user_id", user.id).eq("generation_attempt", generationAttempt);
    return Response.json({
      avatarId: avatar.id,
      generationAttempt,
      submissionStatus: ambiguous ? "unknown" : "rejected",
      retryable: true,
      error: diagnostic.message,
      diagnostic,
    }, { status: ambiguous ? 503 : 502 });
  }

  const { error: runLinkError } = await client.database.from("avatars").update({
    trigger_run_id: handle.id,
    error_message: null,
    error_service: null,
    error_phase: null,
    error_status: null,
    error_code: null,
  }).eq("id", avatar.id).eq("user_id", user.id).eq("generation_attempt", generationAttempt);

  return createRunResponse(avatar.id, generationAttempt, handle.id, runLinkError);
}

async function createRunResponse(avatarId: string, generationAttempt: number, runId: string, linkError?: unknown) {
  try {
    const publicAccessToken = await auth.createPublicToken({ scopes: { read: { runs: [runId] } } });
    return Response.json({ avatarId, generationAttempt, runId, publicAccessToken }, {
      status: 202,
      headers: linkError ? { "x-avatar-run-link": "pending-reconciliation" } : undefined,
    });
  } catch (reason) {
    const diagnostic = avatarErrorDiagnostic("trigger.dev", "realtime_authorization", reason, "Realtime access could not be created for this run.");
    console.error("Avatar run token creation failed", {
      avatarId,
      generationAttempt,
      errorName: avatarErrorDetails(reason, "Realtime access failed.").name,
      errorCode: diagnostic.code,
      errorStatus: diagnostic.status,
      errorPhase: diagnostic.phase,
    });
    return Response.json({ avatarId, generationAttempt, runId, publicAccessToken: null, realtimeUnavailable: true, diagnostic }, {
      status: 202,
      headers: { "x-avatar-realtime": "unavailable" },
    });
  }
}

function apiError(
  responseStatus: number,
  service: "application" | "insforge" | "trigger.dev" | "cloudflare",
  phase: string,
  reason: unknown,
  fallback: string,
  sensitiveValues: string[] = [],
) {
  const diagnostic = avatarErrorDiagnostic(service, phase, reason, fallback, sensitiveValues);
  return Response.json({ error: diagnostic.message, diagnostic }, { status: responseStatus });
}

function diagnosticFromAvatar(avatar: AvatarRecord, fallback: string) {
  const service = avatar.error_service ?? "application";
  return {
    service,
    phase: avatar.error_phase ?? "avatar_generation",
    status: avatar.error_status,
    code: avatar.error_code,
    message: safeMessage(avatar.error_message, fallback),
  };
}

function isAmbiguousTriggerFailure(status: number | null) {
  return status === null || status === 408 || status === 409 || status === 429 || status >= 500;
}

function safeMessage(message: string | null | undefined, fallback: string) {
  return sanitizeAvatarErrorMessage(message ?? fallback, fallback);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSupportedImage(type: string) {
  return ["image/png", "image/jpeg", "image/webp"].includes(type);
}

function isAvatarStyle(value: unknown): value is AvatarStyle {
  return typeof value === "string" && ["Podcast", "Casual", "3D Cartoon", "Stylized"].includes(value);
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}
