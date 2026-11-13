import { getAvatarRequestClient, presentAvatar, type AvatarRecord } from "@/lib/avatars/server";

export async function GET(request: Request) {
  const { client, user, error } = await getAvatarRequestClient(request);
  if (error || !client || !user) return Response.json({ error }, { status: 401 });
  const { data, error: queryError } = await client.database.from("avatars")
    .select("id,user_id,name,source,style,prompt,source_image_url,source_image_key,image_16_9_url,image_16_9_key,image_9_16_url,image_9_16_key,trigger_run_id,generation_attempt,status,error_message,error_service,error_phase,error_status,error_code,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (queryError) return Response.json({ error: queryError.message }, { status: 502 });
  try {
    const avatars = await Promise.all((data ?? []).map((avatar) => presentAvatar(client, avatar as AvatarRecord)));
    return Response.json({ avatars });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Could not create secure avatar preview URLs.";
    return Response.json({ error: message }, { status: 502 });
  }
}
