import { prisma } from '@/lib/prisma'

export type TagRecord = { key: string; value: string }

/**
 * Get all tags for a user as key-value pairs.
 * Used for visibility: branch, location, position, etc.
 */
export async function getUserTags(userId: string): Promise<TagRecord[]> {
  const rows = await prisma.userTag.findMany({
    where: { userId },
    select: { key: true, value: true },
  })
  return rows.map((r) => ({ key: r.key, value: r.value }))
}

/**
 * Get tags as a flat object (e.g. { branch: "North", location: "NYC" }).
 */
export async function getUserTagsMap(userId: string): Promise<Record<string, string>> {
  const tags = await getUserTags(userId)
  return Object.fromEntries(tags.map((t) => [t.key, t.value]))
}

/**
 * Set tags for a user. Replaces all existing tags with the given set.
 * keys are normalized (trimmed, non-empty); values trimmed.
 */
export async function setUserTags(userId: string, tags: TagRecord[]): Promise<TagRecord[]> {
  const normalized = tags
    .map((t) => ({ key: String(t.key).trim(), value: String(t.value).trim() }))
    .filter((t) => t.key.length > 0)
  await prisma.$transaction([
    prisma.userTag.deleteMany({ where: { userId } }),
    ...normalized.map((t) =>
      prisma.userTag.create({ data: { userId, key: t.key, value: t.value } })
    ),
  ])
  return normalized
}

/**
 * Check if a user has a specific tag key-value.
 */
export async function userHasTag(
  userId: string,
  key: string,
  value: string
): Promise<boolean> {
  const row = await prisma.userTag.findUnique({
    where: {
      userId_key: { userId, key },
    },
  })
  return row ? row.value === value : false
}

/**
 * Check if a user's tags match a filter (all given key-value pairs must match).
 * Use this for visibility: e.g. only show to users where branch=North and location=NYC.
 */
export async function userMatchesTags(
  userId: string,
  filter: Record<string, string>
): Promise<boolean> {
  if (Object.keys(filter).length === 0) return true
  const map = await getUserTagsMap(userId)
  for (const [k, v] of Object.entries(filter)) {
    if (map[k] !== v) return false
  }
  return true
}

/**
 * Get all user IDs that have a given tag key-value (e.g. all users with branch=North).
 */
export async function getUserIdsWithTag(key: string, value: string): Promise<string[]> {
  const rows = await prisma.userTag.findMany({
    where: { key, value },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}
