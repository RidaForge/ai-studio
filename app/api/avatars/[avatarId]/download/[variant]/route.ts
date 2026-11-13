import { getAvatarRequestClient } from "@/lib/avatars/server";

const imageTypes = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export async function GET(request: Request, context: { params: Promise<{ avatarId: string; variant: string }> }) {
  const { client, user, error } = await getAvatarRequestClient(request);
  if (error || !client || !user) return Response.json({ error: error ?? "Sign in to download avatars." }, { status: 401 });

  const { avatarId, variant } = await context.params;
  if (variant !== "landscape" && variant !== "portrait") return Response.json({ error: "Choose a valid avatar format." }, { status: 400 });

  const { data: avatar, error: queryError } = await client.database.from("avatars")
    .select("id,source,status,image_16_9_key,image_9_16_key")
    .eq("id", avatarId).eq("user_id", user.id).maybeSingle();
  if (queryError) return Response.json({ error: "Could not check this avatar's access." }, { status: 502 });
  if (!avatar) return Response.json({ error: "Avatar not found." }, { status: 404 });
  if (avatar.source !== "ai" || avatar.status !== "completed") return Response.json({ error: "This generated avatar is not ready to download." }, { status: 409 });

  const key = variant === "landscape" ? avatar.image_16_9_key : avatar.image_9_16_key;
  if (!key) return Response.json({ error: "This avatar image is unavailable." }, { status: 404 });

  const { data: image, error: downloadError } = await client.storage.from("avatars").download(key);
  if (downloadError || !image) return Response.json({ error: "We couldn’t prepare this download. Please try again." }, { status: 502 });

  const contentType = imageTypes[image.type as keyof typeof imageTypes];
  if (!contentType) return Response.json({ error: "This avatar image has an unsupported format." }, { status: 502 });
  const filename = `ai-avatar-${variant}.${contentType}`;
  return new Response(image.stream(), {
    headers: {
      "Content-Type": image.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(image.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
