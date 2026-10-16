const DICEBEAR_NOTIONISTS = 'https://api.dicebear.com/7.x/notionists/svg';

/**
 * Avatar drawn for users who have not uploaded a photo. A third party (dicebear.com) draws it, so whatever
 * seeds it travels to that third party in the URL, on every page the signed-in user opens: the seed must be
 * the user id (random, not personal data), never the email.
 */
export function defaultAvatarUrl(userId: string | null | undefined): string | undefined {
  if (!userId) return undefined;
  return `${DICEBEAR_NOTIONISTS}?seed=${encodeURIComponent(userId)}`;
}
