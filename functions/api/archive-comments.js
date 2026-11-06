// Flat anonymous comments. Every public comment must be approved by site owner.
// No reader account, display name, IP address, or email is returned publicly.
import { sha256Hash } from './_utils.js';

async function ensureTable(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS archive_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    visitor_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_archive_comments_chapter ON archive_comments(chapter_id,status,id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_archive_comments_visitor ON archive_comments(visitor_hash,created_at)').run();
}
async function findChapter(env,id){
  return env.DB.prepare("SELECT c.id FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=? AND (b.status IS NULL OR b.status='normal')").bind(id).first();
}
export async function onRequestGet({request,env}){
  const chapterId=new URL(request.url).searchParams.get('chapterId');
  if(!/^[1-9]\d*$/.test(chapterId||''))return Response.json({error:'章节编号无效'},{status:400});
  if(!await findChapter(env,chapterId))return Response.json({error:'章节不存在'},{status:404});
  await ensureTable(env);
  const {results}=await env.DB.prepare("SELECT id,body,created_at FROM archive_comments WHERE chapter_id=? AND status='approved' ORDER BY id DESC LIMIT 60").bind(chapterId).all();
  return Response.json({comments:results||[]},{headers:{'Cache-Control':'no-store'}});
}
export async function onRequestPost({request,env}){
  const origin=request.headers.get('Origin');
  if(origin && origin !== new URL(request.url).origin)return Response.json({error:'跨站提交被拒绝'},{status:403});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return Response.json({error:'请使用 JSON 格式'},{status:415});
  if(!env.ARCHIVE_COMMENT_SECRET || String(env.ARCHIVE_COMMENT_SECRET).length<24)return Response.json({error:'站点还未启用评论，请联系作者'},{status:503});
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip)return Response.json({error:'当前访问环境无法验证提交频率'},{status:503});
  const text=await request.text();
  if(text.length>5000)return Response.json({error:'评论内容过长'},{status:413});
  let data;try{data=JSON.parse(text);}catch{return Response.json({error:'JSON 无效'},{status:400});}
  if(typeof data?.contact==='string' && data.contact.trim())return Response.json({success:true,pending:true},{status:202});
  const chapterId=Number(data?.chapterId);
  const body=typeof data?.body==='string'?data.body.trim():'';
  if(!Number.isSafeInteger(chapterId)||chapterId<1||body.length<2||body.length>1000)return Response.json({error:'请填写 2 至 1000 字的评论'},{status:400});
  if(/https?:\/\/|www\./i.test(body))return Response.json({error:'评论暂不允许附带链接'},{status:400});
  if(!await findChapter(env,chapterId))return Response.json({error:'章节不存在'},{status:404});
  const visitorHash=await sha256Hash(String(env.ARCHIVE_COMMENT_SECRET)+':'+ip);
  await ensureTable(env);
  const recent=await env.DB.prepare("SELECT COUNT(*) AS count FROM archive_comments WHERE visitor_hash=? AND created_at>=datetime('now','-2 minutes')").bind(visitorHash).first();
  const daily=await env.DB.prepare("SELECT COUNT(*) AS count FROM archive_comments WHERE visitor_hash=? AND created_at>=datetime('now','-1 day')").bind(visitorHash).first();
  if((recent?.count||0)>=1||(daily?.count||0)>=5)return Response.json({error:'评论太频繁，请稍后再试'},{status:429});
  await env.DB.prepare("INSERT INTO archive_comments(chapter_id,body,status,visitor_hash) VALUES(?,?,'pending',?)").bind(chapterId,body,visitorHash).run();
  return Response.json({success:true,pending:true,message:'评论待作者审核'},{status:202});
}
