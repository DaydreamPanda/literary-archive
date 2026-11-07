// GET /api/chapters/:id — chapter metadata and text from Cloudflare D1.
import { validateId } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  if (!validateId(params.id)) return Response.json({ error: 'Invalid chapter ID' }, { status: 400 });

  const chapter = await env.DB.prepare(`
    SELECT c.id, c.book_id, c.title, c.sort_order, c.word_count, c.created_at, c.updated_at,
           c.version, c.content, b.title AS book_title, b.status AS book_status
    FROM chapters c JOIN books b ON c.book_id = b.id WHERE c.id = ?
  `).bind(params.id).first();
  if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });
  if (chapter.book_status && chapter.book_status !== 'normal') {
    return Response.json({ error: '该书籍已下架' }, { status: 403 });
  }
  delete chapter.book_status;

  const content = chapter.content;
  delete chapter.content; // Only return body in the dedicated content property.
  if (!content && chapter.word_count > 0) {
    return Response.json({ error: '章节正文缺失，请联系作者检查 D1 数据' }, { status: 500 });
  }

  const [prevChapter, nextChapter] = await Promise.all([
    env.DB.prepare(`SELECT id, title FROM chapters WHERE book_id = ? AND sort_order < ?
      ORDER BY sort_order DESC LIMIT 1`).bind(chapter.book_id, chapter.sort_order).first(),
    env.DB.prepare(`SELECT id, title FROM chapters WHERE book_id = ? AND sort_order > ?
      ORDER BY sort_order ASC LIMIT 1`).bind(chapter.book_id, chapter.sort_order).first()
  ]);

  context.waitUntil(trackChapterView(env, chapter));
  return Response.json({ chapter, content, prevChapter: prevChapter || null, nextChapter: nextChapter || null });
}

async function trackChapterView(env, chapter) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(`INSERT INTO chapter_stats (chapter_id, views) VALUES (?, 1)
      ON CONFLICT(chapter_id) DO UPDATE SET views = views + 1`).bind(chapter.id).run();
    await env.DB.prepare(`INSERT INTO book_stats (book_id, date, views) VALUES (?, ?, 1)
      ON CONFLICT(book_id, date) DO UPDATE SET views = views + 1`).bind(chapter.book_id, today).run();
  } catch (err) { console.error('Track chapter view error:', err); }
}
