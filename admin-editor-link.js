/* Keep legacy admin DOM for old handlers, but direct chapter work into the studio. */
(() => {
  'use strict';
  const validId = value => /^\d{1,18}$/.test(value || '') && Number(value)>0;
  document.addEventListener('click',event=>{
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

  function init(){
    if(!document.querySelector('#admin-panel'))return;
    const style=document.createElement('style');
    style.textContent='.panda-admin-hidden{display:none!important}.panda-admin-shortcuts{display:flex;gap:10px;flex-wrap:wrap}.panda-admin-shortcuts a{display:inline-flex;align-items:center;text-decoration:none}.panda-admin-note{color:var(--text-light);font-size:13px;margin:11px 0 0}';
    document.head.appendChild(style);
    document.querySelector('#set-site-name')?.closest('.admin-section')?.classList.add('panda-admin-hidden');
    document.querySelector('#chapter-title')?.closest('.form-group')?.classList.add('panda-admin-hidden');
    document.querySelector('#chapter-content')?.closest('.form-group')?.classList.add('panda-admin-hidden');
    for(const section of document.querySelectorAll('.admin-section')){
      const heading=section.querySelector(':scope > h3');
      if(heading?.textContent.includes('批注管理'))section.classList.add('panda-admin-hidden');
      if(heading?.textContent.includes('📄 章节管理') || heading?.textContent.trim()==='章节管理'){
        // Hide legacy chapter list, preserving its controls so existing JS keeps working.
        section.classList.add('panda-admin-hidden');
        if(!document.querySelector('#panda-studio-entry')){
          const card=document.createElement('div');card.className='admin-section';card.id='panda-studio-entry';
          card.innerHTML='<h3>📄 章节管理</h3><p class="panda-admin-note">集中管理所有已发布的章节：编辑、排序、合并、拆分、导出或删除。</p><p><a class="btn" href="/archive-structure.html">打开章节工作台</a></p>';
          section.after(card);
        }
      }
    }
    const button=document.querySelector('button[onclick*="createChapter()"]');
    if(button){button.removeAttribute('onclick');button.id='panda-create-chapter';button.textContent='进入写作页面';}
    const select=document.querySelector('#chapter-book');
    if(select&&!document.querySelector('#panda-create-hint')){
      const hint=document.createElement('p');hint.id='panda-create-hint';hint.className='panda-admin-note';
      hint.textContent='选择书籍后进入独立写作编辑器，添加正文、封面及排版。';select.closest('.form-group')?.after(hint);
    }
    if(!document.querySelector('#panda-admin-tools')){
      const tools=document.createElement('div');tools.className='admin-section';tools.id='panda-admin-tools';
      tools.innerHTML='<h3>✒️ 文学档案馆管理</h3><div class="panda-admin-shortcuts">'+
        '<a class="btn" href="/archive-admin.html">编辑作者 Profile 与公告</a>'+
        '<a class="btn" href="/archive-moderation.html">审核匿名评论</a>'+
        '<a class="btn" href="/archive-structure.html">章节管理工作台</a>'+
        '<a class="btn" id="panda-epub-entry" href="/pixiv-import.html">Pixiv EPUB 批量导入</a></div>';
      const stats=document.querySelector('#stats-grid')?.closest('.admin-section');
      if(stats)stats.after(tools);else document.querySelector('#admin-panel')?.prepend(tools);
    }else {
      const anchors=[...document.querySelectorAll('#panda-admin-tools a')];
      for(const a of anchors)if(a.getAttribute('href')==='/archive-structure.html')a.textContent='章节管理工作台';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
