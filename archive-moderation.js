(()=>{
 'use strict';const $=q=>document.querySelector(q);
 const say=(msg,error=false)=>{const el=$('#mod-status');el.textContent=msg;el.style.color=error?'#a15b50':'';};
 const json=async(path,options)=>{const r=await fetch(path,{credentials:'same-origin',...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;};
 async function load(){
  const list=$('#mod-list');list.replaceChildren();say('正在读取评论…');
  try{const {comments}=await json('/api/admin/archive-comments?status='+$('#mod-filter').value);say(`共 ${comments.length} 条${$('#mod-filter').selectedOptions[0].textContent}评论，最多显示最近100条。`);
   if(!comments.length){list.textContent='当前没有评论。';return;}
   for(const c of comments){
    const el=document.createElement('article');el.className='mod-item';
    const title=document.createElement('div');title.className='eyebrow';title.textContent=(c.book_title||'已删除作品')+' / '+(c.chapter_title||'已删除章节')+' · '+c.created_at;
    const body=document.createElement('p');body.textContent=c.body;
    const buttons=document.createElement('div');buttons.className='tool-actions';
    for(const [action,label] of [['approve','通过并公开'],['reject','拒绝'],['delete','永久删除']]){
     if(action==='approve'&&c.status==='approved')continue;
     const b=document.createElement('button');b.type='button';b.className='tool-button';b.textContent=label;
     b.onclick=async()=>{if(action==='delete'&&!confirm('确定永久删除这条评论吗？'))return;b.disabled=true;
      try{await json('/api/admin/archive-comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id,action})});await load();}
      catch(e){say('处理失败：'+e.message,true);b.disabled=false;}
     };
     buttons.appendChild(b);
    }
    el.append(title,body,buttons);list.appendChild(el);
   }
  }catch(e){say('读取失败：'+e.message+'。请先登录网站管理员账号。',true);}
 }
 if(location.protocol==='file:'){say('本地演示不支持审核真实评论。部署到 Cloudflare 并登录后台后可以使用。');return;}
 $('#mod-filter').addEventListener('change',load);$('#mod-refresh').addEventListener('click',load);load();
})();
