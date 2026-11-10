/* Public author banner image and its safe presentation metadata. */
import { getAsset } from './_d1-storage.js';

const NAME = 'archive_banner';
const response = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function setting(env) {
  const row = await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind(NAME).first();
  try {
    const value = JSON.parse(row?.value || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const data = await setting(env);
  const position = Number.isFinite(Number(data.position)) ? Math.min(100, Math.max(0, Number(data.position))) : 50;
  if (url.searchParams.has('meta')) {
    return response({ exists: !!data.key, position, version: data.version || '' });
  }
  if (!data.key) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const asset = await getAsset(env, data.key);
  if (!asset || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(asset.bytes, {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
