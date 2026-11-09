/* Decorative chapter thumbnails plus editable per-chapter tag display.
 * Existing reader and book data still come from archive.js.
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const validId = x => /^[1-9]\d*$/.test(String(x||''));
  function chapterFromLink(link){
    if(!link)return null;
    try{const id=new URL(link.href,location.href).searchParams.get('id');return validId(id)?Number(id):null;}
    catch{return null;}
  }
  function addImage(box,url,fallback,title){
    if(!box||box.querySelector('img')||(!url&&!fallback))return;
    const img=document.createElement('img');img.loading='lazy';img.alt=title+'封面';
    let usedFallback=false;
    img.onerror=()=>{
      if(!usedFallback&&fallback&&img.src!==new URL(fallback,location.href).href){usedFallback=true;img.src=fallback;}
      else img.remove();
    };
    img.src=url||fallback;
    box.append(img);
  }
  function appendTags(where,items){
    if(!where||!items.length)return;
    const wrap=document.createElement('span');wrap.className='chapter-entry-tags';
    for(const tag of items){
      if(!tag?.name)continue;
      const el=document.createElement('span');el.className='tag';el.textContent=tag.name;wrap.append(el);
    }
    if(wrap.children.length)where.append(wrap);
  }
  async function enhanceBook(){
    const root=$('#book-content'),bookId=new URLSearchParams(location.search).get('id');
    if(!root||!validId(bookId)||!root.querySelector('.chapter-entry')||root.dataset.pandaExtras==='done')return;
    root.dataset.pandaExtras='done';
    const [extras,bookInfo]=await Promise.all([
      fetch('/api/archive-book-extras?bookId='+encodeURIComponent(bookId),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('metadata '+r.status);return r.json();}),
      fetch('/api/books/'+encodeURIComponent(bookId),{cache:'no-store'}).then(r=>r.json())
    ]);
    const map=new Map((extras.chapters||[]).map(c=>[Number(c.id),c]));
    const bookTags=bookInfo.book?.tags||[];
    const fallback=bookInfo.book?.cover_key?'/api/covers/'+bookId:'';
    for(const entry of root.querySelectorAll('.chapter-entry')){
      const links=[...entry.querySelectorAll('.chapter-children .chapter-child')];
      if(!links.length){const direct=entry.querySelector('.chapter-parent-link');if(direct)links.push(direct);}
      const ids=links.map(chapterFromLink).filter(Boolean);
      if(!ids.length)continue;
      const first=ids.find(id=>map.get(id)?.hasCover);
      const url=first?'/api/archive-chapter-cover?chapterId='+first:'';
      addImage(entry.querySelector('.cover-art'),url,fallback,entry.querySelector('.chapter-parent-copy h3')?.textContent||'章节');
      // A card shows all tags present in its section(s), without assuming the book tags are mandatory.
      const all=[],seen=new Set();
      for(const id of ids)for(const tag of map.get(id)?.tags||[]){
        if(tag?.name&&!seen.has(tag.name)){all.push(tag);seen.add(tag.name);}
      }
      // Avoid repeating every inherited tag when all sections use exactly the book defaults.
      const defaultNames=new Set(bookTags.map(t=>t.name));
      const isDefault=ids.every(id=>{
        const names=new Set((map.get(id)?.tags||[]).map(t=>t.name));
        return names.size===defaultNames.size&&[...defaultNames].every(n=>names.has(n));
      });
      if(!isDefault)appendTags(entry.querySelector('.chapter-parent-copy'),all);
    }
    const seriesList=root.querySelector('.series-info > .story-tags');
    if(seriesList&&!seriesList.children.length){
      seriesList.classList.add('panda-no-tags');seriesList.textContent='暂无作品标签，可在作者后台添加';
    }
  }
  async function enhanceReader(){
    const root=$('#read-main'),chapterId=new URLSearchParams(location.search).get('id');
    if(!root||!validId(chapterId)||!root.querySelector('.read-intro')||root.dataset.pandaExtras==='done')return;
    root.dataset.pandaExtras='done';
    const r=await fetch('/api/archive-chapter-tags?chapterId='+encodeURIComponent(chapterId),{cache:'no-store'});
    if(!r.ok)throw Error('chapter tags '+r.status);
    const data=await r.json();
    let list=root.querySelector('.read-intro .story-tags');
    if(!list){list=document.createElement('div');list.className='story-tags';root.querySelector('.read-intro .read-subtitle')?.after(list);}
    // archive.js initially renders book tags. Replace them with this chapter's actual selection.
    list.replaceChildren();list.classList.remove('panda-no-tags');
    for(const tag of data.effectiveTags||[]){
      if(!tag?.name)continue;
      const el=document.createElement('span');el.className='tag';el.textContent=tag.name;list.append(el);
    }
    if(!list.children.length){list.classList.add('panda-no-tags');list.textContent='本节暂无标签';}
  }
  function startup(){
    const style=document.createElement('style');
    style.textContent='.chapter-entry-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.chapter-entry-tags .tag{font-size:10px;padding:3px 8px}.panda-no-tags{font-size:12px;color:var(--muted);min-height:16px}';
    document.head.append(style);
    const target=document.body.dataset.page==='book'?$('#book-content'):document.body.dataset.page==='reader'?$('#read-main'):null;
    if(!target)return;
    let running=false;
    async function enhance(){
      if(running)return;running=true;
      try{if(document.body.dataset.page==='book')await enhanceBook();else await enhanceReader();}
      catch(e){console.warn('Chapter metadata unavailable',e);target.dataset.pandaExtras='';}
      finally{running=false;}
    }
    const observer=new MutationObserver(()=>{if(target.querySelector('.chapter-entry, .read-intro'))void enhance();});
    observer.observe(target,{childList:true});void enhance();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startup,{once:true});else startup();
})();
