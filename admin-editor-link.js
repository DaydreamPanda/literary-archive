/* Route existing chapter actions to the shared author writing workspace. */
(() => {
  'use strict';
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const edit = target.closest('.btn-edit-ch');
    if (edit) {
      const id = edit.closest('[data-id]')?.dataset?.id;
      if (!/^\d{1,18}$/.test(id || '')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign('/chapter-editor.html?id=' + encodeURIComponent(id));
      return;
    }
    const create = target.closest('button[onclick*="createChapter()"]');
    if (!create) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const bookId = document.querySelector('#chapter-book')?.value || '';
    if (!/^\d{1,18}$/.test(bookId)) { alert('请先在「添加章节」选择一本书。'); return; }
    const title = document.querySelector('#chapter-title')?.value || '';
    const content = document.querySelector('#chapter-content')?.value || '';
    if (title.trim() || content.trim()) {
      try { sessionStorage.setItem('panda-new-chapter-draft-' + bookId, JSON.stringify({title,content})); } catch {}
    }
    location.assign('/chapter-editor.html?book=' + encodeURIComponent(bookId));
  }, true);
})();
