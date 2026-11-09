/* Public homepage metrics: read-only, one batched DB query, no view increments. */
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT b.id AS book_id,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id=b.id) AS chapter_count,
             (SELECT c.id FROM chapters c WHERE c.book_id=b.id
              ORDER BY c.sort_order ASC,c.id ASC LIMIT 1) AS first_chapter_id,
             COALESCE((SELECT SUM(COALESCE(cs.views,0))
               FROM chapters c LEFT JOIN chapter_stats cs ON cs.chapter_id=c.id
               WHERE c.book_id=b.id),0) AS reads
      FROM books b
      WHERE b.status IS NULL OR b.status='normal'
    `).all();
    return Response.json({books:(results||[]).map(r=>({
      bookId:Number(r.book_id),
      chapterCount:Number(r.chapter_count)||0,
      chapterId:r.first_chapter_id==null?null:Number(r.first_chapter_id),
      reads:Math.max(0,Number(r.reads)||0)
    }))},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch (e) {
    console.error('Archive home reads:',e);
    return Response.json({error:'暂时无法获取阅读次数'},{status:500,headers:{'Cache-Control':'no-store'}});
  }
}
