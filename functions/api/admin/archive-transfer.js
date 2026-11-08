/* POST /api/admin/archive-transfer
 * Move existing D1 chapter IDs between books without rewriting bodies, covers,
 * standalone chapter tags, comments, likes or the public chapter URLs.
 * Whole source group => group transfer, one leaf => single chapter transfer.
 */
import {checkAdmin, requireSuperAdmin, parseJsonBody} from '../_utils.js';

const idOK=x=>/^[1-9]\d*$/.test(String(x??''));
const normal=b=>b&&(!b.status||b.status==='normal');
const short=s=>String(s??'').trim().slice(0,200);
const fail=(error,status=400)=>Response.json({error},{status});
const isSingle=tags=>(tags||[]).some(x=>/(^单篇$|短篇|one.?shot)/i.test(x.name));
async function readStructure(env,id) {
  const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_structure_'+id).first();
  try {const parsed=JSON.parse(row?.value||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}
}
function structureFor(chapters,raw){
  const meta=new Map(raw.map(x=>[Number(x.chapterId),x]));
  return chapters.map(ch=>{
    const x=meta.get(Number(ch.id))||{};
    return {chapterId:Number(ch.id),groupTitle:short(x.groupTitle)||short(ch.title),
      sectionTitle:short(x.sectionTitle)||short(ch.title),
      kind:x.kind==='extra'||(!x.kind&&/(番外|外传|特别篇|补遗)/.test(ch.title))?'extra':'main'};
  });
}
export async function onRequestPost({request,env}){
  const auth=await checkAdmin(request,env);
  if(!auth.ok)return fail('请先登录作者后台',401);
  if(!requireSuperAdmin(auth))return fail('仅网站所有者可以移动章节',403);
  const body=await parseJsonBody(request);
  const sourceId=String(body?.sourceBookId||'');
  const rawIds=body?.chapterIds;
  if(!idOK(sourceId)||!Array.isArray(rawIds)||rawIds.length<1||rawIds.length>500||rawIds.some(x=>!idOK(x)))
    return fail('来源作品及章节编号无效');
  const movingSet=new Set(rawIds.map(Number));
  if(movingSet.size!==rawIds.length)return fail('有重复的章节编号');
  const mode=body?.mode;
  if(mode!=='new_single'&&mode!=='existing')return fail('目标类型无效');
  if(mode==='new_single'&&(!short(body?.newTitle)||String(body?.newTitle).trim().length>200))return fail('新单篇作品标题需要1至200字');
  if(mode==='existing'&&(!idOK(body?.targetBookId)||sourceId===String(body.targetBookId)))return fail('请选择另一本系列作品');
  if(body?.targetGroupTitle!=null&&(!short(body.targetGroupTitle)||String(body.targetGroupTitle).trim().length>200))return fail('目标大章标题需要1至200字');

  const source=await env.DB.prepare('SELECT id,title,author,cover_key,status FROM books WHERE id=?').bind(sourceId).first();
  if(!normal(source))return fail('来源作品不存在或已下架',404);
  const sourceRows=(await env.DB.prepare('SELECT id,title,sort_order FROM chapters WHERE book_id=? ORDER BY sort_order,id').bind(sourceId).all()).results||[];
  if(sourceRows.length>500)return fail('来源作品章节数超过500，暂不支持迁移');
  if(sourceRows.filter(x=>movingSet.has(Number(x.id))).length!==movingSet.size)return fail('部分章节已不属于来源作品，请刷新工作台',409);
  const oldSource=structureFor(sourceRows,await readStructure(env,sourceId));
  const moved=oldSource.filter(x=>movingSet.has(x.chapterId));
  const remain=oldSource.filter(x=>!movingSet.has(x.chapterId));
  const sourceGroupKeys=new Set(moved.map(x=>x.kind+'\u0000'+x.groupTitle));
  if(sourceGroupKeys.size!==1)return fail('一次只能移动一个完整大章或单个小节');
  if(moved.length>1){
    const sameGroup=oldSource.filter(x=>x.kind===moved[0].kind&&x.groupTitle===moved[0].groupTitle);
    if(sameGroup.length!==moved.length)return fail('请选择整个大章的全部小节，或只选择其中一个小节');
  }

  const hideEmptySource=body.hideEmptySource===true && remain.length===0;
  let destination=null,targetId=null,created=false,copyKey=null;
  if(mode==='existing'){
    destination=await env.DB.prepare('SELECT id,status,title FROM books WHERE id=?').bind(body.targetBookId).first();
    if(!normal(destination))return fail('目标作品不存在或已经下架',404);
    const tags=(await env.DB.prepare('SELECT t.name FROM tags t JOIN book_tags bt ON bt.tag_id=t.id WHERE bt.book_id=?').bind(destination.id).all()).results||[];
    if(isSingle(tags))return fail('目标需要选择系列作品；单篇管理可在作品下拉框中操作');
    targetId=Number(destination.id);
  }

  const remainingTarget=mode==='existing'
    ?(await env.DB.prepare('SELECT id,title,sort_order FROM chapters WHERE book_id=? ORDER BY sort_order,id').bind(targetId).all()).results||[]
    :[];
  const oldTarget=mode==='existing'?structureFor(remainingTarget,await readStructure(env,targetId)):[];
  if(remainingTarget.length+moved.length>500)return fail('目标书籍最多管理500个章节');
  const targetGroup=short(body?.targetGroupTitle)||moved[0].groupTitle;
  const incoming=moved.map(item=>({...item,groupTitle:targetGroup}));
  let targetItems=oldTarget;
  if(mode==='existing'){
    const matching=oldTarget.map((x,i)=>({...x,index:i})).filter(x=>x.groupTitle===targetGroup&&x.kind===incoming[0].kind);
    const insertion=matching.length?matching[matching.length-1].index+1:oldTarget.length;
    targetItems=[...oldTarget.slice(0,insertion),...incoming,...oldTarget.slice(insertion)];
    // The chapter studio stores contiguous groups. A name collision in a different type is allowed.
  }

  try{
    if(mode==='new_single'){
      const nTitle=String(body.newTitle).trim();
      const description=String(body.newDescription||'').trim().slice(0,2000);
      const insert=await env.DB.prepare('INSERT INTO books (title,description,author,created_by) VALUES (?,?,?,?)')
        .bind(nTitle,description,source.author||'',auth.userId).run();
      targetId=Number(insert.meta?.last_row_id);
      if(!idOK(targetId))throw Error('创建单篇作品失败');
      created=true;
      // A standalone is a book with the 单篇 tag; this is how the homepage classifies works.
      await env.DB.prepare("INSERT OR IGNORE INTO tags(name,color) VALUES ('单篇','#888')").run();
      const tag=(await env.DB.prepare("SELECT id FROM tags WHERE name='单篇'").first());
      const inherited=(await env.DB.prepare(`SELECT t.id,t.name FROM tags t
        JOIN book_tags bt ON bt.tag_id=t.id WHERE bt.book_id=? ORDER BY t.id`).bind(sourceId).all()).results||[];
      const ids=[...new Set([...inherited.filter(x=>!/(^连载中$|^单篇$|^短篇$|one.?shot)/i.test(x.name)).slice(0,19).map(x=>Number(x.id)),Number(tag.id)])];
      // Tag attachment is within the transfer batch below.
      body.__tagIds=ids;
      targetItems=incoming;
    }

    const stmts=[];
    // A new work gets its own cover asset; never share an asset key with a chapter,
    // because later deleting one cover would otherwise break the other.
    if(created){
      for(const id of movingSet){
        const metaRow=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_chapter_meta_'+id).first();
        let meta={};try{meta=JSON.parse(metaRow?.value||'{}')||{};}catch{}
        if(typeof meta.cover_key==='string'&&meta.cover_key){
          const asset=await env.DB.prepare('SELECT asset_key FROM archive_assets WHERE asset_key=?').bind(meta.cover_key).first().catch(()=>null);
          if(asset){copyKey=meta.cover_key;break;}
        }
      }
      if(!copyKey&&source.cover_key){
        const a=await env.DB.prepare('SELECT asset_key FROM archive_assets WHERE asset_key=?').bind(source.cover_key).first().catch(()=>null);
        if(a)copyKey=source.cover_key;
      }
      if(copyKey){
        const newKey='covers/'+targetId+'/'+crypto.randomUUID();
        stmts.push(env.DB.prepare(`INSERT INTO archive_assets(asset_key,mime_type,bytes)
          SELECT ?,mime_type,bytes FROM archive_assets WHERE asset_key=?`).bind(newKey,copyKey));
        stmts.push(env.DB.prepare('UPDATE books SET cover_key=? WHERE id=?').bind(newKey,targetId));
      }
      for(const tagId of body.__tagIds){stmts.push(env.DB.prepare('INSERT OR IGNORE INTO book_tags(book_id,tag_id) VALUES (?,?)').bind(targetId,tagId));}
    }
    // Retain existing chapter IDs (and thus covers/comments/likes/tags/read links).
    targetItems.forEach((item,i)=>{
      if(movingSet.has(item.chapterId)){
        stmts.push(env.DB.prepare(`UPDATE chapters SET book_id=?, sort_order=?,
          version=COALESCE(version,0)+1, updated_at=datetime('now') WHERE id=? AND book_id=?`)
          .bind(targetId,i+1,item.chapterId,sourceId));
      }else{
        stmts.push(env.DB.prepare('UPDATE chapters SET sort_order=? WHERE id=? AND book_id=?').bind(i+1,item.chapterId,targetId));
      }
    });
    remain.forEach((item,i)=>stmts.push(env.DB.prepare('UPDATE chapters SET sort_order=? WHERE id=? AND book_id=?').bind(i+1,item.chapterId,sourceId)));
    const writeStructure=(id,items)=>env.DB.prepare(`INSERT INTO site_settings(key,value) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind('archive_structure_'+id,JSON.stringify(items));
    stmts.push(writeStructure(sourceId,remain),writeStructure(targetId,targetItems));
    stmts.push(env.DB.prepare("UPDATE books SET updated_at=datetime('now') WHERE id IN (?,?)").bind(sourceId,targetId));
    if(hideEmptySource)stmts.push(env.DB.prepare("UPDATE books SET status='unlisted',delete_at=NULL WHERE id=?").bind(sourceId));
    // Legacy annotations reference both book_id and chapter_id, unlike current anonymous comments.
    const at=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='annotations'").first();
    if(at){
      const fields=(await env.DB.prepare('PRAGMA table_info(annotations)').all()).results||[];
      if(fields.some(x=>x.name==='book_id')&&fields.some(x=>x.name==='chapter_id')){
        const placeholders=moved.map(()=>'?').join(',');
        stmts.push(env.DB.prepare('UPDATE annotations SET book_id=? WHERE chapter_id IN ('+placeholders+')').bind(targetId,...moved.map(x=>x.chapterId)));
      }
    }
    await env.DB.batch(stmts);
    return Response.json({success:true,sourceBookId:Number(sourceId),targetBookId:targetId,
      created, movedCount:moved.length, sourceEmpty:remain.length===0,sourceHidden:hideEmptySource},
      {headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error('Transfer failed',error);
    if(created){
      // On a failed D1 batch there are no moved chapters, so an empty new book
      // can be removed safely. Do not touch the source or nonempty target.
      const left=await env.DB.prepare('SELECT COUNT(*) AS count FROM chapters WHERE book_id=?').bind(targetId).first().catch(()=>null);
      if(left?.count===0){
        await env.DB.prepare('DELETE FROM book_tags WHERE book_id=?').bind(targetId).run().catch(()=>{});
        await env.DB.prepare('DELETE FROM books WHERE id=? AND NOT EXISTS(SELECT 1 FROM chapters WHERE book_id=?)').bind(targetId,targetId).run().catch(()=>{});
      }
    }
    return fail('移动失败。请刷新工作台，确认章节位置后再试。',500);
  }
}
