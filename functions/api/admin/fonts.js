// Admin font API: store small WOFF2 fonts in D1 instead of R2.
import { checkAdmin, requireSuperAdmin } from '../_utils.js';
import { saveAsset, deleteAsset, MAX_ASSET_BYTES } from '../_d1-storage.js';

async function getFontList(env) {
  const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key='custom_fonts'").first();
  try { return row ? JSON.parse(row.value) : []; } catch { return []; }
}
async function saveFontList(env, fonts) {
  await env.DB.prepare("INSERT OR REPLACE INTO site_settings(key,value) VALUES('custom_fonts',?)")
    .bind(JSON.stringify(fonts)).run();
}
async function authorize(request, env) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireSuperAdmin(auth)) return Response.json({ error: '仅超级管理员可管理字体' }, { status: 403 });
  return null;
}
export async function onRequestPost({ request, env }) {
  const error = await authorize(request, env);
  if (error) return error;
  const data = await request.formData();
  const file = data.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.name) {
    return Response.json({ error: '请选择文件' }, { status: 400 });
  }
  const name = file.name.replace(/[^a-zA-Z0-9_\-.]/g, '_');
  if (!/^[\w\-.]+\.woff2$/i.test(name)) return Response.json({ error: '只支持 .woff2 格式' }, { status: 400 });
  if (!file.size || file.size > MAX_ASSET_BYTES) {
    return Response.json({ error: 'D1 模式下字体文件请控制在 1 MB 以内' }, { status: 413 });
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!(bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32)) {
      return Response.json({ error: '无效的 WOFF2 字体文件' }, { status: 400 });
    }
    await saveAsset(env, `fonts/${name}`, 'font/woff2', bytes);
    const fonts = await getFontList(env);
    if (!fonts.includes(name)) fonts.push(name);
    await saveFontList(env, fonts);
    return Response.json({ success: true, name });
  } catch (err) {
    console.error('D1 font upload error:', err);
    return Response.json({ error: '字体上传失败' }, { status: 500 });
  }
}
export async function onRequestDelete({ request, env }) {
  const error = await authorize(request, env);
  if (error) return error;
  const body = await request.json().catch(() => null);
  const name = body?.filename;
  if (typeof name !== 'string' || !/^[\w\-.]+\.woff2$/i.test(name)) {
    return Response.json({ error: '无效的文件名' }, { status: 400 });
  }
  const fonts = await getFontList(env);
  await saveFontList(env, fonts.filter(x => x !== name));
  await deleteAsset(env, `fonts/${name}`).catch(() => {});
  return Response.json({ success: true });
}
