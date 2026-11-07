// Cloudflare D1 storage adapters for the existing novel-site database.
// Text is stored in chapters.content. Small binary assets use archive_assets.
// This keeps the user's current D1 schema and requires no R2 binding.

export const MAX_CHAPTER_BYTES = 1_500_000;
export const MAX_ASSET_BYTES = 1_000_000;
export function chapterFitsD1(content) {
  return typeof content === 'string' && new TextEncoder().encode(content).byteLength <= MAX_CHAPTER_BYTES;
}

export async function ensureD1Storage(env) {
  if (!env.DB) throw new Error('Missing Cloudflare D1 binding DB');
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS archive_assets (
    asset_key TEXT PRIMARY KEY,
    mime_type TEXT NOT NULL,
    bytes BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}

export async function getChapterText(env, chapterId) {
  const row = await env.DB.prepare('SELECT content FROM chapters WHERE id = ?').bind(chapterId).first();
  return row?.content ?? null;
}

export async function saveAsset(env, key, mimeType, bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) {
    throw new RangeError('Asset exceeds D1 storage limit');
  }
  await ensureD1Storage(env);
  await env.DB.prepare(`INSERT INTO archive_assets(asset_key,mime_type,bytes) VALUES(?,?,?)
    ON CONFLICT(asset_key) DO UPDATE SET mime_type=excluded.mime_type, bytes=excluded.bytes,
    created_at=datetime('now')`).bind(key, mimeType, bytes).run();
}

export async function getAsset(env, key) {
  await ensureD1Storage(env);
  const row = await env.DB.prepare('SELECT mime_type,bytes FROM archive_assets WHERE asset_key=?').bind(key).first();
  return row ? {mimeType:row.mime_type, bytes:new Uint8Array(row.bytes)} : null;
}

export async function deleteAsset(env, key) {
  if (!key) return;
  await ensureD1Storage(env);
  await env.DB.prepare('DELETE FROM archive_assets WHERE asset_key=?').bind(key).run();
}
