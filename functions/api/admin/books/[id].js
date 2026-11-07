// PUT/DELETE/POST /api/admin/books/:id — edit, trash, restore and purge books.
import { checkAdmin, validateId, parseJsonBody, checkBookOwnership, requireMinRole, ensureAnnotationSchema } from '../../_utils.js';
import { deleteAsset } from '../../_d1-storage.js';

async function authorize(request, env, id) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return { error: Response.json({ error: 'Unauthorized' }, { status: auth.reason === 'locked' ? 429 : 401 }) };
  if (!validateId(id)) return { error: Response.json({ error: 'Invalid ID' }, { status: 400 }) };
  const book = await env.DB.prepare('SELECT * FROM books WHERE id=?').bind(id).first();
  if (!book) return { error: Response.json({ error: 'Book not found' }, { status: 404 }) };
  if (!await checkBookOwnership(auth, env, id)) {
    return { error: Response.json({ error: '只能操作自己创建的书籍' }, { status: 403 }) };
  }
  return { book, auth };
}

export async function onRequestPut({ request, env, params }) {
  const { book, error } = await authorize(request, env, params.id);
  if (error) return error;
  const body = await parseJsonBody(request);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  const title = (body.title || book.title || '').trim().slice(0, 200);
  const author = (body.author ?? book.author ?? '').trim().slice(0, 100);
  const description = (body.description ?? book.description ?? '').trim().slice(0, 2000);
  const annotationEnabled = body.annotation_enabled === 1 || body.annotation_enabled === true ? 1
    : body.annotation_enabled === 0 || body.annotation_enabled === false ? 0 : (book.annotation_enabled || 0);
  await env.DB.prepare(`UPDATE books SET title=?,author=?,description=?,annotation_enabled=?,updated_at=datetime('now') WHERE id=?`)
    .bind(title, author, description, annotationEnabled, params.id).run();
  return Response.json({ success: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { book, error } = await authorize(request, env, params.id);
  if (error) return error;
  if ((book.status || 'normal') === 'deleted') return Response.json({ error: '书籍已在回收站中' }, { status: 400 });
  const deleteAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await env.DB.prepare("UPDATE books SET status='deleted',delete_at=?,updated_at=datetime('now') WHERE id=?")
    .bind(deleteAt, params.id).run();
  return Response.json({ success: true, message: '书籍已移入回收站，30天后自动删除', delete_at: deleteAt });
}

export async function onRequestPost({ request, env, params }) {
  const { book, auth, error } = await authorize(request, env, params.id);
  if (error) return error;
  const body = await parseJsonBody(request);
  const action = body?.action;
  if (!['unlist','restore','purge'].includes(action)) return Response.json({ error: 'Unknown action' }, { status: 400 });
  const status = book.status || 'normal';
  if (action === 'unlist') {
    if (status !== 'normal') return Response.json({ error: '只有正常状态的书籍可以下架' }, { status: 400 });
    await env.DB.prepare("UPDATE books SET status='unlisted',delete_at=NULL,updated_at=datetime('now') WHERE id=?")
      .bind(params.id).run();
    return Response.json({ success: true, message: '书籍已下架' });
  }
  if (action === 'restore') {
    if (status === 'normal') return Response.json({ error: '书籍已是正常状态' }, { status: 400 });
    await env.DB.prepare("UPDATE books SET status='normal',delete_at=NULL,updated_at=datetime('now') WHERE id=?")
      .bind(params.id).run();
    return Response.json({ success: true, message: '书籍已恢复上架' });
  }
  if (status !== 'deleted') return Response.json({ error: '只能永久删除已在回收站中的书籍' }, { status: 400 });
  if (!requireMinRole(auth, 'super_admin')) return Response.json({ error: '仅超级管理员可永久删除' }, { status: 403 });
  await ensureAnnotationSchema(env);
  const { results: chapters } = await env.DB.prepare('SELECT id FROM chapters WHERE book_id=?').bind(params.id).all();
  for (const c of chapters) {
    await env.DB.prepare('DELETE FROM archive_comments WHERE chapter_id=?').bind(c.id).run().catch(() => {});
    await env.DB.prepare('DELETE FROM archive_likes WHERE chapter_id=?').bind(c.id).run().catch(() => {});
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM chapter_stats WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id=?)').bind(params.id),
    env.DB.prepare('DELETE FROM book_stats WHERE book_id=?').bind(params.id),
    env.DB.prepare('DELETE FROM book_tags WHERE book_id=?').bind(params.id),
    env.DB.prepare('DELETE FROM votes WHERE annotation_id IN (SELECT id FROM annotations WHERE book_id=?)').bind(params.id),
    env.DB.prepare('DELETE FROM reports WHERE book_id=?').bind(params.id),
    env.DB.prepare('DELETE FROM annotation_likes WHERE annotation_id IN (SELECT id FROM annotations WHERE book_id=?)').bind(params.id),
    env.DB.prepare('DELETE FROM annotations WHERE book_id=?').bind(params.id),
    env.DB.prepare('DELETE FROM chapters WHERE book_id=?').bind(params.id),
    env.DB.prepare('DELETE FROM books WHERE id=?').bind(params.id)
  ]);
  if (book.cover_key) await deleteAsset(env, book.cover_key).catch(() => {});
  return Response.json({ success: true, message: '书籍已永久删除' });
}
