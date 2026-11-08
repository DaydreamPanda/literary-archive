/* Optional chapter-only tags panel. Book tags are inherited via existing APIs.
 * Sits beside chapter-editor.js; changing tags never overwrites chapter body.
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const valid = id => /^[1-9]\d*$/.test(String(id||''));
  const api=async(url,opts={})=>{
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts});
    const value=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(value.error||'HTTP '+r.status);
    return value;
  };
  const payload=(data,method='PUT')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  let tagList=[],owned=new Set(),inherited=new Set(),initial='[]';
  let currentChapter='';
  let selected=new Set();
  function status(msg,bad=false){const el=$('#panda-tag-status');el.textContent=msg;el.classList.toggle('is-error',bad);}
  function selections(){return [...selected].sort((a,b)=>a-b);}
  function updateButton(){
    const button=$('#panda-save-tags'),id=new URLSearchParams(location.search).get('id');
    const ready=valid(id);
    button.disabled=!ready||JSON.stringify(selections())===initial;
    if(!ready)status('先发布这一节正文，再保存独立标签。');
  }
  function render(){
    const inheritedBox=$('#panda-inherited-tags'),box=$('#panda-chapter-tags');
    inheritedBox.replaceChildren();box.replaceChildren();
    for(const tag of tagList.filter(t=>inherited.has(Number(t.id)))){
      const chip=document.createElement('span');chip.className='tag';chip.textContent=tag.name;inheritedBox.append(chip);
    }
    if(!inheritedBox.children.length)inheritedBox.textContent='本书暂未设置标签';
    for(const tag of tagList.filter(t=>!inherited.has(Number(t.id)))){
      const label=document.createElement('label');label.className='tag-check';
      const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(Number(tag.id));input.value=tag.id;
      input.addEventListener('change',()=>{if(input.checked)selected.add(Number(tag.id));else selected.delete(Number(tag.id));updateButton();});
      const title=document.createElement('span');title.textContent=tag.name;
      label.append(input,title);box.append(label);
    }
    if(!box.children.length)box.textContent='暂无可添加的独立标签，可在下面新建。';
    updateButton();
  }
  async function hydrate(){
    const id=new URLSearchParams(location.search).get('id');
    const all=await api('/api/admin/tags');tagList=all.tags||[];
    const bookId=valid(id)?(await api('/api/chapters/'+id)).chapter.book_id:new URLSearchParams(location.search).get('book');
    if(valid(bookId)){
      const book=await api('/api/books/'+bookId);
      inherited=new Set((book.book?.tags||[]).map(t=>Number(t.id)));
    }
    selected.clear();
    if(valid(id)){
      const res=await api('/api/archive-chapter-tags?chapterId='+id);
      selected=new Set((res.ownTags||[]).map(t=>Number(t.id)).filter(x=>!inherited.has(x)));
    }
    initial=JSON.stringify(selections());currentChapter=id||'';render();
  }
  async function save(){
    const id=new URLSearchParams(location.search).get('id');
    if(!valid(id)){status('请先发布章节正文。',true);return;}
    const button=$('#panda-save-tags');button.disabled=true;
    try{
      const data=await api('/api/archive-chapter-tags?chapterId='+id,payload({tagIds:selections()}));
      initial=JSON.stringify((data.ownTags||[]).map(x=>Number(x.id)).sort((a,b)=>a-b));
      status('章节 Tag 已保存 ✓');
    }catch(e){status('保存失败：'+e.message,true);}
    finally{updateButton();}
  }
  async function create(){
    const input=$('#panda-new-tag'),name=input.value.trim();if(!name)return;
    try{
      const r=await api('/api/admin/tags',payload({name},'POST'));
      tagList.push(r.tag);selected.add(Number(r.tag.id));input.value='';render();status('已新建标签，记得点击保存章节 Tag。');
    }catch(e){status('新建失败：'+e.message,true);}
  }
  function start(){
    const aside=$('.metadata-column .editor-side-card');
    if(!aside)return;
    const panel=document.createElement('section');panel.className='editor-side-card';panel.id='panda-chapter-tags-panel';
    panel.innerHTML='<div class="eyebrow">CHAPTER TAGS / 本节标签</div><h2>独立 Tag</h2>'+
      '<p class="side-note">书籍 Tag 自动继承。下面可额外给当前章节添加标签。</p>'+
      '<div class="editor-label">继承自整本书</div><div class="tag-options" id="panda-inherited-tags"></div>'+
      '<div class="editor-label">本节额外标签</div><div class="tag-options" id="panda-chapter-tags"></div>'+
      '<div class="tag-create"><input type="text" id="panda-new-tag" maxlength="50" placeholder="新建标签"><button class="editor-button light" type="button" id="panda-create-tag">添加</button></div>'+
      '<p class="side-status" id="panda-tag-status" aria-live="polite"></p>'+
      '<button type="button" id="panda-save-tags" class="editor-button primary side-action" disabled>保存章节 Tag</button>';
    aside.after(panel);
    $('#panda-save-tags').addEventListener('click',()=>void save());
    $('#panda-create-tag').addEventListener('click',()=>void create());
    $('#panda-new-tag').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void create();}});
    void hydrate().catch(e=>status('标签读取失败：'+e.message,true));
    // After a new chapter is published, chapter-editor.js replaces the URL via history.replaceState.
    // The panel remains usable immediately afterward, without refreshing the writing page.
    let previous=location.search;
    const observer=new MutationObserver(()=>{
      if(location.search!==previous){previous=location.search;void hydrate().catch(e=>status(e.message,true));}
    });
    observer.observe($('#save-btn'),{attributes:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
