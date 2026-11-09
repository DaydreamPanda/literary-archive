/* Read-only views display. Counts are chapter loads, not unique readers. */
(() => {
  'use strict';
  const page=document.body.dataset.page;
  if(page!=='book' && page!=='reader')return;
  const id=new URLSearchParams(location.search).get('id');
  if(!/^[1-9]\d*$/.test(id||''))return;
  const eye='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const format=n=>{n=Math.max(0,Number(n)||0);return n>=1000000?(n/1000000).toFixed(1).replace(/\.0$/,'')+'M':n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'K':String(n);};
  const badge=(count,label='阅读次数')=>{
    const e=document.createElement('span');e.className='panda-views';e.title=label+'：'+(Number(count)||0).toLocaleString()+' 次';
    e.setAttribute('aria-label',e.title);e.innerHTML=eye+'<span>'+format(count)+'</span>';return e;
  };
  function insertStyle(){
    const style=document.createElement('style');
    style.textContent=`.panda-views{display:inline-flex;align-items:center;gap:5px;color:var(--muted,#999);font-size:12px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums;vertical-align:middle}
      .panda-views svg{width:15px;height:15px;flex:none}.chapter-parent-copy .panda-views{margin-left:10px}
      .chapter-child .panda-views{margin-left:auto;margin-right:10px}.chapter-parent-copy .panda-viewline{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .read-subtitle .panda-views{margin-left:12px}.chapter-child .panda-views svg{width:13px;height:13px}
      @media(max-width:540px){.chapter-child .panda-views{margin-right:5px;font-size:11px}.chapter-parent-copy .panda-views{margin-left:0}}`;
    document.head.append(style);
  }
  let running=false,done=false;
  async function decorateBook(root){
    const res=await fetch('/api/archive-book-extras?bookId='+encodeURIComponent(id),{cache:'no-store'});
    if(!res.ok)throw Error('chapter views HTTP '+res.status);
    const data=await res.json();
    const views=new Map((data.chapters||[]).map(x=>[Number(x.id),Math.max(0,Number(x.views)||0)]));
    const linksToIds=links=>links.map(a=>{try{return Number(new URL(a.href,location.href).searchParams.get('id'));}catch{return null;}}).filter(Number.isSafeInteger);
    for(const entry of root.querySelectorAll('.chapter-entry')){
      const children=[...entry.querySelectorAll('.chapter-child')];
      const direct=entry.querySelector('.chapter-parent-link');
      const ids=linksToIds(children.length?children:direct?[direct]:[]);
      if(!ids.length)continue;
      const total=ids.reduce((sum,n)=>sum+(views.get(n)||0),0);
      const copy=entry.querySelector('.chapter-parent-copy');
      if(copy && !copy.querySelector('.panda-views')){
        const line=copy.querySelector('small');
        if(line){const container=document.createElement('span');container.className='panda-viewline';line.replaceWith(container);container.append(line,badge(total,ids.length>1?'本章各节阅读次数之和':'本节阅读次数'));}
      }
      children.forEach((link,i)=>{
        if(link.querySelector('.panda-views'))return;
        const small=link.querySelector('small');
        if(small)small.before(badge(views.get(ids[i])||0,'本节阅读次数'));
        else link.append(badge(views.get(ids[i])||0,'本节阅读次数'));
      });
    }
  }
  async function decorateReader(root){
    const res=await fetch('/api/archive-chapter-meta?chapterId='+encodeURIComponent(id),{cache:'no-store'});
    if(!res.ok)throw Error('chapter views HTTP '+res.status);
    const data=await res.json();
    const target=root.querySelector('.read-subtitle');
    if(target && !target.querySelector('.panda-views'))target.append(badge(data.meta?.views||0,'本节阅读次数'));
  }
  function start(){
    insertStyle();
    const root=document.querySelector(page==='book'?'#book-content':'#read-main');
    if(!root)return;
    const ready=()=>page==='book'?root.querySelector('.chapter-entry'):root.querySelector('.read-intro');
    const run=async()=>{
      if(running||done||!ready())return;
      running=true;
      try{if(page==='book')await decorateBook(root);else await decorateReader(root);done=true;observer.disconnect();}
      catch(e){console.warn('阅读量暂时不可用',e);}
      finally{running=false;}
    };
    const observer=new MutationObserver(()=>void run());
    observer.observe(root,{childList:true,subtree:false});
    void run();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
