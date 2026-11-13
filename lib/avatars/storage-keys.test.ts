import assert from "node:assert/strict";
import test from "node:test";

const { getAvatarOutputKeysForCleanup } = await import("./storage-keys" + ".ts");

test("allows cleanup only for generated variants in the avatar's own attempt folders", () => {
  const keys = getAvatarOutputKeysForCleanup("user-1", "avatar-1", [
    "user-1/avatar-1/attempt-2/avatar-16-9.png",
    "user-1/avatar-1/attempt-2/avatar-9-16.webp",
    "user-1/avatar-1/attempt-2/avatar-16-9.png",
    "user-1/avatar-2/attempt-2/avatar-16-9.png",
    "user-2/avatar-1/attempt-2/avatar-16-9.png",
    "user-1/avatar-1/source.jpg",
    "user-1/avatar-1/attempt-2/unrelated.png",
    "user-1/avatar-1/attempt-2/../../other/avatar-16-9.png",
  ]);
  assert.deepEqual(keys, [
    "user-1/avatar-1/attempt-2/avatar-16-9.png",
    "user-1/avatar-1/attempt-2/avatar-9-16.webp",
  ]);
});
