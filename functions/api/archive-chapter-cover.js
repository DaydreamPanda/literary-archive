// Read a public chapter's optional D1-stored cover image.
import {validateId} from './_utils.js';
import {getAsset} from './_d1-storage.js';
export async function onRequestGet({request,env}){
  const id=new URL(request.url).searchParams.get('chapterId');
  if(!validateId(id||''))return new Response('Not found',{status:404});
  const row=await env.DB.prepare('SELECT b.status FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=?').bind(id).first();
  if(!row || (row.status&&row.status!=='normal'))return new Response('Not found',{status:404});
  const setting=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_chapter_meta_'+id).first();
  let meta={};try{meta=JSON.parse(setting?.value||'{}');}catch{}
  if(typeof meta.cover_key!=='string')return new Response('Not found',{status:404});
  const image=await getAsset(env,meta.cover_key);
  if(!image || !['image/jpeg','image/png','image/webp'].includes(image.mimeType))return new Response('Not found',{status:404});
  return new Response(image.bytes.buffer,{headers:{'Content-Type':image.mimeType,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=300'}});
}
