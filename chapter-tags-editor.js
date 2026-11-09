/* Chapter-only tags: inherited book tags start checked, but every tag is editable.
 * The old BOOK DETAILS area stays in DOM for legacy editor listeners, but is hidden.
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const valid = id => /^[1-9]\d*$/.test(String(id || ''));
  const api=async(url,opts={})=>{
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.error||'HTTP '+r.status);
    return data;
  };
  const json=(data,method='PUT')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  let all=[], inherited=new Set(), selected=new Set(), initial='[]', busy=false, started=false;
  const ordered = () => [...selected].sort((a,b)=>a-b);
  const label = (msg,bad=false) => {const el=$('#panda-tag-status');if(el){el.textContent=msg;el.classList.toggle('is-error',bad);}};
  function updateButton(){
    const btn=$('#panda-save-tags'); if(!btn)return;
    const ready=valid(new URLSearchParams(location.search).get('id'));
    btn.disabled=busy||!ready||JSON.stringify(ordered())===initial;
    if(!ready)label('发布本节正文之后，即可保存标签。');
  }
  function render(){
    const common=$('#panda-inherited-tags'), additional=$('#panda-chapter-tags');
    common.replaceChildren();additional.replaceChildren();
    for(const tag of all){
      const id=Number(tag.id);
      const item=document.createElement('label');item.className='tag-check';
      const check=document.createElement('input');check.type='checkbox';check.value=String(id);check.checked=selected.has(id);
      check.addEventListener('change',()=>{if(check.checked)selected.add(id);else selected.delete(id);updateButton();});
      const name=document.createElement('span');name.textContent=tag.name;item.append(check,name);
      (inherited.has(id)?common:additional).append(item);
    }
    if(!common.children.length)common.textContent='本书没有设定 Tag。';
    if(!additional.children.length)additional.textContent='没有其他 Tag，可以在下面新建。';
    updateButton();
  }
  async function hydrate(){
    const id=new URLSearchParams(location.search).get('id');
    const allData=await api('/api/admin/tags');all=allData.tags||[];
    if(valid(id)){
      const data=await api('/api/archive-chapter-tags?chapterId='+id);
      inherited=new Set((data.bookTags||[]).map(t=>Number(t.id)));
      selected=new Set((data.effectiveTags||[]).map(t=>Number(t.id)));
    }else{
      const bookId=new URLSearchParams(location.search).get('book');
      const info=valid(bookId)?await api('/api/books/'+bookId):{book:{tags:[]}};
      inherited=new Set((info.book?.tags||[]).map(t=>Number(t.id)));
      selected=new Set(inherited);  // Default checked for a newly created chapter.
    }
    initial=JSON.stringify(ordered());render();
  }
  async function save(){
    const id=new URLSearchParams(location.search).get('id');
    if(!valid(id)){label('请先发布本节正文。',true);return;}
    if(busy)return;
    busy=true;updateButton();
    try{
      const res=await api('/api/archive-chapter-tags?chapterId='+id,json({tagIds:ordered()}));
      selected=new Set((res.effectiveTags||[]).map(t=>Number(t.id)));
      initial=JSON.stringify(ordered());
      label('本节 Tag 已保存 ✓');render();
    }catch(e){label('保存失败：'+e.message,true);}
    finally{busy=false;updateButton();}
  }
  async function create(){
    const field=$('#panda-new-tag'),name=field.value.trim();if(!name)return;
    try{
      const result=await api('/api/admin/tags',json({name},'POST'));
      all.push(result.tag);selected.add(Number(result.tag.id));field.value='';
      render();label('Tag 已创建并勾选，记得保存本节 Tag。');
    }catch(e){label('新建失败：'+e.message,true);}
  }
  function start(){
    if(started)return;started=true;
    // Keep hidden legacy inputs alive so the existing chapter-editor.js does not throw.
    const legacy=$('#book-description')?.closest('.editor-side-card');
    if(legacy){legacy.hidden=true;legacy.style.display='none';}
    const aside=$('.metadata-column .editor-side-card');
    if(!aside)return;
    const panel=document.createElement('section');panel.className='editor-side-card';panel.id='panda-chapter-tags-panel';
    panel.innerHTML=`<div class="eyebrow">CHAPTER TAGS / 本节标签</div>
      <h2>本节 Tag</h2>
      <p class="side-note">书籍的 Tag 默认勾选。可以取消不适合本节的标签，也可以添加其他标签。保存后只影响本节。</p>
      <div class="editor-label">来自整本书（可取消）</div>
      <div class="tag-options" id="panda-inherited-tags"></div>
      <div class="editor-label">其他标签（可勾选）</div>
      <div class="tag-options" id="panda-chapter-tags"></div>
      <div class="tag-create"><input type="text" id="panda-new-tag" maxlength="50" placeholder="新建 Tag"><button type="button" class="editor-button light" id="panda-create-tag">添加</button></div>
      <p class="side-status" id="panda-tag-status" aria-live="polite"></p>
      <button type="button" id="panda-save-tags" class="editor-button primary side-action" disabled>保存本节 Tag</button>`;
    aside.after(panel);
    $('#panda-save-tags').addEventListener('click',()=>void save());
    $('#panda-create-tag').addEventListener('click',()=>void create());
    $('#panda-new-tag').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void create();}});
    void hydrate().catch(e=>label('标签读取失败：'+e.message,true));
    // chapter-editor.js replaces URL when new chapter is first published.
    let previous=location.search;
    const observer=new MutationObserver(()=>{
      if(location.search!==previous){
        const wasNew=!valid(new URLSearchParams(previous).get('id'));
        previous=location.search;
        // Preserve any checkbox changes made before the first publication.
        if(wasNew){updateButton();label('正文已发布，现在可以保存本节 Tag。');}
        else void hydrate().catch(e=>label(e.message,true));
      }
    });
    observer.observe($('#save-btn'),{attributes:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
