import type { Env } from "../types";

const MAX_BATCH = 1000;

export async function cleanImages(env: Env): Promise<{ deleted: number }> {
  const days = Number(env.IMAGE_RETENTION_DAYS ?? "30");

  if (!Number.isInteger(days) || days < 0) {
    throw new Error("IMAGE_RETENTION_DAYS must be a non-negative integer");
  }
  const window = `-${days} days`;
  const referenced = await env.DB.prepare(
    `SELECT image_key FROM baselines UNION SELECT s.actual_key AS image_key FROM snapshots s JOIN builds b ON b.id = s.build_id
     WHERE b.created_at >= datetime('now', ?1) UNION SELECT s.expected_key FROM snapshots s JOIN builds b ON b.id = s.build_id
     WHERE b.created_at >= datetime('now', ?1) AND s.expected_key IS NOT NULL UNION SELECT s.diff_key FROM snapshots s JOIN builds b ON b.id = s.build_id
     WHERE b.created_at >= datetime('now', ?1) AND s.diff_key IS NOT NULL`,
  )
    .bind(window)
    .all<{ image_key: string }>();
  const keep = new Set(referenced.results.map((row) => row.image_key));
  let cursor: string | undefined;
  const stale: string[] = [];
  do {
    const page = await env.IMAGES.list({ cursor, limit: 1000 });
    stale.push(...page.objects.map((object) => object.key).filter((key) => !keep.has(key)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  for (let index = 0; index < stale.length; index += MAX_BATCH) {
    await env.IMAGES.delete(stale.slice(index, index + MAX_BATCH));
  }

  return { deleted: stale.length };
}
