/* Book chapter covers, effective tags and total chapter reads. */
import { validateId } from './_utils.js';
function tagIds(raw){
  try {const data=JSON.parse(raw||'[]');return Array.isArray(data)?[...new Set(data.map(Number).filter(x=>Number.isSafeInteger(x)&&x>0))].slice(0,20):[];}
  catch{return [];}
}
export async function onRequestGet({request,env}) {
  const bookId=new URL(request.url).searchParams.get('bookId');
  if(!validateId(bookId||''))return Response.json({error:'作品编号无效'},{status:400});
  const book=await env.DB.prepare('SELECT id,status FROM books WHERE id=?').bind(bookId).first();
  if(!book||(book.status&&book.status!=='normal'))return Response.json({error:'作品不存在'},{status:404});
  const [rows,allTags,bookTags]=await Promise.all([
    env.DB.prepare(`SELECT c.id,cm.value AS chapter_meta,ct.value AS chapter_tags,
      COALESCE(cs.views,0) AS views
      FROM chapters c
      LEFT JOIN site_settings cm ON cm.key=('archive_chapter_meta_' || c.id)
      LEFT JOIN site_settings ct ON ct.key=('archive_chapter_tags_' || c.id)
      LEFT JOIN chapter_stats cs ON cs.chapter_id=c.id
      WHERE c.book_id=? ORDER BY c.sort_order`).bind(bookId).all(),
    env.DB.prepare('SELECT id,name,color FROM tags').all(),
    env.DB.prepare('SELECT tag_id FROM book_tags WHERE book_id=?').bind(bookId).all()
  ]);
  const tagLookup=new Map((allTags.results||[]).map(t=>[Number(t.id),t]));
  const inherited=(bookTags.results||[]).map(x=>Number(x.tag_id));
  const chapters=(rows.results||[]).map(row=>{
    let meta={};try{meta=JSON.parse(row.chapter_meta||'{}')||{};}catch{}
    // No chapter override: old chapters inherit book tags.
    // Existing chapter list: prior additive-tag data used this same format.
    let ids=inherited;
    if(row.chapter_tags!==null && row.chapter_tags!==undefined){
      try {
        const obj=JSON.parse(row.chapter_tags);
        // New explicit format records a final choice, including an empty selection.
        if(obj && obj.mode==='custom' && Array.isArray(obj.tagIds)) ids=tagIds(JSON.stringify(obj.tagIds));
        else ids=[...new Set([...inherited,...tagIds(row.chapter_tags)])];
      }catch{}
    }
    return {id:Number(row.id),views:Math.max(0,Number(row.views)||0),
      hasCover:typeof meta.cover_key==='string'&&!!meta.cover_key,
      tags:ids.map(id=>tagLookup.get(id)).filter(Boolean)};
  });
  return Response.json({chapters},{headers:{'Cache-Control':'no-store'}});
}
