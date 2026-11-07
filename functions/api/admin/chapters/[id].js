// PUT/DELETE /api/admin/chapters/:id — edit/delete chapter stored in D1.
import { checkAdmin, validateId, parseJsonBody, checkBookOwnership, ensureAnnotationSchema } from '../../_utils.js';
import { chapterFitsD1, MAX_CHAPTER_BYTES } from '../../_d1-storage.js';

const MAX_CONTENT_LENGTH = 500000;

async function authorize(request, env, id) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return { error: Response.json({ error: 'Unauthorized' }, { status: auth.reason === 'locked' ? 429 : 401 }) };
  if (!validateId(id)) return { error: Response.json({ error: 'Invalid chapter ID' }, { status: 400 }) };
  const chapter = await env.DB.prepare('SELECT * FROM chapters WHERE id = ?').bind(id).first();
  if (!chapter) return { error: Response.json({ error: 'Chapter not found' }, { status: 404 }) };
  if (!await checkBookOwnership(auth, env, chapter.book_id)) {
    return { error: Response.json({ error: '只能编辑自己书籍的章节' }, { status: 403 }) };
  }
  return { chapter };
}

export async function onRequestPut({ request, env, params }) {
  const { chapter, error } = await authorize(request, env, params.id);
  if (error) return error;
  const body = await parseJsonBody(request);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  const { title, content, version } = body;
  const currentVersion = chapter.version || 0;
  const editingContent = content !== undefined;
  // The original admin.html editor does not submit version; preserve compatibility.
  // Newer clients that submit a version still get optimistic concurrency checks.
  if (version !== undefined && Number(version) !== currentVersion) {
    return Response.json({ error: '内容已被其他人修改，请刷新后重试' }, { status: 409 });
  }
  let nextTitle = chapter.title;
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim() || title.length > 200) {
      return Response.json({ error: '标题不能为空，最长200字符' }, { status: 400 });
    }
    nextTitle = title.trim();
  }
  if (editingContent) {
    if (typeof content !== 'string' || !content.trim()) {
      return Response.json({ error: '章节正文不能为空' }, { status: 400 });
    }
    const text = content.trim();
    if (text.length > MAX_CONTENT_LENGTH || !chapterFitsD1(text)) {
      return Response.json({ error: `D1 模式下每节正文不能超过 ${MAX_CONTENT_LENGTH} 字符或 ${MAX_CHAPTER_BYTES} 字节` }, { status: 413 });
    }
    const result = await env.DB.prepare(`UPDATE chapters SET
      title=?,word_count=?,content=?,content_key='d1',version=version+1,
      updated_at=datetime('now') WHERE id=? AND version=?`)
      .bind(nextTitle,text.length,text,params.id,currentVersion).run();
    if (!result?.meta?.changes) {
      return Response.json({ error: '内容已被其他人修改，请刷新后重试' }, { status: 409 });
    }
  } else if (nextTitle !== chapter.title) {
    await env.DB.prepare("UPDATE chapters SET title=?, updated_at=datetime('now') WHERE id=?")
      .bind(nextTitle, params.id).run();
  }
  await env.DB.prepare("UPDATE books SET updated_at=datetime('now') WHERE id=?").bind(chapter.book_id).run();
  let warning;
  if (editingContent) {
    const count = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM annotations WHERE chapter_id=? AND status!='removed'")
      .bind(params.id).first();
    if (count?.cnt > 0) warning = `该章节有 ${count.cnt} 条批注，修改内容可能导致批注定位失效`;
  }
  const row = await env.DB.prepare('SELECT version FROM chapters WHERE id=?').bind(params.id).first();
  return Response.json({ success: true, version: row?.version || 0, ...(warning ? { warning } : {}) });
}

export async function onRequestDelete({ request, env, params }) {
  const { chapter, error } = await authorize(request, env, params.id);
  if (error) return error;
  try {
    await ensureAnnotationSchema(env);
    // Archive comments may not exist if the feature has never been used.
    await env.DB.prepare('DELETE FROM archive_comments WHERE chapter_id=?').bind(params.id).run().catch(() => {});
    await env.DB.prepare('DELETE FROM archive_likes WHERE chapter_id=?').bind(params.id).run().catch(() => {});
    const results = await env.DB.batch([
      env.DB.prepare('DELETE FROM chapter_stats WHERE chapter_id=?').bind(params.id),
      env.DB.prepare('DELETE FROM annotation_likes WHERE annotation_id IN (SELECT id FROM annotations WHERE chapter_id=?)').bind(params.id),
      env.DB.prepare('DELETE FROM reports WHERE annotation_id IN (SELECT id FROM annotations WHERE chapter_id=?)').bind(params.id),
      env.DB.prepare('DELETE FROM votes WHERE annotation_id IN (SELECT id FROM annotations WHERE chapter_id=?)').bind(params.id),
      env.DB.prepare('DELETE FROM annotations WHERE chapter_id=?').bind(params.id),
      env.DB.prepare('DELETE FROM chapters WHERE id=?').bind(params.id),
      env.DB.prepare("UPDATE books SET updated_at=datetime('now') WHERE id=?").bind(chapter.book_id)
    ]);
    if (!results[5]?.meta?.changes) return Response.json({ error: '删除章节失败' }, { status: 500 });
    return Response.json({ success: true });
  } catch (err) {
    console.error('Delete D1 chapter failed:', err);
    return Response.json({ error: '删除章节失败' }, { status: 500 });
  }
}
