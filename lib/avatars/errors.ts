export type AvatarErrorDetails = {
  message: string;
  code: string | null;
  status: number | null;
  name: string;
};

export type AvatarErrorDiagnostic = {
  service: "application" | "insforge" | "trigger.dev" | "cloudflare";
  phase: string;
  status: number | null;
  code: string | null;
  message: string;
};

export class AvatarServiceError extends Error {
  readonly service: AvatarErrorDiagnostic["service"];
  readonly phase: string;
  readonly status: number | null;
  readonly code: string | null;

  constructor(diagnostic: AvatarErrorDiagnostic) {
    super(diagnostic.message);
    this.name = "AvatarServiceError";
    this.service = diagnostic.service;
    this.phase = diagnostic.phase;
    this.status = diagnostic.status;
    this.code = diagnostic.code;
  }
}

export function avatarServiceError(
  service: AvatarErrorDiagnostic["service"],
  phase: string,
  reason: unknown,
  fallback: string,
  sensitiveValues: string[] = [],
) {
  return new AvatarServiceError(avatarErrorDiagnostic(service, phase, reason, fallback, sensitiveValues));
}

export function avatarErrorDetails(reason: unknown, fallback: string): AvatarErrorDetails {
  const outer = asRecord(reason);
  const inner = asRecord(outer?.error);
  const response = asRecord(outer?.response);
  const innerResponse = asRecord(inner?.response);
  const rawMessage = typeof outer?.message === "string"
    ? outer.message
    : typeof inner?.message === "string"
      ? inner.message
      : reason instanceof Error
        ? reason.message
        : fallback;

  return {
    message: sanitizeAvatarErrorMessage(rawMessage, fallback),
    code: safeIdentifier(outer?.code) ?? safeIdentifier(outer?.codeName) ?? safeIdentifier(inner?.code) ?? safeIdentifier(inner?.codeName),
    status: safeStatus(outer?.status) ?? safeStatus(outer?.statusCode) ?? safeStatus(response?.status)
      ?? safeStatus(inner?.status) ?? safeStatus(inner?.statusCode) ?? safeStatus(innerResponse?.status),
    name: safeIdentifier(outer?.name) ?? (reason instanceof Error ? reason.name : "Error"),
  };
}

export function avatarErrorDiagnostic(
  service: AvatarErrorDiagnostic["service"],
  phase: string,
  reason: unknown,
  fallback: string,
  sensitiveValues: string[] = [],
): AvatarErrorDiagnostic {
  const details = avatarErrorDetails(reason, fallback);
  return {
    service,
    phase: sanitizeIdentifier(phase),
    status: details.status,
    code: details.code,
    message: sanitizeAvatarErrorMessage(details.message, fallback, sensitiveValues),
  };
}

export function formatAvatarErrorDiagnostic(diagnostic: AvatarErrorDiagnostic) {
  const context = [
    diagnostic.service,
    diagnostic.phase,
    diagnostic.status ? `HTTP ${diagnostic.status}` : null,
    diagnostic.code ? `code ${diagnostic.code}` : null,
  ].filter(Boolean).join(" · ");
  return context ? `${diagnostic.message} (${context})` : diagnostic.message;
}

export function sanitizeAvatarErrorMessage(message: string, fallback: string, sensitiveValues: string[] = []) {
  let sanitized = message
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\b(?:AIza[\w-]{20,}|ik_[\w-]{16,}|tr_(?:dev|prod|stg)_[\w-]+)\b/gi, "[redacted credential]")
    .replace(/\beyJ[a-z0-9_-]{20,}\.[a-z0-9_-]{10,}(?:\.[a-z0-9_-]{10,})?\b/gi, "[redacted token]")
    .replace(/((?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:key|token|access_token|refresh_token)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL redacted]")
    .replace(/(\bprompt\s*[:=]\s*)[^\r\n,;}]+/gi, "$1[redacted]")
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, "[image data redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 500);

  for (const value of sensitiveValues) {
    const secret = value.trim();
    if (secret.length >= 3) sanitized = sanitized.replaceAll(secret, "[redacted input]");
  }

  return sanitized || fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function safeIdentifier(value: unknown) {
  return typeof value === "string" && /^[a-z0-9_.-]{1,100}$/i.test(value) ? value : null;
}

function sanitizeIdentifier(value: string) {
  return /^[a-z0-9_.-]{1,80}$/i.test(value) ? value : "unknown";
}

function safeStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}
