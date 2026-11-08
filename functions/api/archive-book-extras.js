/* Batch public metadata for chapter cards. Uses already-stored D1 chapter covers and tags. */
import {validateId} from './_utils.js';
function listIds(raw){try{const a=JSON.parse(raw||'[]');return Array.isArray(a)?a.filter(x=>Number.isSafeInteger(x)&&x>0).slice(0,20):[];}catch{return [];}}
export async function onRequestGet({request,env}){
  const bookId=new URL(request.url).searchParams.get('bookId');
  if(!validateId(bookId||''))return Response.json({error:'作品编号无效'},{status:400});
  const book=await env.DB.prepare('SELECT id,status FROM books WHERE id=?').bind(bookId).first();
  if(!book||(book.status&&book.status!=='normal'))return Response.json({error:'作品不存在'},{status:404});
  const [data,tagData]=await Promise.all([
    env.DB.prepare(`SELECT c.id,cm.value AS chapter_meta,ct.value AS chapter_tags
      FROM chapters c
      LEFT JOIN site_settings cm ON cm.key=('archive_chapter_meta_' || c.id)
      LEFT JOIN site_settings ct ON ct.key=('archive_chapter_tags_' || c.id)
      WHERE c.book_id=? ORDER BY c.sort_order`).bind(bookId).all(),
    env.DB.prepare('SELECT id,name,color FROM tags').all()
  ]);
  const lookup=new Map((tagData.results||[]).map(x=>[x.id,x]));
  const chapters=(data.results||[]).map(row=>{
    let meta={};try{meta=JSON.parse(row.chapter_meta||'{}')||{};}catch{}
    return {id:Number(row.id),hasCover:typeof meta.cover_key==='string'&&!!meta.cover_key,
      tags:listIds(row.chapter_tags).map(x=>lookup.get(x)).filter(Boolean)};
  });
  return Response.json({chapters},{headers:{'Cache-Control':'no-store'}});
}
