/* Literary Archive admin UI simplification and migration shortcuts.
 * Keep legacy inputs in the DOM because admin.html still references them.
 */
(() => {
  'use strict';
  const validId = value => /^\d{1,18}$/.test(value || '') && Number(value) > 0;
  document.addEventListener('click', event => {
    const target=event.target;
    if (!(target instanceof Element)) return;
    const edit=target.closest('.btn-edit-ch');
    if(edit){
      const id=edit.closest('[data-id]')?.dataset?.id;
      if(!validId(id))return;
      event.preventDefault();event.stopImmediatePropagation();
      location.assign('/chapter-editor.html?id='+encodeURIComponent(id));return;
    }
    const create=target.closest('#panda-create-chapter, button[onclick*="createChapter()"]');
    if(!create)return;
    event.preventDefault();event.stopImmediatePropagation();
    const bookId=document.querySelector('#chapter-book')?.value || '';
    if(!validId(bookId)){alert('请先选择要添加章节的书籍。');document.querySelector('#chapter-book')?.focus();return;}
    const title=document.querySelector('#chapter-title')?.value||'';
    const content=document.querySelector('#chapter-content')?.value||'';
    if(title.trim()||content.trim()){
      try{sessionStorage.setItem('panda-new-chapter-draft-'+bookId,JSON.stringify({title,content}));}catch{}
    }
    location.assign('/chapter-editor.html?book='+encodeURIComponent(bookId));
  },true);
  function simplifyAdmin(){
    if(!document.querySelector('#admin-panel'))return;
    const style=document.createElement('style');
    style.textContent=`
      .panda-admin-hidden{display:none!important}
      .panda-admin-shortcuts{display:flex;gap:10px;flex-wrap:wrap}
      .panda-admin-shortcuts a{display:inline-flex;align-items:center;text-decoration:none}
      .panda-admin-shortcuts a:hover{filter:brightness(.94)}
      .panda-admin-note{color:var(--text-light);font-size:13px;margin:11px 0 0}
    `;
    document.head.appendChild(style);
    const settings=document.querySelector('#set-site-name')?.closest('.admin-section');
    if(settings)settings.classList.add('panda-admin-hidden');
    for(const section of document.querySelectorAll('.admin-section')){
      const h=section.querySelector(':scope > h3');
      if(h?.textContent.includes('批注管理'))section.classList.add('panda-admin-hidden');
    }
    document.querySelector('#chapter-title')?.closest('.form-group')?.classList.add('panda-admin-hidden');
    document.querySelector('#chapter-content')?.closest('.form-group')?.classList.add('panda-admin-hidden');
    const legacy=document.querySelector('button[onclick*="createChapter()"]');
    if(legacy){legacy.removeAttribute('onclick');legacy.id='panda-create-chapter';legacy.textContent='进入写作页面';}
    const select=document.querySelector('#chapter-book');
    if(select&&!document.querySelector('#panda-create-hint')){
      const hint=document.createElement('p');hint.id='panda-create-hint';hint.className='panda-admin-note';
      hint.textContent='选择书籍后进入独立写作编辑器，设置标题、正文、封面、简介和排版。';
      select.closest('.form-group')?.after(hint);
    }
    if(!document.querySelector('#panda-admin-tools')){
      const tools=document.createElement('div');tools.className='admin-section';tools.id='panda-admin-tools';
      tools.innerHTML='<h3>✒️ 文学档案馆管理</h3>'+
        '<div class="panda-admin-shortcuts">'+
        '<a class="btn" href="/archive-admin.html">编辑作者 Profile 与公告</a>'+
        '<a class="btn" href="/archive-moderation.html">审核匿名评论</a>'+
        '<a class="btn" href="/archive-structure.html">管理章节目录</a>'+
        '<a class="btn" id="panda-epub-entry" href="/pixiv-import.html">Pixiv EPUB 批量导入</a>'+
        '</div>';
      const stats=document.querySelector('#stats-grid')?.closest('.admin-section');
      if(stats)stats.after(tools);else document.querySelector('#admin-panel')?.prepend(tools);
    }else if(!document.querySelector('#panda-epub-entry')){
      const a=document.createElement('a');a.id='panda-epub-entry';a.className='btn';a.href='/pixiv-import.html';a.textContent='Pixiv EPUB 批量导入';
      document.querySelector('#panda-admin-tools .panda-admin-shortcuts')?.append(a);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',simplifyAdmin,{once:true});
  else simplifyAdmin();
})();
