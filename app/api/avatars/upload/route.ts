import { getAvatarName, getAvatarRequestClient, presentAvatar, type AvatarRecord } from "@/lib/avatars/server";

export async function POST(request: Request) {
  const { client, user, error } = await getAvatarRequestClient(request);
  if (error || !client || !user) return Response.json({ error }, { status: 401 });

  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !["image/png", "image/jpeg", "image/webp"].includes(image.type)) return Response.json({ error: "Choose a PNG, JPEG, or WebP image to upload." }, { status: 400 });
  if (image.size > 10 * 1024 * 1024) return Response.json({ error: "Choose an image smaller than 10 MB." }, { status: 413 });

  const avatarId = crypto.randomUUID();
  const key = `${user.id}/${avatarId}/source-${crypto.randomUUID()}.${extensionFor(image.type)}`;
  const { data: uploaded, error: uploadError } = await client.storage.from("avatars").upload(key, image);
  if (uploadError || !uploaded) return Response.json({ error: uploadError?.message ?? "The image could not be uploaded." }, { status: 502 });

  const { data, error: insertError } = await client.database.from("avatars").insert([{
    id: avatarId, user_id: user.id, name: getAvatarName(image.name), source: "upload", status: "ready",
    source_image_url: uploaded.url, source_image_key: uploaded.key,
  }]).select("*").single();
  if (insertError || !data) {
    await client.storage.from("avatars").remove(uploaded.key);
    return Response.json({ error: insertError?.message ?? "The avatar could not be saved." }, { status: 502 });
  }
  try {
    return Response.json({ avatar: await presentAvatar(client, data as AvatarRecord) }, { status: 201 });
  } catch (reason) {
    await client.database.from("avatars").delete().eq("id", avatarId).eq("user_id", user.id);
    await client.storage.from("avatars").remove(uploaded.key);
    const message = reason instanceof Error ? reason.message : "Could not create a secure preview URL for the uploaded avatar.";
    return Response.json({ error: message }, { status: 502 });
  }
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}
