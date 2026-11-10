/* Super-admin banner upload, crop position and deletion, stored in existing D1 assets. */
import { checkAdmin, requireSuperAdmin, parseJsonBody } from '../_utils.js';
import { saveAsset, deleteAsset, MAX_ASSET_BYTES } from '../_d1-storage.js';

const KEY = 'archive_banner';
const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});
async function authorize(request, env) {
  const user = await checkAdmin(request, env);
  if (!user.ok) return respond({error:'请先登录作者后台'}, 401);
  if (!requireSuperAdmin(user)) return respond({error:'仅超级管理员可以更换横幅'}, 403);
  return null;
}
async function read(env) {
  const row = await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind(KEY).first();
  try { const result=JSON.parse(row?.value||'{}');return result && typeof result==='object' && !Array.isArray(result) ? result : {}; }
  catch {return {};}
}
async function write(env, data) {
  await env.DB.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind(KEY, JSON.stringify(data)).run();
}
function positionOf(value) {
  if (value===null || value===undefined || value==='') return null;
  const p = Number(value);
  return Number.isFinite(p) && p>=0 && p<=100 ? Math.round(p) : null;
}
function validImage(bytes, type) {
  const jpeg = bytes[0]===0xff && bytes[1]===0xd8;
  const png = bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4e && bytes[3]===0x47;
  const webp = bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46 && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50;
  return (type==='image/jpeg' && jpeg)||(type==='image/png' && png)||(type==='image/webp' && webp);
}
export async function onRequestPost({request,env}) {
  const denied=await authorize(request,env);if(denied)return denied;
  const form=await request.formData();const file=form.get('file');
  const position=positionOf(form.get('position'));
  if(position===null)return respond({error:'图片位置无效'},400);
  if(!file || typeof file.arrayBuffer!=='function' || !file.size)return respond({error:'请选择横幅图片'},400);
  if(file.size>MAX_ASSET_BYTES)return respond({error:'上传的图片不能超过1 MB，请使用页面自动压缩功能'},413);
  const mime=file.type;
  if(!['image/jpeg','image/png','image/webp'].includes(mime))return respond({error:'仅支持 JPG、PNG、WebP'},400);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!validImage(bytes,mime))return respond({error:'图片内容与文件格式不符'},400);
  const old=await read(env);
  const key='archive-banner/'+crypto.randomUUID();
  const next={key,position,version:Date.now().toString(36)};
  try {
    await saveAsset(env,key,mime,bytes);
    try {await write(env,next);} catch(e) {await deleteAsset(env,key).catch(()=>{});throw e;}
    if(old.key && old.key!==key) await deleteAsset(env,old.key).catch(()=>{});
    return respond({success:true,exists:true,position,version:next.version});
  } catch(e) {console.error('Banner upload failed',e);return respond({error:'横幅保存失败，请检查 D1 存储设置'},500);}
}
export async function onRequestPut({request,env}) {
  const denied=await authorize(request,env);if(denied)return denied;
  const body=await parseJsonBody(request);
  const position=positionOf(body?.position);
  if(position===null)return respond({error:'图片位置应介于0与100之间'},400);
  const current=await read(env);
  if(!current.key)return respond({error:'请先上传图片'},409);
  await write(env,{...current,position,version:Date.now().toString(36)});
  return respond({success:true,position});
}
export async function onRequestDelete({request,env}) {
  const denied=await authorize(request,env);if(denied)return denied;
  const old=await read(env);
  await write(env,{position:50,version:Date.now().toString(36)});
  if(old.key)await deleteAsset(env,old.key).catch(e=>console.warn('Banner orphaned asset',e));
  return respond({success:true,exists:false});
}
