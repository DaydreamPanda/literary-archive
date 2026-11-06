// Anonymous per-chapter likes with a shared count in D1.
// Each browser receives a random, HttpOnly cookie. Its hash, never the raw token,
// is stored in D1, and each browser can like a chapter once or undo that like.
import { sha256Hash } from './_utils.js';

const COOKIE_NAME = 'archive_liker';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const noStore = { 'Cache-Control': 'no-store' };

function readToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const part = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE_NAME + '='));
  const token = part?.slice(COOKIE_NAME.length + 1) || '';
  return TOKEN_PATTERN.test(token) ? token : null;
}
function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}
function cookieHeader(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=31536000`;
}
async function ensureTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS archive_chapter_likes (
    chapter_id INTEGER NOT NULL,
    visitor_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (chapter_id, visitor_hash),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  )`).run();
}
async function chapterExists(env, id) {
  return env.DB.prepare("SELECT c.id FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=? AND (b.status IS NULL OR b.status='normal')").bind(id).first();
}
async function countLikes(env, id) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM archive_chapter_likes WHERE chapter_id=?').bind(id).first();
  return Number(row?.count) || 0;
}
function validChapterId(raw) {
  return typeof raw === 'string' && /^[1-9]\d{0,17}$/.test(raw);
}
function secretReady(env) {
  return typeof env.ARCHIVE_COMMENT_SECRET === 'string' && env.ARCHIVE_COMMENT_SECRET.length >= 24;
}
async function hashedVisitor(env, token) {
  return sha256Hash(env.ARCHIVE_COMMENT_SECRET + ':archive-like:' + token);
}
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('chapterId');
  if (!validChapterId(id)) return Response.json({error:'章节编号无效'}, {status:400, headers:noStore});
  if (!await chapterExists(env, id)) return Response.json({error:'章节不存在'}, {status:404, headers:noStore});
  await ensureTable(env);
  const enabled = secretReady(env);
  const token = readToken(request) || newToken();
  let liked = false;
  if (enabled) {
    const hash = await hashedVisitor(env, token);
    liked = Boolean(await env.DB.prepare('SELECT 1 FROM archive_chapter_likes WHERE chapter_id=? AND visitor_hash=?').bind(id, hash).first());
  }
  return Response.json({count:await countLikes(env,id),liked,enabled}, {
    headers:{...noStore,'Set-Cookie':cookieHeader(token,request)}
  });
}
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({error:'跨站提交被拒绝'}, {status:403, headers:noStore});
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return Response.json({error:'请使用 JSON 格式'}, {status:415, headers:noStore});
  if (!secretReady(env)) return Response.json({error:'站点尚未配置点赞功能'}, {status:503, headers:noStore});
  const token = readToken(request);
  if (!token) return Response.json({error:'请刷新页面后再点赞'}, {status:428, headers:noStore});
  const raw = await request.text();
  if (raw.length > 512) return Response.json({error:'请求内容过长'}, {status:413, headers:noStore});
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({error:'JSON 无效'}, {status:400, headers:noStore}); }
  const id = String(body?.chapterId ?? '');
  if (!validChapterId(id) || typeof body?.liked !== 'boolean') return Response.json({error:'参数无效'}, {status:400, headers:noStore});
  if (!await chapterExists(env, id)) return Response.json({error:'章节不存在'}, {status:404, headers:noStore});
  await ensureTable(env);
  const hash = await hashedVisitor(env, token);
  if (body.liked) {
    await env.DB.prepare('INSERT OR IGNORE INTO archive_chapter_likes(chapter_id,visitor_hash) VALUES(?,?)').bind(id,hash).run();
  } else {
    await env.DB.prepare('DELETE FROM archive_chapter_likes WHERE chapter_id=? AND visitor_hash=?').bind(id,hash).run();
  }
  const liked = Boolean(await env.DB.prepare('SELECT 1 FROM archive_chapter_likes WHERE chapter_id=? AND visitor_hash=?').bind(id,hash).first());
  return Response.json({count:await countLikes(env,id),liked,enabled:true}, {headers:noStore});
}
