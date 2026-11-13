import { runs } from "@trigger.dev/sdk";
import { getAvatarRequestClient, presentAvatar, type AvatarRecord } from "@/lib/avatars/server";
import { getAvatarOutputKeysForCleanup } from "@/lib/avatars/storage-keys";

const terminalRunStatuses = new Set(["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"]);

export async function GET(request: Request, context: { params: Promise<{ avatarId: string }> }) {
  const { client, user, error } = await getAvatarRequestClient(request);
  if (error || !client || !user) return Response.json({ error }, { status: 401 });
  const { avatarId } = await context.params;
  const result = await client.database.from("avatars")
    .select("id,user_id,name,source,style,prompt,source_image_url,source_image_key,image_16_9_url,image_16_9_key,image_9_16_url,image_9_16_key,trigger_run_id,generation_attempt,status,error_message,error_service,error_phase,error_status,error_code,created_at,updated_at")
    .eq("id", avatarId).eq("user_id", user.id).maybeSingle();
  if (result.error) return Response.json({ error: "Could not check this avatar's status." }, { status: 502 });
  if (!result.data) return Response.json({ error: "Avatar not found." }, { status: 404 });

  let avatar = result.data as AvatarRecord;
  if (["queued", "generating"].includes(avatar.status) && avatar.trigger_run_id && process.env.TRIGGER_SECRET_KEY) {
    try {
      const run = await runs.retrieve(avatar.trigger_run_id);
      if (terminalRunStatuses.has(run.status)) {
        const message = run.status === "TIMED_OUT" ? "Avatar generation timed out. Please start a new generation." : `Avatar generation ended with status ${run.status.toLowerCase()}. Please start a new generation.`;
        const { data: updated } = await client.database.from("avatars")
          .update({ status: "failed", error_message: message, error_service: "trigger.dev", error_phase: "task_execution" })
          .eq("id", avatar.id).eq("user_id", user.id).eq("generation_attempt", avatar.generation_attempt)
          .eq("trigger_run_id", avatar.trigger_run_id).select("*").single();
        if (updated) avatar = updated as AvatarRecord;
      } else if (run.status === "COMPLETED" && (!avatar.image_16_9_key || !avatar.image_9_16_key)) {
        const message = "The generation run completed without saving both preview images.";
        const { data: updated } = await client.database.from("avatars")
          .update({ status: "failed", error_message: message, error_service: "trigger.dev", error_phase: "task_execution" })
          .eq("id", avatar.id).eq("user_id", user.id).eq("generation_attempt", avatar.generation_attempt)
          .eq("trigger_run_id", avatar.trigger_run_id).select("*").single();
        if (updated) avatar = updated as AvatarRecord;
      }
    } catch {
      // Trigger.dev may be temporarily unavailable; the authenticated DB state remains useful.
    }
  }

  try {
    return Response.json({ avatar: await presentAvatar(client, avatar) });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Could not create secure avatar preview URLs.";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ avatarId: string }> }) {
  const { client, user, error } = await getAvatarRequestClient(request);
  if (error || !client || !user) return Response.json({ error }, { status: 401 });

  const { avatarId } = await context.params;
  const { data: avatar, error: lookupError } = await client.database.from("avatars")
    .select("id,status,image_16_9_key,image_9_16_key")
    .eq("id", avatarId).eq("user_id", user.id).maybeSingle();
  if (lookupError) return Response.json({ error: "Could not check this avatar before deletion." }, { status: 502 });
  if (!avatar) return Response.json({ error: "Avatar not found." }, { status: 404 });
  if (avatar.status !== "failed") return Response.json({ error: "Only failed avatars can be deleted." }, { status: 409 });

  const { data: deleted, error: deleteError } = await client.database.from("avatars").delete()
    .eq("id", avatarId).eq("user_id", user.id).eq("status", "failed")
    .select("id").maybeSingle();
  if (deleteError) return Response.json({ error: "The failed avatar could not be deleted." }, { status: 502 });
  if (!deleted) {
    const { data: currentAvatar, error: currentError } = await client.database.from("avatars")
      .select("id,status").eq("id", avatarId).eq("user_id", user.id).maybeSingle();
    if (currentError) return Response.json({ error: "Could not confirm the avatar deletion." }, { status: 502 });
    return currentAvatar
      ? Response.json({ error: "Only failed avatars can be deleted." }, { status: 409 })
      : Response.json({ error: "Avatar not found." }, { status: 404 });
  }

  const recordedKeys = [avatar.image_16_9_key, avatar.image_9_16_key].filter((key): key is string => typeof key === "string" && key.length > 0);
  const outputKeys = getAvatarOutputKeysForCleanup(user.id, avatarId, recordedKeys);
  let storageCleanup = recordedKeys.length === outputKeys.length ? "complete" : "incomplete";
  if (outputKeys.length) {
    try {
      const { error: storageError } = await client.storage.from("avatars").remove(outputKeys);
      if (storageError) storageCleanup = "incomplete";
    } catch {
      storageCleanup = "incomplete";
    }
  }

  return Response.json({ deleted: true, storageCleanup });
}
