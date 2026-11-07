// Author edit of optional per-chapter intro/cover. Uses existing D1 tables.
import {checkAdmin,validateId,checkBookOwnership,parseJsonBody} from '../_utils.js';
import {saveAsset,deleteAsset,MAX_ASSET_BYTES} from '../_d1-storage.js';
async function authorize(request,env){
  const auth=await checkAdmin(request,env);
  if(!auth.ok)return {error:Response.json({error:'请先登录作者后台'},{status:401})};
  const id=new URL(request.url).searchParams.get('chapterId');
  if(!validateId(id||''))return {error:Response.json({error:'Invalid chapterId'},{status:400})};
  const chapter=await env.DB.prepare('SELECT id,book_id FROM chapters WHERE id=?').bind(id).first();
  if(!chapter)return {error:Response.json({error:'章节不存在'},{status:404})};
  if(!await checkBookOwnership(auth,env,chapter.book_id))return {error:Response.json({error:'无权限编辑此章节'},{status:403})};
  return {id};
}
async function readMeta(env,id){
  const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_chapter_meta_'+id).first();
  try{const meta=JSON.parse(row?.value||'{}');return meta&&typeof meta==='object'&&!Array.isArray(meta)?meta:{};}catch{return {};}
}
async function writeMeta(env,id,meta){
  await env.DB.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind('archive_chapter_meta_'+id,JSON.stringify(meta)).run();
}
export async function onRequestPut({request,env}){
  const {id,error}=await authorize(request,env);if(error)return error;
  const body=await parseJsonBody(request);
  if(!body||typeof body.summary!=='string'||body.summary.length>800)return Response.json({error:'章节简介最多800字符'},{status:400});
  const meta=await readMeta(env,id);meta.summary=body.summary.trim();
  await writeMeta(env,id,meta);
  return Response.json({success:true});
}
export async function onRequestPost({request,env}){
  const {id,error}=await authorize(request,env);if(error)return error;
  const fd=await request.formData();const file=fd.get('file');
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)return Response.json({error:'请上传图片'},{status:400});
  if(file.size>MAX_ASSET_BYTES)return Response.json({error:'章节封面不能超过1MB'},{status:413});
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return Response.json({error:'仅支持JPEG、PNG、WebP'},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const jpg=bytes[0]===0xff&&bytes[1]===0xd8;
  const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
  const webp=bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50;
  if(!((file.type==='image/jpeg'&&jpg)||(file.type==='image/png'&&png)||(file.type==='image/webp'&&webp)))return Response.json({error:'图片格式校验失败'},{status:400});
  const key='chapter-covers/'+id+'/'+crypto.randomUUID();
  const old=await readMeta(env,id);
  try{
    await saveAsset(env,key,file.type,bytes);
    try{await writeMeta(env,id,{...old,cover_key:key});}
    catch(e){await deleteAsset(env,key).catch(()=>{});throw e;}
    if(old.cover_key)await deleteAsset(env,old.cover_key).catch(()=>{});
    return Response.json({success:true});
  }catch(e){console.error('Chapter cover save failed',e);return Response.json({error:'封面写入失败'},{status:500});}
}
export async function onRequestDelete({request,env}){
  const {id,error}=await authorize(request,env);if(error)return error;
  const meta=await readMeta(env,id);
  const oldKey=meta.cover_key;delete meta.cover_key;
  await writeMeta(env,id,meta);
  if(oldKey)await deleteAsset(env,oldKey).catch(()=>{});
  return Response.json({success:true});
}
