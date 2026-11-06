// Author-only: map existing Novel Site leaf chapters into big chapter groups.
import { checkAdmin, requireSuperAdmin, parseJsonBody } from '../_utils.js';

export async function onRequestPut({request,env}) {
  const auth=await checkAdmin(request,env);
  if(!auth.ok)return Response.json({error:'请先登录后台'},{status:401});
  if(!requireSuperAdmin(auth))return Response.json({error:'仅网站所有者可编辑目录'},{status:403});
  const bookId = new URL(request.url).searchParams.get('bookId');
  if(!/^[1-9]\d*$/.test(bookId||''))return Response.json({error:'作品编号无效'},{status:400});
  const book=await env.DB.prepare('SELECT id FROM books WHERE id=?').bind(bookId).first();
  if(!book)return Response.json({error:'作品不存在'},{status:404});
  const payload=await parseJsonBody(request);
  if(!Array.isArray(payload?.items)||payload.items.length>500)return Response.json({error:'章节结构必须是数组，最多500节'},{status:400});
  const owned=await env.DB.prepare('SELECT id FROM chapters WHERE book_id=?').bind(bookId).all();
  const ids=new Set((owned.results||[]).map(r=>Number(r.id)));
  const seen=new Set();const items=[];
  for(const x of payload.items){
    if(!x||!Number.isSafeInteger(Number(x.chapterId))||!ids.has(Number(x.chapterId))||seen.has(Number(x.chapterId)))return Response.json({error:'章节编号不属于本作品，或出现重复章节'},{status:400});
    if(typeof x.groupTitle!=='string'||!x.groupTitle.trim()||x.groupTitle.length>200)return Response.json({error:'大章标题不能为空且不能超过200字'},{status:400});
    if(typeof x.sectionTitle!=='string'||x.sectionTitle.length>200)return Response.json({error:'小节标题不能超过200字'},{status:400});
    if(!['main','extra'].includes(x.kind))return Response.json({error:'分类必须为正文或番外'},{status:400});
    const item={chapterId:Number(x.chapterId),groupTitle:x.groupTitle.trim(),sectionTitle:x.sectionTitle.trim(),kind:x.kind};
    seen.add(item.chapterId);items.push(item);
  }
  await env.DB.prepare('INSERT OR REPLACE INTO site_settings (key,value) VALUES (?,?)')
    .bind('archive_structure_'+bookId,JSON.stringify(items)).run();
  return Response.json({success:true,count:items.length},{headers:{'Cache-Control':'no-store'}});
}
