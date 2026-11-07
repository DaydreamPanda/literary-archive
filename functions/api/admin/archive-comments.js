// Super-admin moderation: approve, reject, or permanently delete anonymous comments.
import { checkAdmin, requireSuperAdmin } from '../_utils.js';
async function authOrResponse(request,env){
 const auth=await checkAdmin(request,env);
 if(!auth.ok)return Response.json({error:'请先登录作者后台'},{status:401});
 if(!requireSuperAdmin(auth))return Response.json({error:'只有超级管理员可以审核评论'},{status:403});
 return null;
}
async function ensureTable(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS archive_comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,chapter_id INTEGER NOT NULL,content TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',visitor_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT)`).run();
}
export async function onRequestGet({request,env}){
 const denied=await authOrResponse(request,env);if(denied)return denied;
 await ensureTable(env);
 const status=new URL(request.url).searchParams.get('status')||'pending';
 if(!['pending','approved','rejected'].includes(status))return Response.json({error:'状态无效'},{status:400});
 const {results}=await env.DB.prepare(`SELECT ac.id,ac.chapter_id,ac.content AS body,ac.created_at,ac.status,c.title AS chapter_title,b.title AS book_title FROM archive_comments ac LEFT JOIN chapters c ON c.id=ac.chapter_id LEFT JOIN books b ON b.id=c.book_id WHERE ac.status=? ORDER BY ac.id DESC LIMIT 100`).bind(status).all();
 return Response.json({comments:results||[]},{headers:{'Cache-Control':'no-store'}});
}
export async function onRequestPost({request,env}){
 const denied=await authOrResponse(request,env);if(denied)return denied;
 const origin=request.headers.get('Origin');if(origin && origin!==new URL(request.url).origin)return Response.json({error:'跨站操作被拒绝'},{status:403});
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return Response.json({error:'JSON required'},{status:415});
 let body;try{body=await request.json();}catch{return Response.json({error:'无效 JSON'},{status:400});}
 const id=Number(body?.id);const action=body?.action;
 if(!Number.isSafeInteger(id)||id<1||!['approve','reject','delete'].includes(action))return Response.json({error:'操作或评论编号无效'},{status:400});
 await ensureTable(env);
 if(action==='delete')await env.DB.prepare('DELETE FROM archive_comments WHERE id=?').bind(id).run();
 else await env.DB.prepare('UPDATE archive_comments SET status=?,updated_at=datetime(\'now\') WHERE id=?').bind(action==='approve'?'approved':'rejected',id).run();
 return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
}
