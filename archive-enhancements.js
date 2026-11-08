/* Layered on top of archive.js without replacing its reading, comments, or likes code.
 * Fixes book chapter thumbnail covers and renders per-chapter additional tags.
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const validId = x => /^[1-9]\d*$/.test(String(x || ''));
  const chapterFromLink = link => {
    if (!link) return null;
    try { const id = new URL(link.href, location.href).searchParams.get('id'); return validId(id) ? Number(id) : null; }
    catch { return null; }
  };
  const addImage = (box, url, fallback, title) => {
    if (!box || box.querySelector('img') || (!url && !fallback)) return;
    const img = document.createElement('img');img.loading = 'lazy';img.alt=title+'封面';
    let didFallback=false;
    img.onerror=()=>{
      if(!didFallback && fallback && img.src!==new URL(fallback,location.href).href){didFallback=true;img.src=fallback;}
      else img.remove();
    };
    img.src=url||fallback;
    if(img.src)box.append(img);
  };
  const addTags = (where, incoming, inherited = []) => {
    if (!where || !incoming?.length) return;
    const have = new Set((inherited||[]).map(x => x.name));
    const wrap = document.createElement('span'); wrap.className='chapter-entry-tags';
    for (const tag of incoming) {
      if (!tag?.name || have.has(tag.name)) continue;
      have.add(tag.name);
      const el=document.createElement('span');el.className='tag';el.textContent=tag.name;wrap.append(el);
    }
    if (wrap.children.length) where.append(wrap);
  };
  async function enhanceBook() {
    const root=$('#book-content'), bookId=new URLSearchParams(location.search).get('id');
    if (!root || !validId(bookId) || !root.querySelector('.chapter-entry')) return;
    if (root.dataset.pandaExtras==='done') return;
    root.dataset.pandaExtras='done';
    const [extras,bookInfo] = await Promise.all([
      fetch('/api/archive-book-extras?bookId='+encodeURIComponent(bookId),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('metadata '+r.status);return r.json();}),
      fetch('/api/books/'+encodeURIComponent(bookId),{cache:'no-store'}).then(r=>r.json())
    ]);
    const map=new Map((extras.chapters||[]).map(c=>[Number(c.id),c]));
    const inherited=bookInfo.book?.tags||[];
    const fallback = bookInfo.book?.cover_key ? '/api/covers/'+bookId : '';
    for(const entry of root.querySelectorAll('.chapter-entry')){
      const links=[...entry.querySelectorAll('.chapter-children .chapter-child')];
      if (!links.length){const direct=entry.querySelector('.chapter-parent-link');if(direct)links.push(direct);}
      const ids=links.map(chapterFromLink).filter(Boolean);
      if(!ids.length)continue;
      const selected=ids.find(id=>map.get(id)?.hasCover);
      const thumb=entry.querySelector('.cover-art');
      const url=selected?'/api/archive-chapter-cover?chapterId='+selected:'';
      addImage(thumb,url,fallback,entry.querySelector('.chapter-parent-copy h3')?.textContent||'章节');
      const ownTags=[];const seen=new Set();
      for(const id of ids){for(const tag of map.get(id)?.tags||[]){if(tag?.name&&!seen.has(tag.name)){ownTags.push(tag);seen.add(tag.name);}}}
      addTags(entry.querySelector('.chapter-parent-copy'),ownTags,inherited);
    }
    // A visible area is useful when the book has no assigned tags yet.
    const seriesTagList=root.querySelector('.series-info > .story-tags');
    if(seriesTagList && !seriesTagList.children.length) {
      seriesTagList.classList.add('panda-no-tags');seriesTagList.textContent='暂无作品标签，可在作者写作页添加';
    }
  }
  async function enhanceReader() {
    const root=$('#read-main'),chapterId=new URLSearchParams(location.search).get('id');
    if(!root||!validId(chapterId)||!root.querySelector('.read-intro'))return;
    if(root.dataset.pandaExtras==='done')return;
    root.dataset.pandaExtras='done';
    const response=await fetch('/api/archive-chapter-tags?chapterId='+encodeURIComponent(chapterId),{cache:'no-store'});
    if(!response.ok)return;
    const data=await response.json();
    let list=root.querySelector('.read-intro .story-tags');
    if(!list){list=document.createElement('div');list.className='story-tags';root.querySelector('.read-intro .read-subtitle')?.after(list);}
    const existing=new Set([...list.querySelectorAll('.tag')].map(x=>x.textContent));
    for (const t of data.ownTags||[]) {
      if(!t?.name||existing.has(t.name))continue;
      const el=document.createElement('span');el.className='tag';el.textContent=t.name;list.append(el);existing.add(t.name);
    }
    if (!list.children.length){list.classList.add('panda-no-tags');list.textContent='暂无标签';}
  }
  function startup() {
    const style=document.createElement('style');
    style.textContent='.chapter-entry-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.chapter-entry-tags .tag{font-size:10px;padding:3px 8px}.panda-no-tags{font-size:12px;color:var(--muted);min-height:16px}';
    document.head.append(style);
    const target=document.body.dataset.page==='book'?$('#book-content') : document.body.dataset.page==='reader'?$('#read-main'):null;
    if(!target)return;
    let running=false;
    const enhance=async()=>{
      if(running)return;
      running=true;
      try{if(document.body.dataset.page==='book')await enhanceBook();else await enhanceReader();}
      catch(e){console.warn('Chapter card metadata unavailable',e);target.dataset.pandaExtras='';}
      finally{running=false;}
    };
    // archive.js replaces the container once data arrives.
    const observer=new MutationObserver(()=>{if(target.querySelector('.chapter-entry, .read-intro'))void enhance();});
    observer.observe(target,{childList:true});
    void enhance();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startup,{once:true});else startup();
})();
