import sharp from "sharp";

type CloudflareResponseFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

type CloudflareResponseSuccess = { ok: true; image: string };

export type CloudflareResponseInspection = CloudflareResponseFailure | CloudflareResponseSuccess;

export function inspectCloudflareResponse(
  status: number,
  body: unknown,
  jsonParsed = true,
  sensitiveValues: string[] = [],
): CloudflareResponseInspection {
  const record = asRecord(body);
  const errorCodes = getCloudflareErrorCodes(record?.errors);
  const errorMessages = getCloudflareErrorMessages(record?.errors, sensitiveValues);
  const outputRejected = hasOutputFlaggedError(record?.errors);
  const suffix = errorCodes.length ? `_cf_${errorCodes.join("_")}` : "";

  if (status < 200 || status >= 300) {
    if (outputRejected) {
      return failure(status, `content_safety_rejected${suffix}`, withCloudflareDetails("Cloudflare content safety rejected the generated output. Change the prompt or reference image and try again.", errorMessages));
    }
    if (status === 402 || errorCodes.includes("3036")) {
      return failure(status, `quota_exhausted${suffix}`, withCloudflareDetails("Cloudflare Workers AI quota is exhausted.", errorMessages));
    }
    if (errorCodes.includes("5035")) {
      return failure(status, `paid_plan_required${suffix}`, withCloudflareDetails("Cloudflare Workers AI requires a paid plan for this request.", errorMessages));
    }
    if (status === 429) {
      return failure(status, `rate_limited${suffix}`, withCloudflareDetails("Cloudflare Workers AI is rate limiting requests. Please retry shortly.", errorMessages));
    }
    if (status === 401 || status === 403) {
      return failure(status, `invalid_credentials${suffix}`, withCloudflareDetails("Cloudflare Workers AI credentials were rejected.", errorMessages));
    }
    return failure(status, `http_${status}${suffix}`, withCloudflareDetails("Cloudflare Workers AI could not generate this image.", errorMessages));
  }

  if (!jsonParsed) {
    return failure(status, "malformed_response_json", "Cloudflare Workers AI returned a malformed image response.");
  }
  if (!record || typeof record.success !== "boolean"
    || (record.errors !== undefined && !Array.isArray(record.errors))) {
    return failure(status, "malformed_response_structure", "Cloudflare Workers AI returned a malformed image response.");
  }
  if (record.success === false || errorCodes.length > 0) {
    if (outputRejected) {
      return failure(status, `content_safety_rejected${suffix}`, withCloudflareDetails("Cloudflare content safety rejected the generated output. Change the prompt or reference image and try again.", errorMessages));
    }
    if (errorCodes.includes("3036")) {
      return failure(status, `quota_exhausted${suffix}`, withCloudflareDetails("Cloudflare Workers AI quota is exhausted.", errorMessages));
    }
    if (errorCodes.includes("5035")) {
      return failure(status, `paid_plan_required${suffix}`, withCloudflareDetails("Cloudflare Workers AI requires a paid plan for this request.", errorMessages));
    }
    return failure(status, errorCodes.length ? `cloudflare_error${suffix}` : "cloudflare_request_failed", withCloudflareDetails("Cloudflare Workers AI could not generate this image.", errorMessages));
  }

  const result = asRecord(record.result);
  if (!result) {
    return failure(status, "malformed_response_structure", "Cloudflare Workers AI returned a malformed image response.");
  }
  if (result.image === undefined || result.image === null || result.image === "") {
    return failure(status, "missing_image_data", "Cloudflare Workers AI returned no image data.");
  }
  if (typeof result.image !== "string") {
    return failure(status, "malformed_response_structure", "Cloudflare Workers AI returned a malformed image response.");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.image)) {
    return failure(status, "invalid_base64_image", "Cloudflare Workers AI returned invalid Base64 image data.");
  }

  return { ok: true, image: result.image };
}

