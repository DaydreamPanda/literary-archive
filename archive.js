/* Reader-facing functionality for Novel Site. No frameworks required. */
(() => {
 'use strict';
 const q = new URLSearchParams(location.search);
 const demo = q.get('demo') === '1' || location.protocol === 'file:';
 const $ = s => document.querySelector(s);
 const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const demoData = {
   books: [
     {id:1,title:'盛京旧梦',author:'作者笔名',description:'城外有风雪，城内有故人。几卷旧事，写尽人心冷暖。',cover_key:null,chapter_count:8,total_words:27510,updated_at:'2026-11-05',tags:[{id:1,name:'历史架空'},{id:2,name:'连载中'}]},
     {id:2,title:'山河遗事',author:'作者笔名',description:'关于往日的城池、远去的故友，以及那些无人提起的故事。',cover_key:null,chapter_count:3,total_words:15420,updated_at:'2026-10-20',tags:[{id:1,name:'历史架空'},{id:3,name:'已完结'}]},
     {id:3,title:'未寄出的信',author:'作者笔名',description:'一封短笺，留在故事结束之后。',cover_key:null,chapter_count:1,total_words:3820,updated_at:'2026-09-12',tags:[{id:4,name:'单篇'},{id:5,name:'短篇'}]}
   ],
   chapters: [
     {id:101,book_id:1,title:'第一节 风起城门',word_count:1580,sort_order:1},
     {id:102,book_id:1,title:'第二节 旧书',word_count:1440,sort_order:2},
     {id:103,book_id:1,title:'第三节 灯火',word_count:1520,sort_order:3},
     {id:104,book_id:1,title:'第四节 故人',word_count:1580,sort_order:4},
     {id:105,book_id:1,title:'第二章 旧人赴前尘',word_count:7110,sort_order:5},
     {id:106,book_id:1,title:'第一节 晚钟',word_count:3410,sort_order:6},
     {id:107,book_id:1,title:'第二节 宫墙',word_count:3580,sort_order:7},
     {id:108,book_id:1,title:'番外 · 灯下书',word_count:7290,sort_order:8},
     {id:201,book_id:2,title:'第一章 故城',word_count:5140,sort_order:1},
     {id:202,book_id:2,title:'第二章 远山',word_count:5140,sort_order:2},
     {id:203,book_id:2,title:'第三章 归处',word_count:5140,sort_order:3},
     {id:301,book_id:3,title:'未寄出的信',word_count:3820,sort_order:1}
   ]
 };

 const demoStructure = {
   1: [
     ...[101,102,103,104].map(id=>({chapterId:id,groupTitle:'第一章 北风入盛京',sectionTitle:demoData.chapters.find(c=>c.id===id).title,kind:'main'})),
     {chapterId:105,groupTitle:'第二章 旧人赴前尘',sectionTitle:'',kind:'main'},
     ...[106,107].map(id=>({chapterId:id,groupTitle:'第三章 明月照深宫',sectionTitle:demoData.chapters.find(c=>c.id===id).title,kind:'main'})),
     {chapterId:108,groupTitle:'番外 · 灯下书',sectionTitle:'',kind:'extra'}
   ]
 };
 function link(path){return './'+path+(demo ? (path.includes('?') ? '&':'?')+'demo=1' : '');}
 async function api(path){
   if(demo){
     if(path==='/api/books')return {books:demoData.books};
     if(path==='/api/archive-profile')return {profile:window.ARCHIVE_CONFIG};
     if(path==='/api/settings')return {settings:{}};
     if(path.startsWith('/api/archive-structure?')){const id=Number(new URLSearchParams(path.split('?')[1]).get('bookId'));return {items:demoStructure[id]||[]};}
     if(path.startsWith('/api/archive-comments?')){const id=Number(new URLSearchParams(path.split('?')[1]).get('chapterId'));return {comments:readDemoComments(id)};}
     if(path.startsWith('/api/archive-likes?')){const id=Number(new URLSearchParams(path.split('?')[1]).get('chapterId'));return {...readDemoLikes(id),enabled:true};}

     const bm=path.match(/^\/api\/books\/(\d+)$/);
     if(bm){const book=demoData.books.find(b=>b.id===+bm[1]);if(!book)throw Error('作品不存在');return {book,chapters:demoData.chapters.filter(c=>c.book_id===book.id)};}
     const cm=path.match(/^\/api\/chapters\/(\d+)$/);
     if(cm){const chapter=demoData.chapters.find(c=>c.id===+cm[1]);if(!chapter)throw Error('章节不存在');const cs=demoData.chapters.filter(c=>c.book_id===chapter.book_id);const i=cs.findIndex(c=>c.id===chapter.id);return {chapter:{...chapter,book_title:demoData.books.find(b=>b.id===chapter.book_id).title},content:demoText(chapter.title),prevChapter:cs[i-1]||null,nextChapter:cs[i+1]||null};}
   }
   const res=await fetch(path,{credentials:'same-origin'});
   if(!res.ok) throw Error('服务器返回 '+res.status);
   return res.json();
 }
 function demoText(title){return `有诗为证：\n\n山河远去人犹在，纸上微灯照旧年。\n一卷春秋多少事，且从此处说从前。\n\n话说这一日，天气初寒。城门外行人寥落，街边的茶肆尚有一盏灯火，映得窗纸微黄。\n\n有人推门而入，抖落肩上风霜，将一封旧信放在桌边。信封上墨迹已淡，仍看得见当年落笔时的迟疑。\n\n“许多年了，”掌柜望着那封信，缓缓说道，“如今怎么又想起这桩事来？”\n\n来人没有即刻作答，只向窗外望了一眼。夜色渐浓，檐下的风铃发出细碎声响。\n\n${title}的故事，就从这寂静的一夜开始。\n\n（此处是演示文字。网站上线后会自动读取你在 Novel Site 后台发布的真实章节内容。）`;}
 let profile={...(window.ARCHIVE_CONFIG||{})};
 async function initProfile(){
   try{const [a,b]=await Promise.all([api('/api/archive-profile'),api('/api/settings')]);profile={...profile,...(a.profile||{})};if(b.settings?.site_name)profile.siteName=b.settings.site_name;if(b.settings?.site_desc&&!profile.announcement)profile.announcement=b.settings.site_desc;}
   catch(e){ if(!demo) console.warn('公开个人资料使用默认设置:',e.message);}
   document.querySelectorAll('[data-site-name]').forEach(el=>el.textContent=profile.siteName||'私人文学档案馆');
   document.querySelectorAll('[data-author-name]').forEach(el=>el.textContent=profile.authorName||'作者');
   document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
   return profile;
 }
 function cover(book, cls='cover-mini'){
   const safeTitle=esc(book?.title||'作品');
   const initials=esc((book?.title||'卷').slice(0,4));
   return `<div class="cover-art ${cls}"><span class="cover-mark">${initials}</span><span class="cover-subtitle">LITERARY ARCHIVE</span>${book?.cover_key ? `<img loading="lazy" src="/api/covers/${Number(book.id)}" alt="${safeTitle}封面" onerror="this.remove()">`:''}</div>`;
 }
 function tags(items){return `<div class="story-tags">${(items||[]).map(t=>`<span class="tag">${esc(t.name)}</span>`).join('')}</div>`;}
 function makeHead(){return `<header class="site-head"><a class="site-identity" href="${link('index.html')}"><span class="site-seal">文</span><span><span class="site-name" data-site-name>私人文学档案馆</span><span class="site-kicker">Personal Literary Archive</span></span></a><nav class="site-nav"><a href="${link('index.html')}">首页</a><a href="${link('index.html')}#works">作品目录</a><a href="./admin.html">作者后台</a><button type="button" class="icon-button theme-toggle" aria-label="切换夜间模式" title="切换夜间模式">☾</button></nav></header>`;}
 function footer(){return `<footer class="archive-footer"><div>© <span data-year></span> <span data-site-name>私人文学档案馆</span> · ALL STORIES RESERVED</div><div><a href="./archive-admin.html">编辑作者资料</a> · 18+ 内容提示 · <a href="https://github.com/xingzihai/novel-site" target="_blank" rel="noopener noreferrer">Powered by Novel Site</a></div></footer>`;}
 function heading(title,en=''){return `<div class="page-heading"><h2>${esc(title)}</h2>${en ? `<span class="eyebrow">${esc(en)}</span>`:''}</div>`;}
 function toast(message){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el);}el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200);}
 function ageGate(){
   try{if(localStorage.getItem('archive-18-confirmed')==='yes')return;}catch{}
   const el=document.createElement('div');el.className='age-curtain';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','成年读者确认');
   el.innerHTML=`<div class="age-card"><div class="age-stamp">18+</div><h2>成年读者确认</h2><p>本站收录可能含有成人主题与露骨描写的文学作品。请确认你已达到所在地区法律规定的成年年龄，并愿意自愿浏览此类内容。</p><button type="button" class="age-accept">我已成年，进入网站</button><button type="button" class="age-decline">我未成年，退出网站</button><p class="age-note">点击确认只提供基础年龄提示，无法代替法律要求的年龄验证。</p></div>`;
   document.body.appendChild(el);document.body.style.overflow='hidden';
   const focus=el.querySelector('.age-accept'); focus.focus();
   el.querySelector('.age-accept').onclick=()=>{try{localStorage.setItem('archive-18-confirmed','yes');}catch{}el.remove();document.body.style.overflow='';};
   el.querySelector('.age-decline').onclick=()=>{document.body.innerHTML='<main class="admin-shell" style="text-align:center"><h1>访问已结束</h1><p>本网站仅向已达到当地法定成年年龄的读者开放。</p></main>';document.body.style.overflow='';};
 }
 function initTheme(){let theme='paper';try{theme=localStorage.getItem('archive-theme')||'paper';}catch{}document.documentElement.dataset.archiveTheme=theme;document.querySelectorAll('.theme-toggle').forEach(b=>{b.textContent=theme==='night'?'☀':'☾';b.onclick=()=>{theme=theme==='night'?'paper':'night';document.documentElement.dataset.archiveTheme=theme;try{localStorage.setItem('archive-theme',theme);}catch{}document.querySelectorAll('.theme-toggle').forEach(el=>el.textContent=theme==='night'?'☀':'☾');};});}
 function mount(){const head=$('#site-header'),ft=$('#site-footer');if(head)head.innerHTML=makeHead();if(ft)ft.innerHTML=footer();initTheme();ageGate();}
 function classify(b){return (b.tags||[]).some(t=>/(^单篇$|短篇|one.?shot)/i.test(t.name))?'single':'series';}
 function card(b){return `<a class="book-card" href="${link('book.html?id='+b.id)}">${cover(b)}<div class="book-card-main"><h3>${esc(b.title)}</h3><div class="book-meta">${esc((b.tags||[]).map(t=>t.name).slice(0,2).join(' · ')) || '原创作品'} · ${Number(b.chapter_count)||0} 章 · ${((Number(b.total_words)||0)/10000).toFixed(1)} 万字</div><p class="book-excerpt">${esc(b.description||'暂无简介。')}</p></div><span class="arr" aria-hidden="true">›</span></a>`;}
 async function home(){await initProfile();
   $('#author-name').textContent=profile.authorName||'作者笔名';$('#author-bio').textContent=profile.biography||'';$('#announcement').textContent=profile.announcement||'暂无公告';
   if(profile.avatarUrl&&/^https:\/\//i.test(profile.avatarUrl)){$('#avatar').innerHTML=`<img src="${esc(profile.avatarUrl)}" alt="作者头像">`;}else{$('#avatar').textContent=(profile.authorName||'文').slice(0,1);}
   const links=$('#social-links');links.innerHTML='';
   const validLinks=(profile.links||[]).filter(item=>item && /^https:\/\//i.test(item.url));
   if(validLinks.length){validLinks.forEach(item=>{
     const a=document.createElement('a');a.className='platform-link';a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';
     const symbol=document.createElement('span');symbol.className='platform-monogram';symbol.textContent=(item.label||'?').slice(0,1).toUpperCase();
     const label=document.createElement('span');label.textContent=item.label;a.append(symbol,label);links.appendChild(a);
   });}else{
     ['Pixiv','X','AO3'].forEach(name=>{const item=document.createElement('div');item.className='platform-placeholder';item.innerHTML='<span class="platform-monogram"></span><span></span>';item.children[0].textContent=name[0];item.children[1].textContent=name+' · 待设置';links.appendChild(item);});
     const hint=document.createElement('div');hint.className='platform-hint';hint.textContent='可在作者后台添加实际链接';links.appendChild(hint);
   }
   let books=[];
try {
  books = ((await api('/api/books')).books || [])
    .filter(b => !b.status || b.status === 'normal');
}catch(e){$('#series-list').innerHTML=`<div class="error">作品加载失败：${esc(e.message)}。请确认已部署 Novel Site 的 API。${!demo?'<a href="?demo=1">查看演示</a>':''}</div>`;return;}
   if(demo)$('#demo-indicator').classList.remove('hidden');
   const input=$('#search-books'),chips=$('#tag-filters');let active='全部';const tagNames=['全部',...new Set(books.flatMap(b=>(b.tags||[]).map(t=>t.name)))];
   function draw(){const term=input.value.trim().toLowerCase();let filtered=books.filter(b=>(active==='全部'||(b.tags||[]).some(t=>t.name===active))&&(!term||[b.title,b.author,b.description,...(b.tags||[]).map(t=>t.name)].join(' ').toLowerCase().includes(term)));const series=filtered.filter(b=>classify(b)==='series'),single=filtered.filter(b=>classify(b)==='single');$('#series-list').innerHTML=series.length?series.map(card).join(''):'<div class="archive-empty">此分类暂无系列作品</div>';$('#single-list').innerHTML=single.length?single.map(card).join(''):'<div class="archive-empty">此分类暂无单篇作品</div>';$('#series-count').textContent=series.length+' 部';$('#single-count').textContent=single.length+' 部';}
   chips.innerHTML=tagNames.map(t=>`<button type="button" class="chip ${t==='全部'?'is-active':''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');chips.addEventListener('click',e=>{const b=e.target.closest('[data-tag]');if(!b)return;active=b.dataset.tag;chips.querySelectorAll('button').forEach(btn=>btn.classList.toggle('is-active',btn===b));draw();});input.addEventListener('input',draw);draw();
 }
 // Groups are presentation metadata. Every leaf is an ordinary Novel Site chapter.
 // A parent with one leaf goes straight to the reader; 2+ leaves expand to sections.
 function structureGroups(chapters,items){
   const map=new Map((Array.isArray(items)?items:[]).map(x=>[Number(x.chapterId),x]));
   const groups=[];const byKey=new Map();
   chapters.forEach(ch=>{
     const meta=map.get(Number(ch.id))||{};
     const extra = meta.kind === 'extra' || (meta.kind !== 'main' && /(番外|外传|特别篇|补遗)/i.test(ch.title));
     const kind=extra?'extra':'main';
     const title=String(meta.groupTitle||ch.title).trim().slice(0,200);
     const key=kind+':'+title;
     if(!byKey.has(key)){const group={title,kind,children:[]};groups.push(group);byKey.set(key,group);}
     byKey.get(key).children.push({...ch,sectionTitle:String(meta.sectionTitle||ch.title).trim().slice(0,200)});
   });
   return groups;
 }
 function renderGroups(title,groups,book){
   if(!groups.length)return '';
   let html=`<section class="chapter-section">${heading(title,groups.length+' CHAPTERS')}<div class="chapter-collection-hint">${title==='正文'?'点击章节进入阅读，含多节的章节可展开目录。':'番外与正文独立排列。'}</div><div class="chapter-stack">`;
   groups.forEach((group,i)=>{
     const multi=group.children.length>1;
     const words=group.children.reduce((n,c)=>n+(Number(c.word_count)||0),0);
     const groupId=title+'-'+i;
     const main=`${cover({title:group.title})}<span class="chapter-parent-copy"><h3>${esc(group.title)}</h3><small>${multi?`共 ${group.children.length} 节 · `:''}约 ${words} 字</small></span>`;
     html+=`<div class="chapter-entry">`;
     if(multi){
       html+=`<button class="chapter-parent" type="button" aria-expanded="false" aria-controls="${esc(groupId)}">${main}<span class="chapter-chevron" aria-hidden="true">⌄</span></button>`;
       html+=`<div class="chapter-children hidden" id="${esc(groupId)}">${group.children.map(c=>`<a class="chapter-child" href="${link('read.html?id='+c.id)}"><span>${esc(c.sectionTitle)}</span><small>${Number(c.word_count)||0} 字 ›</small></a>`).join('')}</div>`;
     }else{
       html+=`<a class="chapter-parent-link" href="${link('read.html?id='+group.children[0].id)}">${main}<span class="arr">›</span></a>`;
     }
     html+='</div>';
   });
   return html+'</div></section>';
 }
 async function book(){
   await initProfile();
   const id=q.get('id');if(!/^\d+$/.test(id||'')){$('#book-content').innerHTML='<div class="error">作品编号无效</div>';return;}
   try{
     const data=await api('/api/books/'+id);
     const b=data.book;
     const cs=(data.chapters||[]).slice().sort((a,b)=>a.sort_order-b.sort_order);
     let items=[];
     try{items=(await api('/api/archive-structure?bookId='+id)).items||[];}catch(e){console.warn('章节结构使用默认目录:',e.message);}
     const groups=structureGroups(cs,items);
     const main=groups.filter(g=>g.kind==='main'),extra=groups.filter(g=>g.kind==='extra');
     document.title=b.title+' · '+profile.siteName;
     $('#crumb-title').textContent=b.title;
     $('#book-content').innerHTML=`<div class="series-top">${cover(b,'series-cover')}<div class="series-info"><div class="eyebrow">SERIES ARCHIVE / ${String(b.id).padStart(3,'0')}</div><h1>${esc(b.title)}</h1><div class="series-meta"><span>作者 ${esc(b.author||profile.authorName||'')}</span><span>${main.length} 章 · ${cs.length} 节/篇</span><span>更新于 ${esc(String(b.updated_at||'').slice(0,10))}</span></div><div class="series-description">${esc(b.description||'尚未填写作品简介。')}</div>${tags(b.tags)}</div></div>${renderGroups('正文',main,b)}${renderGroups('番外',extra,b)}${cs.length?'':'<div class="archive-empty">这个系列暂时还没有章节</div>'}<div class="tool-actions hidden" id="owner-structure-link"><a class="soft-btn" href="${link('archive-structure.html?bookId='+id)}">编辑本系列章节结构</a></div>`;
     $('#book-content').querySelectorAll('.chapter-parent').forEach(btn=>btn.addEventListener('click',()=>{
       const el=document.getElementById(btn.getAttribute('aria-controls'));const isOpen=btn.getAttribute('aria-expanded')==='true';
       btn.setAttribute('aria-expanded',String(!isOpen));el.classList.toggle('hidden',isOpen);
     }));
     if(!demo){api('/api/me').then(me=>{if(me.role==='super_admin')$('#owner-structure-link')?.classList.remove('hidden');}).catch(()=>{});}
   }catch(e){$('#book-content').innerHTML=`<div class="error">无法读取作品：${esc(e.message)}</div>`;}
 }
 function paras(s){return window.ArchiveMarkdown ? window.ArchiveMarkdown.render(s) : String(s||'').split(/\n/).filter(Boolean).map(line=>'<p>'+esc(line)+'</p>').join('');}
 function readDemoLikes(chapterId){
   try{const v=JSON.parse(localStorage.getItem('archive-demo-likes-'+chapterId)||'null');if(v&&typeof v.liked==='boolean'&&Number.isFinite(v.count))return {liked:v.liked,count:Math.max(0,v.count)};}catch{}
   return {liked:false,count:0};
 }
 function updateLikeUI(button,state){
   button.dataset.liked=String(Boolean(state.liked));button.setAttribute('aria-pressed',String(Boolean(state.liked)));
   button.setAttribute('aria-label',(state.liked?'取消点赞':'点赞本节')+'，当前 '+(Number(state.count)||0)+' 个赞');
   button.querySelector('.heart-icon').textContent=state.liked?'♥':'♡';
   button.querySelector('.like-count').textContent=Number(state.count)||0;
 }
 async function setupLikes(chapterId){
   const button=$('#like-chapter');if(!button)return;
   button.disabled=true;
   let state={liked:false,count:0,enabled:false};
   try{
     state=await api('/api/archive-likes?chapterId='+chapterId);
     updateLikeUI(button,state);
     button.disabled=!state.enabled;
     if(!state.enabled)button.title='站点尚未启用点赞功能';
   }catch(e){button.title='暂时无法读取点赞数';button.querySelector('.like-count').textContent='?';console.warn('点赞统计读取失败:',e.message);return;}
   button.onclick=async()=>{
     if(button.disabled)return;
     button.disabled=true;
     try{
       if(demo){state={liked:!state.liked,count:Math.max(0,state.count+(state.liked?-1:1)),enabled:true};
         try{localStorage.setItem('archive-demo-likes-'+chapterId,JSON.stringify(state));}catch{}
       }else{
         const response=await fetch('/api/archive-likes',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({chapterId,liked:!state.liked})});
         const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||'点赞失败');state=result;
       }
       updateLikeUI(button,state);
       toast(state.liked?'感谢你的喜欢':'已取消点赞');
     }catch(e){toast(e.message);}
     finally{button.disabled=false;}
   };
 }
 function readDemoComments(chapterId){
   try{const data=JSON.parse(localStorage.getItem('archive-demo-comments-'+chapterId)||'[]');return Array.isArray(data)?data.slice(-60).reverse():[];}catch{return ((window.archiveTemporaryComments||{})[chapterId]||[]).slice(-60).reverse();}
 }
 async function loadComments(chapterId){
   const list=$('#comment-list');if(!list)return;
   try{
     const data=await api('/api/archive-comments?chapterId='+chapterId);
     const comments=Array.isArray(data.comments)?data.comments:[];
     list.innerHTML=comments.length?comments.map(c=>`<article class="comment-item"><div class="comment-item-head"><strong>读者评论</strong><time>${esc(String(c.created_at||'').slice(0,10))}</time></div><p>${esc(c.body)}</p></article>`).join(''):'<p class="comment-note">还没有公开评论。欢迎留下第一条留言。</p>';
   }catch(e){list.innerHTML='<p class="comment-note">暂时无法读取评论：'+esc(e.message)+'</p>';}
 }
 function setupComments(chapterId){
   loadComments(chapterId);
   const form=$('#comment-form'),box=$('#comment-text'),status=$('#comment-status'),submit=$('#comment-submit');
   form.addEventListener('submit',async e=>{
     e.preventDefault();const body=box.value.trim();
     if(body.length<2||body.length>1000){status.textContent='评论需要 2 至 1000 字';status.setAttribute('role','alert');return;}
     submit.disabled=true;status.textContent='正在提交…';status.removeAttribute('role');
     try{
       if(demo){const comments=readDemoComments(chapterId).reverse();comments.push({id:Date.now(),body,created_at:new Date().toISOString()});try{localStorage.setItem('archive-demo-comments-'+chapterId,JSON.stringify(comments.slice(-60)));status.textContent='演示评论已保存在当前浏览器中，不会公开。';}catch{window.archiveTemporaryComments=window.archiveTemporaryComments||{};window.archiveTemporaryComments[chapterId]=comments.slice(-60);status.textContent='本地演示评论仅在此页面会话中保留，不会公开。';}}
       else{
         const r=await fetch('/api/archive-comments',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({chapterId,body,contact:form.elements.contact.value})});
         const result=await r.json().catch(()=>({}));if(!r.ok)throw Error(result.error||'提交失败');
         status.textContent='评论已提交，作者审核通过后将以「读者评论」显示。';
       }
       box.value='';await loadComments(chapterId);
     }catch(e){status.textContent=e.message;status.setAttribute('role','alert');}
     finally{submit.disabled=false;}
   });
 }
 async function reader(){await initProfile();const id=q.get('id');if(!/^\d+$/.test(id||'')){$('#read-main').innerHTML='<div class="error">章节编号无效</div>';return;}
   try{const data=await api('/api/chapters/'+id),c=data.chapter;let bookData=null;try{bookData=await api('/api/books/'+c.book_id);}catch{}const b=bookData?.book||{id:c.book_id,title:c.book_title};document.title=c.title+' · '+profile.siteName;
   let chapterMeta={};
   if(!demo){try{chapterMeta=(await api('/api/archive-chapter-meta?chapterId='+id)).meta||{};}catch(e){console.warn('章节资料加载失败:',e.message);}}
   let chapterParent='';
   try{const struct=await api('/api/archive-structure?bookId='+c.book_id);const my=(struct.items||[]).find(x=>Number(x.chapterId)===Number(c.id));const peers=(struct.items||[]).filter(x=>x.groupTitle===my?.groupTitle&&x.kind===my?.kind);if(my && peers.length>1)chapterParent=my.groupTitle;}catch{}
   $('#read-main').innerHTML=`<div class="crumblist"><a href="${link('index.html')}">首页</a><span>›</span><a href="${link('book.html?id='+c.book_id)}">${esc(b.title)}</a><span>›</span><span>${esc(c.title)}</span></div><div class="read-intro">${chapterMeta.hasCover?`<div class="cover-art read-cover"><span class="cover-mark">${esc(c.title.slice(0,4))}</span><span class="cover-subtitle">LITERARY ARCHIVE</span><img alt="章节封面" src="/api/archive-chapter-cover?chapterId=${Number(id)}"></div>`:cover(b,'read-cover')}<div><div class="eyebrow">CHAPTER ${String(c.sort_order||'').padStart(2,'0')}</div><h1>${esc(c.title)}</h1><p class="read-subtitle">《${esc(b.title)}》${chapterParent?' · '+esc(chapterParent):''} · ${Number(c.word_count)||0} 字</p>${tags(b.tags)}${chapterMeta.summary?`<p class="chapter-summary">${esc(chapterMeta.summary)}</p>`:''}<div class="read-setting"><span class="eyebrow">文字大小</span><button class="soft-btn" id="font-less">A−</button><button class="soft-btn" id="font-more">A＋</button><button class="soft-btn theme-toggle" type="button">夜间模式</button></div></div></div><div class="read-content-wrap"><div class="reader-actions"><button type="button" class="like-button" id="like-chapter" title="点赞本节" aria-label="点赞本节" aria-pressed="false"><span class="heart-icon" aria-hidden="true">♡</span><span class="like-count" id="like-count" aria-hidden="true">…</span></button><button type="button" id="share-chapter" title="分享本章链接">↗</button><button type="button" id="jump-comments" title="跳到评论区域">☷</button><small>阅读工具</small></div><article class="prose" id="chapter-prose">${paras(data.content)}</article></div><div class="reader-bottom"><nav class="pager-nav">${data.prevChapter?`<a href="${link('read.html?id='+data.prevChapter.id)}">‹ 上一章<br><small>${esc(data.prevChapter.title)}</small></a>`:`<a href="${link('book.html?id='+c.book_id)}">‹ 返回目录</a>`}${data.nextChapter?`<a href="${link('read.html?id='+data.nextChapter.id)}">下一章 ›<br><small>${esc(data.nextChapter.title)}</small></a>`:`<a href="${link('book.html?id='+c.book_id)}">已是最后一章 · 目录 ›</a>`}</nav><div class="comment-box" id="comments"><h2>读者评论</h2><p class="comment-note">无需登录，所有留言统一以「读者评论」展示。评论经作者审核后公开，暂不支持回复。</p><div class="comment-list" id="comment-list"><p class="comment-note">评论载入中…</p></div><form class="comment-form" id="comment-form"><label for="comment-text" class="field-label">发表匿名评论</label><textarea id="comment-text" maxlength="1000" minlength="2" required placeholder="写下你对这一节的想法……"></textarea><label class="comment-honeypot" aria-hidden="true">请勿填写此项<input name="contact" type="text" tabindex="-1" autocomplete="off"></label><div class="comment-form-foot"><span class="comment-note">${demo?'演示版评论仅保存在本机。':'公开前需要作者审核。'}</span><button type="submit" id="comment-submit">提交评论</button></div><span class="comment-status" id="comment-status" aria-live="polite"></span></form></div></div>`;
   try{localStorage.setItem('archive-last-read',JSON.stringify({chapterId:c.id,bookId:c.book_id,title:c.title,at:Date.now()}));}catch{}
   let font=19;try{font=+localStorage.getItem('archive-font-size')||19;}catch{}const apply=()=>{font=Math.min(27,Math.max(15,font));document.documentElement.style.setProperty('--reader-font',font+'px');try{localStorage.setItem('archive-font-size',font);}catch{}};apply();$('#font-less').onclick=()=>{font--;apply();};$('#font-more').onclick=()=>{font++;apply();};initTheme();
   setupLikes(c.id);
   $('#jump-comments').onclick=()=>$('#comments').scrollIntoView({behavior:'smooth'});
   setupComments(c.id);
   $('#share-chapter').onclick=async()=>{const url=location.href.replace(/([?&])demo=1(&?)/,'$1').replace(/[?&]$/,'');try{if(navigator.share){await navigator.share({title:c.title,url});return;}await navigator.clipboard.writeText(url);toast('章节链接已复制');}catch(e){if(e.name!=='AbortError')toast('无法复制，请手动复制地址栏链接');}};
   }catch(e){$('#read-main').innerHTML=`<div class="error">无法加载章节：${esc(e.message)}</div>`;}
 }
 document.addEventListener('DOMContentLoaded',async()=>{mount();await (async()=>{switch(document.body.dataset.page){case 'home':await home();break;case 'book':await book();break;case 'reader':await reader();break;default:await initProfile();}})();});
})();
