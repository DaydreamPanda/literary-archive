// Public reader metadata, tied to a published chapter. D1 site_settings stores small JSON.
import { validateId } from './_utils.js';
export async function onRequestGet({request,env}) {
  const id=new URL(request.url).searchParams.get('chapterId');
  if(!validateId(id||'')) return Response.json({error:'Invalid chapterId'},{status:400});
  const chapter=await env.DB.prepare(`SELECT c.id,b.status FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=?`).bind(id).first();
  if(!chapter || (chapter.status && chapter.status!=='normal')) return Response.json({error:'Chapter not found'},{status:404});
  const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_chapter_meta_'+id).first();
  let meta={};try{meta=JSON.parse(row?.value||'{}');}catch{}
  return Response.json({meta:{summary:typeof meta.summary==='string'?meta.summary:'',hasCover:!!meta.cover_key}},{headers:{'Cache-Control':'no-store'}});
}
