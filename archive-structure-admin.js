(()=>{
 'use strict';
 const $=s=>document.querySelector(s);const status=$('#structure-status');
 const say=(s,bad=false)=>{status.textContent=s;status.style.color=bad?'#a15b50':'';};
 const json=async(path,options)=>{const r=await fetch(path,{credentials:'same-origin',...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;};
 let books=[];
 async function init(){
  if(location.protocol==='file:'){say('本地演示无法保存目录。请部署到 Cloudflare 并登录 /admin.html。');return;}
  try{
   const me=await json('/api/me');if(me.role!=='super_admin')throw Error('需要超级管理员权限');
   books=(await json('/api/books')).books||[];
   if(!books.length){say('请先在原后台创建作品和章节。');return;}
   const select=$('#structure-book');books.forEach(b=>{const option=document.createElement('option');option.value=b.id;option.textContent=b.title;select.appendChild(option);});
   const id=new URLSearchParams(location.search).get('bookId');if(id&&books.some(b=>String(b.id)===id))select.value=id;
   $('#structure-tools').classList.remove('hidden');select.addEventListener('change',load);
   $('#save-structure').addEventListener('click',save);
   $('#preview-structure').addEventListener('click',showSummary);
   await load();
  }catch(e){say('无法打开编辑器：'+e.message+'。请检查是否已经登录 /admin.html。',true);}
 }
 async function load(){
  const id=$('#structure-book').value;$('#structure-preview').href='./book.html?id='+id;
  say('正在加载章节…');
  try{
   const [book,structure]=await Promise.all([json('/api/books/'+id),json('/api/archive-structure?bookId='+id)]);
   const existing=new Map((structure.items||[]).map(item=>[Number(item.chapterId),item]));
   const tbody=$('#structure-rows');tbody.replaceChildren();
   const chapters=(book.chapters||[]).slice().sort((a,b)=>a.sort_order-b.sort_order);
   for(const ch of chapters){
    const meta=existing.get(Number(ch.id));const tr=document.createElement('tr');tr.dataset.chapterId=String(ch.id);
    const label=document.createElement('td');label.dataset.label='原章节';label.textContent=String(ch.sort_order)+' · '+ch.title;
    const groupCell=document.createElement('td');groupCell.dataset.label='所属大章';const group=document.createElement('input');group.className='field-input group-title';group.maxLength=200;group.required=true;group.value=meta?.groupTitle||ch.title;group.placeholder='例如：第一章 北风入盛京';groupCell.appendChild(group);
    const sectionCell=document.createElement('td');sectionCell.dataset.label='节标题';const section=document.createElement('input');section.className='field-input section-title';section.maxLength=200;section.value=meta?.sectionTitle??ch.title;section.placeholder='例如：第一节 故人';sectionCell.appendChild(section);
    const typeCell=document.createElement('td');typeCell.dataset.label='分类';const type=document.createElement('select');type.className='field-input chapter-kind';[['main','正文'],['extra','番外']].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;type.appendChild(option);});type.value=meta?.kind||(/番外|外传|特别篇|补遗/.test(ch.title)?'extra':'main');typeCell.appendChild(type);
    tr.append(label,groupCell,sectionCell,typeCell);tbody.appendChild(tr);
   }
   say(`已读取《${book.book.title}》的 ${chapters.length} 个实际正文单元。修改后点击保存。`);showSummary();
  }catch(e){say('加载章节失败：'+e.message,true);}
 }
 function collect(){
  return [...document.querySelectorAll('#structure-rows tr')].map(tr=>({chapterId:Number(tr.dataset.chapterId),groupTitle:tr.querySelector('.group-title').value.trim(),sectionTitle:tr.querySelector('.section-title').value.trim(),kind:tr.querySelector('.chapter-kind').value}));
 }
 function showSummary(){
  const groups=new Map();collect().forEach(x=>{const key=x.kind+' | '+x.groupTitle;groups.set(key,(groups.get(key)||0)+1);});
  $('#structure-summary').textContent=[...groups].map(([title,count])=>`${title}：${count} 节${count>1?'（可展开）':'（直接阅读）'}`).join('　　')||'这个系列还没有章节';
 }
 async function save(){
  const items=collect();if(items.some(x=>!x.groupTitle)){say('每个章节都必须有「所属大章」',true);return;}
  const btn=$('#save-structure');btn.disabled=true;say('正在保存章节结构…');
  try{const data=await json('/api/admin/archive-structure?bookId='+$('#structure-book').value,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});say(`保存成功，共 ${data.count} 节。现在可以打开系列页预览。`);showSummary();}
  catch(e){say('保存失败：'+e.message,true);}finally{btn.disabled=false;}
 }
 init();
})();
