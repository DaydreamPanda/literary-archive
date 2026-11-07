// POST /api/admin/chapters — create chapter with body in D1, not R2.
import { checkAdmin, validateId, parseJsonBody, checkBookOwnership, requireMinRole } from '../_utils.js';
import { chapterFitsD1, MAX_CHAPTER_BYTES } from '../_d1-storage.js';

const MAX_CONTENT_LENGTH = 500000;

export async function onRequestPost({ request, env }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return Response.json({ error: 'Unauthorized' }, { status: auth.reason === 'locked' ? 429 : 401 });
  const body = await parseJsonBody(request);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  const { book_id, title, content, sort_order: clientSortOrder } = body;
  if (!book_id || !validateId(String(book_id))) return Response.json({ error: 'Valid book_id is required' }, { status: 400 });
  if (typeof title !== 'string' || !title.trim() || title.length > 200) {
    return Response.json({ error: 'Title is required (max 200 chars)' }, { status: 400 });
  }
  if (typeof content !== 'string' || !content.trim()) return Response.json({ error: 'Content is required' }, { status: 400 });
  const text = content.trim();
  if (text.length > MAX_CONTENT_LENGTH || !chapterFitsD1(text)) {
    return Response.json({ error: `D1 模式下每节正文不能超过 ${MAX_CONTENT_LENGTH} 字符或 ${MAX_CHAPTER_BYTES} 字节` }, { status: 413 });
  }
  const book = await env.DB.prepare('SELECT id FROM books WHERE id = ?').bind(book_id).first();
  if (!book) return Response.json({ error: 'Book not found' }, { status: 404 });
  if (!await checkBookOwnership(auth, env, book_id)) {
    return Response.json({ error: '只能向自己创建的书籍添加章节' }, { status: 403 });
  }
  if (!requireMinRole(auth, 'admin')) {
    const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM chapters WHERE book_id = ?').bind(book_id).first();
    if (count >= 200) return Response.json({ error: '演示账号每本书最多 200 章' }, { status: 403 });
  }
  let sortOrder;
  if (clientSortOrder !== undefined && Number.isInteger(Number(clientSortOrder)) && Number(clientSortOrder) > 0 && Number(clientSortOrder) <= 2147483647) {
    sortOrder = Number(clientSortOrder);
  } else {
    const last = await env.DB.prepare('SELECT MAX(sort_order) AS max_order FROM chapters WHERE book_id = ?').bind(book_id).first();
    sortOrder = (last?.max_order || 0) + 1;
  }
  // The database already has a chapters.content TEXT column.
  // A single INSERT guarantees metadata and manuscript text commit together.
  try {
    const result = await env.DB.prepare(`INSERT INTO chapters
      (book_id,title,sort_order,word_count,content_key,content)
      VALUES (?,?,?,?,?,?)`)
      .bind(book_id, title.trim(), sortOrder, text.length, 'd1', text).run();
    const chapterId = result.meta.last_row_id;
    if (!requireMinRole(auth, 'admin')) {
      const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM chapters WHERE book_id=?')
        .bind(book_id).first();
      if (count > 200) {
        await env.DB.prepare('DELETE FROM chapters WHERE id=?').bind(chapterId).run();
        return Response.json({ error: '演示账号每本书最多 200 章' }, { status: 403 });
      }
    }
    await env.DB.prepare("UPDATE books SET updated_at=datetime('now') WHERE id=?").bind(book_id).run();
    return Response.json({success:true, chapter:{id:chapterId,title:title.trim(),sort_order:sortOrder,word_count:text.length}}, {status:201});
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return Response.json({error:'章节排序冲突，请刷新后重试'}, {status:409});
    }
    console.error('Create D1 chapter failed:', err);
    return Response.json({error:'章节保存到 D1 失败，请检查数据库字段'}, {status:500});
  }
}
