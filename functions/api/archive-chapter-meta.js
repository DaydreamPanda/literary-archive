// Public reader metadata and lifetime chapter reading count.
import { validateId } from './_utils.js';
export async function onRequestGet({request,env}){
  const id=new URL(request.url).searchParams.get('chapterId');
  if(!validateId(id||''))return Response.json({error:'Invalid chapterId'},{status:400});
  const chapter=await env.DB.prepare(`SELECT c.id,b.status,COALESCE(cs.views,0) AS views
    FROM chapters c JOIN books b ON b.id=c.book_id
    LEFT JOIN chapter_stats cs ON cs.chapter_id=c.id
    WHERE c.id=?`).bind(id).first();
  if(!chapter||(chapter.status&&chapter.status!=='normal'))return Response.json({error:'Chapter not found'},{status:404});
  const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_chapter_meta_'+id).first();
  let meta={};try{meta=JSON.parse(row?.value||'{}');}catch{}
  return Response.json({meta:{summary:typeof meta.summary==='string'?meta.summary:'',hasCover:!!meta.cover_key,
    views:Math.max(0,Number(chapter.views)||0)}},{headers:{'Cache-Control':'no-store'}});
}
