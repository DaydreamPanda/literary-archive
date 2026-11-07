// GET /api/covers/:id — serve a small cover image stored in D1.
import { validateId } from '../_utils.js';
import { getAsset } from '../_d1-storage.js';

export async function onRequestGet({ env, params }) {
  if (!validateId(params.id)) return new Response('Not found', { status: 404 });
  const book = await env.DB.prepare('SELECT cover_key, status FROM books WHERE id = ?')
    .bind(params.id).first();
  if (!book?.cover_key || (book.status && book.status !== 'normal')) {
    return new Response('Not found', { status: 404 });
  }
  const asset = await getAsset(env, book.cover_key);
  if (!asset) return new Response('Not found', { status: 404 });
  return new Response(asset.bytes.buffer, {
    headers: { 'Content-Type': asset.mimeType, 'Cache-Control': 'public, max-age=300' }
  });
}
