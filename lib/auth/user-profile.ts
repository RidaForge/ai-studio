import type { UserSchema } from "@insforge/sdk";
import type { createServerClient } from "@insforge/sdk/ssr";

type InsForgeServerClient = ReturnType<typeof createServerClient>;
type UserProfileAuthData = Pick<UserSchema, "id" | "email" | "profile" | "providers" | "emailVerified" | "createdAt" | "metadata">;

const safeMetadataKeys = new Set([
  "locale",
  "preferred_username",
  "username",
  "full_name",
  "given_name",
  "family_name",
]);

function safeAuthMetadata(metadata: UserSchema["metadata"]) {
  if (!metadata) return {};

  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      safeMetadataKeys.has(key)
      && typeof value === "string"
      && value.length <= 500,
    ),
  ) as Record<string, string>;
}

export async function syncUserProfile(
  client: InsForgeServerClient,
  user: UserProfileAuthData,
  preferredName?: string,
) {
  if (!user.email) return new Error("Your account does not have an email address to save.");

  const { data: existing, error: readError } = await client.database
    .from("users")
    .select("id, name, providers, metadata")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) return readError;

  const name = user.profile?.name?.trim()
    || preferredName?.trim()
    || existing?.name
    || user.email.split("@")[0];
  const providerMetadata = safeAuthMetadata(user.metadata);
  const metadata = Object.keys(providerMetadata).length > 0
    ? providerMetadata
    : existing?.metadata ?? {};
  const providers = Array.isArray(user.providers)
    ? user.providers
    : existing?.providers ?? [];
  const avatarUrl = user.profile?.avatar_url?.trim()
    || (typeof user.metadata?.avatar_url === "string" ? user.metadata.avatar_url : null)
    || (typeof user.metadata?.picture === "string" ? user.metadata.picture : null)
    || null;
  const now = new Date().toISOString();

  const profile = {
    id: user.id,
    email: user.email,
    name,
    avatar_url: avatarUrl,
    providers,
    email_verified: user.emailVerified,
    auth_created_at: user.createdAt,
    last_sign_in_at: now,
    // This checkpoint is written on successful auth events, not on page renders.
    last_seen_at: now,
    metadata,
  };

  const { error } = await client.database
    .from("users")
    .upsert([profile], { onConflict: "id" })
    .select("id")
    .single();

  return error;
}
