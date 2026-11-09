/* Homepage single-work direct-reading links + visible reading counts.
 * Preserves existing archive.js book cards and search/tag filtering.
 */
(() => {
  'use strict';
  if (document.body.dataset.page !== 'home') return;
  const number = n => Number(n).toLocaleString('en-US');
  const validId = v => /^[1-9]\d*$/.test(String(v ?? ''));
  let records = new Map();
  let ready = false;
  function getBookId(card) {
    try {
      const url = new URL(card.getAttribute('href'), location.href);
      if (!/\/book\.html$/.test(url.pathname)) return null;
      const id=url.searchParams.get('id');
      return validId(id)?Number(id):null;
    } catch { return null; }
  }
  function enhanceCard(card, single) {
    const bookId=getBookId(card) || Number(card.dataset.pandaBookId);
    const item=records.get(bookId);
    if (!item) return;
    card.dataset.pandaBookId=String(bookId);
    const meta=card.querySelector('.book-meta');
    if(meta) {
      let metric=meta.querySelector('.panda-home-views');
      if(!metric) {
        metric=document.createElement('span');
        metric.className='panda-home-views';
        meta.append(metric);
      }
      const total=Number(item.reads)||0;
      metric.textContent='';
      const icon=document.createElement('span');
      icon.className='panda-home-eye';
      icon.setAttribute('aria-hidden','true');icon.textContent='◉';
      metric.append(icon,document.createTextNode(' '+number(total)));
      metric.title=number(total)+' 次章节正文加载（含重复访问）';
      metric.setAttribute('aria-label',number(total)+' 次阅读');
    }
    // Each single work has one real chapter. For accidental multi-chapter
    // single-tagged books, keep its table of contents accessible.
    if(single && item.chapterCount===1 && validId(item.chapterId)) {
      card.href='./read.html?id='+item.chapterId;
      card.setAttribute('aria-label',(card.querySelector('h3')?.textContent||'单篇作品')+'，直接阅读正文');
    }
  }
  function enhance() {
    if(!ready) return;
    for (const card of document.querySelectorAll('#single-list a.book-card'))enhanceCard(card,true);
    for (const card of document.querySelectorAll('#series-list a.book-card'))enhanceCard(card,false);
  }
  async function start() {
    const single=document.querySelector('#single-list');
    const series=document.querySelector('#series-list');
    if(!single || !series)return;
    const css=document.createElement('style');
    css.textContent='.panda-home-views{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;margin-left:10px;color:var(--ink-soft, #9a8f80);font-variant-numeric:tabular-nums}.panda-home-eye{font-size:13px;line-height:1}.panda-home-views:hover{color:var(--ink, #443b35)}';
    document.head.append(css);
    const observer=new MutationObserver(enhance);
    observer.observe(single,{childList:true});observer.observe(series,{childList:true});
    try {
      const r=await fetch('/api/archive-home-reads',{credentials:'same-origin',cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      const data=await r.json();
      records=new Map((data.books||[]).map(x=>[Number(x.bookId),x]));
      ready=true;enhance();
    } catch(e) {console.warn('首页阅读量暂不可用:',e.message);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else void start();
})();
