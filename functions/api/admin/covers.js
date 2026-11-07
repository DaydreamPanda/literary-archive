// POST/DELETE /api/admin/covers — store small cover images in D1.
import { checkAdmin, validateId, checkBookOwnership } from '../_utils.js';
import { saveAsset, deleteAsset, MAX_ASSET_BYTES } from '../_d1-storage.js';

async function authorize(request, env, bookId) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!bookId || !validateId(bookId)) return { error: Response.json({ error: 'Valid book_id required' }, { status: 400 }) };
  const book = await env.DB.prepare('SELECT id, cover_key FROM books WHERE id = ?').bind(bookId).first();
  if (!book) return { error: Response.json({ error: 'Book not found' }, { status: 404 }) };
  if (!await checkBookOwnership(auth, env, bookId)) {
    return { error: Response.json({ error: '只能管理自己书籍的封面' }, { status: 403 }) };
  }
  return { book };
}

export async function onRequestPost({ request, env }) {
  const bookId = new URL(request.url).searchParams.get('book_id');
  const { book, error } = await authorize(request, env, bookId);
  if (error) return error;
  const data = await request.formData();
  const file = data.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) {
    return Response.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (file.size > MAX_ASSET_BYTES) {
    return Response.json({ error: 'D1 模式下封面请压缩到 1 MB 以内' }, { status: 413 });
  }
  const ct = file.type || '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(ct)) {
    return Response.json({ error: '仅支持 JPEG、PNG、WebP 格式' }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!((ct === 'image/jpeg' && jpeg) || (ct === 'image/png' && png) || (ct === 'image/webp' && webp))) {
    return Response.json({ error: '图片格式与文件内容不一致' }, { status: 400 });
  }
  const ext = ct === 'image/png' ? 'png' : ct === 'image/webp' ? 'webp' : 'jpg';
  const key = `covers/${bookId}/${crypto.randomUUID()}.${ext}`;
  try {
    await saveAsset(env, key, ct, bytes);
    try {
      await env.DB.prepare("UPDATE books SET cover_key = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(key, bookId).run();
    } catch (err) {
      await deleteAsset(env, key).catch(() => {});
      throw err;
    }
    if (book.cover_key) await deleteAsset(env, book.cover_key).catch(() => {});
    return Response.json({ success: true, cover_key: key });
  } catch (err) {
    console.error('Cover D1 upload failed:', err);
    return Response.json({ error: '封面保存失败，请检查 D1 数据库配置' }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  const bookId = new URL(request.url).searchParams.get('book_id');
  const { book, error } = await authorize(request, env, bookId);
  if (error) return error;
  await env.DB.prepare("UPDATE books SET cover_key = NULL, updated_at = datetime('now') WHERE id = ?")
    .bind(bookId).run();
  if (book.cover_key) await deleteAsset(env, book.cover_key).catch(() => {});
  return Response.json({ success: true });
}
