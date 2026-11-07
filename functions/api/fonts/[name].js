// GET /api/fonts/:name — small custom font file stored in D1.
import { getAsset } from '../_d1-storage.js';

export async function onRequestGet({ env, params }) {
  const name = params.name;
  if (!name || !/^[\w\-.]+\.woff2$/i.test(name)) {
    return new Response('Invalid font name', { status: 400 });
  }
  const asset = await getAsset(env, `fonts/${name}`);
  if (!asset) return new Response('Font not found', { status: 404 });
  return new Response(asset.bytes.buffer, {
    headers: {
      'Content-Type': 'font/woff2',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
