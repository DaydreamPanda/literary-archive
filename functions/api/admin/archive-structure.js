/* Manual chapter grouping + persisted reading order. Atomic D1 batch. */
import { checkAdmin, requireSuperAdmin, parseJsonBody } from '../_utils.js';

export async function onRequestPut({ request, env }) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return Response.json({ error: '请先登录后台' }, { status: 401 });
  if (!requireSuperAdmin(auth)) return Response.json({ error: '只有网站所有者可以编辑目录' }, { status: 403 });
  const bookId = new URL(request.url).searchParams.get('bookId');
  if (!/^[1-9]\d*$/.test(bookId || '')) return Response.json({ error: '作品编号无效' }, { status: 400 });
  const book = await env.DB.prepare("SELECT id FROM books WHERE id=? AND (status IS NULL OR status='normal')").bind(bookId).first();
  if (!book) return Response.json({ error: '作品不存在' }, { status: 404 });
  const payload = await parseJsonBody(request);
  if (!Array.isArray(payload?.items) || payload.items.length > 500) return Response.json({ error: '目录必须是数组，最多500个篇目' }, { status: 400 });
  const owned = await env.DB.prepare('SELECT id FROM chapters WHERE book_id=?').bind(bookId).all();
  const ids = new Set((owned.results || []).map(r => Number(r.id)));
  if (ids.size !== payload.items.length) return Response.json({ error: '目录与当前章节数量不一致，请刷新重试' }, { status: 409 });
  const seen = new Set(), items = [];
  for (const x of payload.items) {
    const id = Number(x?.chapterId);
    if (!Number.isSafeInteger(id) || !ids.has(id) || seen.has(id)) return Response.json({ error: '章节不属于这本书或出现重复编号' }, { status: 400 });
    if (typeof x.groupTitle !== 'string' || !x.groupTitle.trim() || x.groupTitle.length > 200) return Response.json({ error: '大章标题不能为空且不能超过200字' }, { status: 400 });
    if (typeof x.sectionTitle !== 'string' || x.sectionTitle.length > 200) return Response.json({ error: '小节标题不能超过200字' }, { status: 400 });
    if (!['main','extra'].includes(x.kind)) return Response.json({ error: '分类必须是正文或番外' }, { status: 400 });
    seen.add(id);
    items.push({ chapterId: id, groupTitle: x.groupTitle.trim(), sectionTitle: x.sectionTitle.trim(), kind: x.kind });
  }
  // Update both metadata and physical sort_order. Reader prev/next uses sort_order.
  // D1 batch is transactional, so a failed update leaves the old order intact.
  const stmts = items.map((x, index) => env.DB.prepare('UPDATE chapters SET sort_order=? WHERE id=? AND book_id=?').bind(index + 1, x.chapterId, bookId));
  stmts.push(env.DB.prepare('INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind('archive_structure_' + bookId, JSON.stringify(items)));
  await env.DB.batch(stmts);
  return Response.json({ success: true, count: items.length }, { headers: { 'Cache-Control': 'no-store' } });
}
