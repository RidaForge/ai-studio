import { createServerClient } from "@insforge/sdk/ssr";

export async function getAvatarRequestClient(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!accessToken) return { client: null, user: null, error: "Sign in to manage avatars." };

  const client = createServerClient({
    accessToken,
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  });
  const { data, error } = await client.auth.getCurrentUser();
  if (error || !data?.user) return { client: null, user: null, error: "Your session is invalid or expired." };
  return { client, user: data.user, error: null };
}

export async function signedAvatarUrl(client: NonNullable<Awaited<ReturnType<typeof getAvatarRequestClient>>["client"]>, key: string | null) {
  if (!key) return null;
  const { data, error } = await client.storage.from("avatars").createSignedUrl(key, 60 * 60 * 12);
  if (error || !data?.signedUrl) {
    throw new Error(`Could not create a secure preview URL for an avatar image: ${error?.message ?? "No signed URL was returned."}`);
  }
  return data.signedUrl;
}

export type AvatarRecord = {
  id: string;
  user_id: string;
  name: string;
  source: "default" | "upload" | "ai";
  style: string | null;
  prompt: string | null;
  source_image_url: string | null;
  source_image_key: string | null;
  image_16_9_url: string | null;
  image_16_9_key: string | null;
  image_9_16_url: string | null;
  image_9_16_key: string | null;
  trigger_run_id: string | null;
  generation_attempt: number;
  status: "ready" | "queued" | "generating" | "completed" | "failed";
  error_message: string | null;
  error_service: "application" | "insforge" | "trigger.dev" | "cloudflare" | null;
  error_phase: string | null;
  error_status: number | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export async function presentAvatar(client: NonNullable<Awaited<ReturnType<typeof getAvatarRequestClient>>["client"]>, avatar: AvatarRecord) {
  const [sourceImageUrl, image_16_9_url, image_9_16_url] = await Promise.all([
    signedAvatarUrl(client, avatar.source_image_key),
    signedAvatarUrl(client, avatar.image_16_9_key),
    signedAvatarUrl(client, avatar.image_9_16_key),
  ]);
  return { ...avatar, source_image_url: sourceImageUrl, image_16_9_url, image_9_16_url };
}

export function getAvatarName(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "My avatar";
}
