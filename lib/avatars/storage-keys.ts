export function getAvatarOutputKeysForCleanup(
  userId: string,
  avatarId: string,
  keys: Array<string | null | undefined>,
) {
  const prefix = `${userId}/${avatarId}/`;
  const outputKeyPattern = /^attempt-\d+\/avatar-(?:16-9|9-16)\.(?:png|jpg|webp)$/;
  return [...new Set(keys.filter((key): key is string => {
    if (!key?.startsWith(prefix)) return false;
    return outputKeyPattern.test(key.slice(prefix.length));
  }))];
}
