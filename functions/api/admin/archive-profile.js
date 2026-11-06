// Author-only profile editor, backed by existing D1 site_settings.
import { checkAdmin, requireSuperAdmin, parseJsonBody } from '../_utils.js';

const isHttps = s => typeof s === 'string' && /^https:\/\/[^\s]+$/i.test(s) && s.length <= 500;

export async function onRequestPut({request,env}) {
  const auth = await checkAdmin(request, env);
  if (!auth.ok) return Response.json({error:'请先登录作者后台'}, {status:401});
  if (!requireSuperAdmin(auth)) return Response.json({error:'仅站点所有者可以修改作者资料'}, {status:403});
  const body = await parseJsonBody(request);
  const input = body?.profile;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Response.json({error:'Profile 必须是对象'}, {status:400});
  }
  for(const field of ['authorName','biography','announcement','avatarUrl']){
    if(typeof input[field] !== 'string') return Response.json({error:field+' 格式错误'}, {status:400});
  }
  if(input.avatarUrl && !isHttps(input.avatarUrl)) return Response.json({error:'头像地址必须以 https:// 开头'}, {status:400});
  if(!Array.isArray(input.links) || input.links.length > 8 || input.links.some(x=> !x || typeof x.label !== 'string' || x.label.length>35 || !isHttps(x.url))) {
    return Response.json({error:'外部链接最多8条，必须为 HTTPS 地址'}, {status:400});
  }
  const profile={
    authorName:input.authorName.trim().slice(0,80),
    biography:input.biography.trim().slice(0,1200),
    announcement:input.announcement.trim().slice(0,1800),
    avatarUrl:input.avatarUrl.trim(),
    links:input.links.map(x=>({label:x.label.trim(),url:x.url.trim()}))
  };
  await env.DB.prepare("INSERT OR REPLACE INTO site_settings (key,value) VALUES ('archive_profile',?)")
    .bind(JSON.stringify(profile)).run();
  return Response.json({success:true,profile}, {headers:{'Cache-Control':'no-store'}});
}
