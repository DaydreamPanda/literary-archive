// GET /api/admin/stats: access and content popularity summary.
import { checkAdmin } from '../_utils.js';
export async function onRequestGet({request,env}) {
  const auth=await checkAdmin(request,env);
  if(!auth.ok)return Response.json({error:'Unauthorized'},{status:401});
  try {
    const today=new Date().toISOString().slice(0,10);
    const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const todayStats=await env.DB.prepare('SELECT pv,uv FROM site_visits WHERE date=?').bind(today).first()||{pv:0,uv:0};
    const [daily,totals,hot,chapters]=await Promise.all([
      env.DB.prepare('SELECT date,pv,uv FROM site_visits WHERE date>=? ORDER BY date ASC').bind(since).all(),
      env.DB.prepare('SELECT COALESCE(SUM(pv),0) AS total_pv,COALESCE(SUM(uv),0) AS total_uv FROM site_visits').first(),
      env.DB.prepare(`SELECT bs.book_id,b.title,SUM(bs.views) AS total_views
        FROM book_stats bs JOIN books b ON b.id=bs.book_id
        WHERE bs.date>=? AND (b.status IS NULL OR b.status='normal')
        GROUP BY bs.book_id ORDER BY total_views DESC LIMIT 5`).bind(since).all(),
      env.DB.prepare(`SELECT cs.chapter_id,c.title AS chapter_title,b.title AS book_title,cs.views
        FROM chapter_stats cs JOIN chapters c ON c.id=cs.chapter_id
        JOIN books b ON b.id=c.book_id
        WHERE b.status IS NULL OR b.status='normal'
        ORDER BY cs.views DESC LIMIT 10`).all()
    ]);
    return Response.json({today:todayStats,totals,daily:daily.results||[],hotBooks:hot.results||[],hotChapters:chapters.results||[]},
      {headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('Stats error:',e);return Response.json({error:'获取统计失败'},{status:500});}
}
