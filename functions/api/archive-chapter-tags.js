/* Chapter tags: default to book tags; explicit per-chapter selections can add/remove any tag.
 * Backward compatibility: legacy JSON arrays represent extra tags added to inherited book tags.
 */
import { checkAdmin, checkBookOwnership, parseJsonBody, validateId } from './_utils.js';

const respond = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
function uniqueIds(values) {
  return [...new Set(values.map(Number).filter(Number.isSafeInteger).filter(x => x > 0))];
}
function parseSetting(raw) {
  if (!raw) return {mode:'inherit', ids:[]};
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return {mode:'legacy-extra', ids:uniqueIds(data)};
    if (data && data.mode === 'custom' && Array.isArray(data.tagIds))
      return {mode:'custom', ids:uniqueIds(data.tagIds)};
  } catch {}
  return {mode:'inherit', ids:[]};
}
async function readContext(env, chapterId) {
  const chapter = await env.DB.prepare(`SELECT c.id,c.book_id,b.status
    FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=?`).bind(chapterId).first();
  if (!chapter || (chapter.status && chapter.status !== 'normal')) return null;
  const [all, assigned, saved] = await Promise.all([
    env.DB.prepare('SELECT id,name,color FROM tags ORDER BY name').all(),
    env.DB.prepare('SELECT tag_id FROM book_tags WHERE book_id=?').bind(chapter.book_id).all(),
    env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_chapter_tags_'+chapterId).first()
  ]);
  const tags = (all.results || []).map(t => ({...t, id:Number(t.id)}));
  const lookup = new Map(tags.map(t=>[t.id,t]));
  const bookIds = uniqueIds((assigned.results||[]).map(x=>x.tag_id));
  const setting = parseSetting(saved?.value);
  const ids = setting.mode === 'custom' ? setting.ids : uniqueIds([...bookIds, ...setting.ids]);
  const chosen = ids.filter(id => lookup.has(id));
  return {chapter, tags, bookIds, setting, chosen, lookup};
}
function toRows(ids, lookup) {return ids.map(id => lookup.get(id)).filter(Boolean);}
export async function onRequestGet({request,env}) {
  const id = new URL(request.url).searchParams.get('chapterId');
  if (!validateId(id||'')) return respond({error:'章节编号无效'},400);
  const context = await readContext(env,id);
  if (!context) return respond({error:'章节不存在'},404);
  const {bookIds, setting, chosen, lookup} = context;
  return respond({
    mode:setting.mode, explicit:setting.mode==='custom',
    bookTags:toRows(bookIds,lookup),
    effectiveTags:toRows(chosen,lookup),
    ownTags:toRows(chosen.filter(id=>!bookIds.includes(id)),lookup)
  });
}
export async function onRequestPut({request,env}) {
  const auth = await checkAdmin(request,env);
  if (!auth.ok) return respond({error:'请先登录后台'},401);
  const id = new URL(request.url).searchParams.get('chapterId');
  if (!validateId(id||'')) return respond({error:'章节编号无效'},400);
  const context = await readContext(env,id);
  if (!context) return respond({error:'章节不存在'},404);
  if (!await checkBookOwnership(auth,env,context.chapter.book_id))return respond({error:'无权限修改此章节'},403);
  const body = await parseJsonBody(request);
  if (!body || !Array.isArray(body.tagIds) || body.tagIds.length>20 ||
      !body.tagIds.every(id=>Number.isSafeInteger(id)&&id>0))
    return respond({error:'请选择不超过20个有效标签'},400);
  const ids=uniqueIds(body.tagIds);
  if (ids.some(id=>!context.lookup.has(id)))return respond({error:'部分标签不存在，请刷新后重试'},400);
  // An explicit empty list is meaningful: this chapter has no tags.
  await env.DB.prepare(`INSERT INTO site_settings(key,value) VALUES(?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .bind('archive_chapter_tags_'+id, JSON.stringify({mode:'custom',tagIds:ids})).run();
  return respond({success:true,mode:'custom',effectiveTags:toRows(ids,context.lookup)});
}