export function decodeCloudflareImage(image: string): { ok: true; data: Buffer } | { ok: false; code: string; message: string } {
  try {
    const data = Buffer.from(image, "base64");
    if (!data.length || data.toString("base64") !== image) {
      return { ok: false, code: "base64_decode_failed", message: "Cloudflare Workers AI image data could not be decoded." };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, code: "base64_decode_failed", message: "Cloudflare Workers AI image data could not be decoded." };
  }
}

export async function validateCloudflareImage(
  data: Buffer,
  sourceImage: Buffer,
): Promise<{ ok: true; mimeType: string } | { ok: false; code: string; message: string }> {
  if (!data.length || data.equals(sourceImage)) {
    return { ok: false, code: "image_validation_failed", message: "Cloudflare Workers AI returned invalid image data." };
  }

  let metadata;
  try {
    const image = sharp(data, { failOn: "error" });
    metadata = await image.metadata();
    await image.stats();
  } catch {
    return { ok: false, code: "image_validation_failed", message: "Cloudflare Workers AI returned invalid image data." };
  }
  const mimeType = metadata.format === "png" ? "image/png"
    : metadata.format === "jpeg" ? "image/jpeg"
      : metadata.format === "webp" ? "image/webp" : null;
  if (!mimeType) {
    return { ok: false, code: "unsupported_image_format", message: "Cloudflare Workers AI returned an unsupported image format." };
  }
  if (!metadata.width || !metadata.height) {
    return { ok: false, code: "image_validation_failed", message: "Cloudflare Workers AI returned invalid image data." };
  }
  return { ok: true, mimeType };
}

function getCloudflareErrorCodes(errors: unknown): string[] {
  if (!Array.isArray(errors)) return [];
  const codes: string[] = [];
  for (const error of errors) {
    const value = asRecord(error)?.code;
    const code = typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? String(value)
      : typeof value === "string" && /^\d{1,10}$/.test(value) ? value : null;
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function getCloudflareErrorMessages(errors: unknown, sensitiveValues: string[]): string[] {
  if (!Array.isArray(errors)) return [];
  return errors.flatMap((error) => {
    const message = asRecord(error)?.message;
    if (typeof message !== "string" || !message.trim()) return [];
    const sanitized = sanitizeCloudflareMessage(message, sensitiveValues);
    return sanitized ? [sanitized] : [];
  });
}

function hasOutputFlaggedError(errors: unknown) {
  return Array.isArray(errors) && errors.some((error) => {
    const message = asRecord(error)?.message;
    return typeof message === "string" && /\byour output has been flagged\b/i.test(message);
  });
}

function sanitizeCloudflareMessage(message: string, sensitiveValues: string[]) {
  let sanitized = message
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\b(?:AIza[\w-]{20,}|ik_[\w-]{16,}|tr_(?:dev|prod|stg)_[\w-]+)\b/gi, "[redacted credential]")
    .replace(/\beyJ[a-z0-9_-]{20,}\.[a-z0-9_-]{10,}(?:\.[a-z0-9_-]{10,})?\b/gi, "[redacted token]")
    .replace(/((?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:key|token|access_token|refresh_token)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL redacted]")
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, "[image data redacted]")
    .replace(/(?:[A-Za-z0-9+/]{4}){16,}(?:==|=)?/g, "[base64 data redacted]")
    .replace(/(\bprompt\s*[:=]\s*)[^\r\n,;}]+/gi, "$1[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 500);

  for (const value of sensitiveValues) {
    const secret = value.trim();
    if (secret.length >= 3) sanitized = sanitized.replaceAll(secret, "[redacted input]");
  }
  return sanitized;
}

function withCloudflareDetails(fallback: string, messages: string[]) {
  return messages.length ? `${fallback} Cloudflare error: ${messages.join(" | ")}` : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function failure(status: number, code: string, message: string): CloudflareResponseFailure {
  return { ok: false, status, code, message };
}

