/* Per-chapter additional tags. Book tags remain inherited automatically.
 * Stored as a JSON list of existing tag IDs under site_settings.
 * No schema migration or new D1 tables required.
 */
import {checkAdmin,checkBookOwnership,parseJsonBody,validateId} from './_utils.js';

function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
function idsFrom(raw){
  try{const value=JSON.parse(raw || '[]');return Array.isArray(value) ? [...new Set(value.map(Number).filter(Number.isSafeInteger).filter(x=>x>0))].slice(0,20):[];}
  catch{return [];}
}
async function chapterAndBook(env,id){
  return env.DB.prepare('SELECT c.id,c.book_id,b.status FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=?').bind(id).first();
}
async function currentIds(env,id){
  const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_chapter_tags_'+id).first();
  return idsFrom(row?.value);
}
async function tagRows(env,ids){
  if(!ids.length)return [];
  const q=ids.map(()=>'?').join(',');
  const {results}=await env.DB.prepare(`SELECT id,name,color FROM tags WHERE id IN (${q})`).bind(...ids).all();
  const lookup=new Map((results||[]).map(x=>[Number(x.id),x]));
  return ids.map(id=>lookup.get(Number(id))).filter(Boolean);
}
export async function onRequestGet({request,env}){
  const id=new URL(request.url).searchParams.get('chapterId');
  if(!validateId(id||''))return json({error:'章节编号无效'},400);
  const chapter=await chapterAndBook(env,id);
  if(!chapter||(chapter.status&&chapter.status!=='normal'))return json({error:'章节不存在'},404);
  const [extraIds,bookTags]=await Promise.all([
    currentIds(env,id),
    env.DB.prepare('SELECT t.id,t.name,t.color FROM book_tags bt JOIN tags t ON t.id=bt.tag_id WHERE bt.book_id=?').bind(chapter.book_id).all()
  ]);
  return json({ownTags:await tagRows(env,extraIds),bookTags:bookTags.results||[]});
}
export async function onRequestPut({request,env}){
  const auth=await checkAdmin(request,env);
  if(!auth.ok)return json({error:'请先登录后台'},401);
  const id=new URL(request.url).searchParams.get('chapterId');
  if(!validateId(id||''))return json({error:'章节编号无效'},400);
  const chapter=await chapterAndBook(env,id);
  if(!chapter)return json({error:'章节不存在'},404);
  if(!await checkBookOwnership(auth,env,chapter.book_id))return json({error:'无权限修改此章节'},403);
  const data=await parseJsonBody(request);
  if(!data||!Array.isArray(data.tagIds)||data.tagIds.length>20)return json({error:'最多选择20个标签'},400);
  if(!data.tagIds.every(v=>Number.isSafeInteger(v)&&v>0))return json({error:'标签编号无效'},400);
  const ids=[...new Set(data.tagIds)];
  const existing=await tagRows(env,ids);
  if(existing.length!==ids.length)return json({error:'部分标签不存在，请刷新后重试'},400);
  await env.DB.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind('archive_chapter_tags_'+id,JSON.stringify(ids)).run();
  return json({success:true,ownTags:existing});
}
