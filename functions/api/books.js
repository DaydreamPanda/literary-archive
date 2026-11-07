// GET /api/books — public book list with tags and optional admin fields.
import { checkAdmin, ensureAnnotationSchema } from './_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await checkAdmin(request, env);
  const isAdmin = auth.ok;
  const query = isAdmin
    ? `SELECT b.id,b.title,b.author,b.description,b.cover_key,b.created_at,b.updated_at,
        b.created_by,b.status,b.delete_at,b.annotation_enabled,b.annotation_locked,
        (SELECT COUNT(*) FROM chapters WHERE book_id=b.id) AS chapter_count,
        (SELECT COALESCE(SUM(word_count),0) FROM chapters WHERE book_id=b.id) AS total_words
       FROM books b ORDER BY b.updated_at DESC`
    : `SELECT b.id,b.title,b.author,b.description,b.cover_key,b.created_at,b.updated_at,
        b.created_by,b.status,b.delete_at,
        (SELECT COUNT(*) FROM chapters WHERE book_id=b.id) AS chapter_count,
        (SELECT COALESCE(SUM(word_count),0) FROM chapters WHERE book_id=b.id) AS total_words
       FROM books b WHERE b.status IS NULL OR b.status='normal' ORDER BY b.updated_at DESC`;
  const { results } = await env.DB.prepare(query).all();
  if (!isAdmin) for (const book of results) {
    delete book.created_by;
    delete book.status;
    delete book.delete_at;
  }
  let allBookTags = [];
  try {
    const { results: tags } = await env.DB.prepare(`SELECT bt.book_id,t.id AS tag_id,t.name,t.color
      FROM book_tags bt JOIN tags t ON bt.tag_id=t.id`).all();
    allBookTags = tags || [];
  } catch {}
  const byBook = {};
  for (const t of allBookTags) (byBook[t.book_id] ||= []).push({ id: t.tag_id, name: t.name, color: t.color });
  for (const book of results) book.tags = byBook[book.id] || [];
  if (Math.random() < 0.1) context.waitUntil(purgeExpiredBooks(env));
  return Response.json({ books: results });
}

async function purgeExpiredBooks(env) {
  try {
    await ensureAnnotationSchema(env);
    const { results: expired } = await env.DB.prepare(`SELECT id,cover_key FROM books
      WHERE status='deleted' AND delete_at IS NOT NULL AND delete_at<datetime('now')`).all();
    for (const book of expired) {
      const { meta } = await env.DB.prepare("UPDATE books SET status='purging' WHERE id=? AND status='deleted'")
        .bind(book.id).run();
      if (!meta.changes) continue;
      const { results: chapterRows } = await env.DB.prepare('SELECT id FROM chapters WHERE book_id=?').bind(book.id).all();
      for (const c of chapterRows) {
        await env.DB.prepare('DELETE FROM archive_comments WHERE chapter_id=?').bind(c.id).run().catch(() => {});
        await env.DB.prepare('DELETE FROM archive_likes WHERE chapter_id=?').bind(c.id).run().catch(() => {});
      }
      await env.DB.batch([
        env.DB.prepare('DELETE FROM chapter_stats WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id=?)').bind(book.id),
        env.DB.prepare('DELETE FROM book_stats WHERE book_id=?').bind(book.id),
        env.DB.prepare('DELETE FROM book_tags WHERE book_id=?').bind(book.id),
        env.DB.prepare('DELETE FROM votes WHERE annotation_id IN (SELECT id FROM annotations WHERE book_id=?)').bind(book.id),
        env.DB.prepare('DELETE FROM reports WHERE book_id=?').bind(book.id),
        env.DB.prepare('DELETE FROM annotation_likes WHERE annotation_id IN (SELECT id FROM annotations WHERE book_id=?)').bind(book.id),
        env.DB.prepare('DELETE FROM annotations WHERE book_id=?').bind(book.id),
        env.DB.prepare('DELETE FROM chapters WHERE book_id=?').bind(book.id),
        env.DB.prepare('DELETE FROM books WHERE id=?').bind(book.id)
      ]);
      if (book.cover_key) await env.DB.prepare('DELETE FROM archive_assets WHERE asset_key=?').bind(book.cover_key).run().catch(() => {});
    }
  } catch (err) { console.error('purgeExpiredBooks failed:', err); }
}
