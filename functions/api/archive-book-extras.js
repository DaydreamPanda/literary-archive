/* Public chapter card metadata: existing D1 chapter covers and per-chapter effective tags. */
import { validateId } from './_utils.js';
const unique = list => [...new Set(list.map(Number).filter(Number.isSafeInteger).filter(x=>x>0))];
function parseTags(raw){
  if(!raw)return {mode:'inherit',ids:[]};
  try {
    const o=JSON.parse(raw);
    if(Array.isArray(o))return {mode:'legacy-extra',ids:unique(o)};
    if(o && o.mode==='custom' && Array.isArray(o.tagIds))return {mode:'custom',ids:unique(o.tagIds)};
  }catch{}
  return {mode:'inherit',ids:[]};
}
export async function onRequestGet({request,env}){
  const bookId=new URL(request.url).searchParams.get('bookId');
  if(!validateId(bookId||''))return Response.json({error:'作品编号无效'},{status:400});
  const book=await env.DB.prepare('SELECT id,status FROM books WHERE id=?').bind(bookId).first();
  if(!book||(book.status&&book.status!=='normal'))return Response.json({error:'作品不存在'},{status:404});
  const [chapterRows,tagRows,bookTags]=await Promise.all([
    env.DB.prepare(`SELECT c.id, cm.value AS chapter_meta, ct.value AS chapter_tags
      FROM chapters c
      LEFT JOIN site_settings cm ON cm.key=('archive_chapter_meta_' || c.id)
      LEFT JOIN site_settings ct ON ct.key=('archive_chapter_tags_' || c.id)
      WHERE c.book_id=? ORDER BY c.sort_order`).bind(bookId).all(),
    env.DB.prepare('SELECT id,name,color FROM tags').all(),
    env.DB.prepare('SELECT tag_id FROM book_tags WHERE book_id=?').bind(bookId).all()
  ]);
  const lookup=new Map((tagRows.results||[]).map(x=>[Number(x.id),x]));
  const bookIds=unique((bookTags.results||[]).map(x=>x.tag_id));
  const chapters=(chapterRows.results||[]).map(row=>{
    let meta={};try{meta=JSON.parse(row.chapter_meta||'{}')||{};}catch{}
    const chosen=parseTags(row.chapter_tags);
    const ids=chosen.mode==='custom'?chosen.ids:unique([...bookIds,...chosen.ids]);
    return {id:Number(row.id),hasCover:typeof meta.cover_key==='string'&&!!meta.cover_key,
      tags:ids.map(x=>lookup.get(x)).filter(Boolean)};
  });
  return Response.json({chapters},{headers:{'Cache-Control':'no-store'}});
}
