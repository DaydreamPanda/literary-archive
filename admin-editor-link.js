/* Literary Archive admin UI simplification.
 * Preserve the original admin.html nodes needed by legacy event listeners,
 * while presenting a focused chapter creation workflow.
 */
(() => {
  'use strict';
  const validId = value => /^\d{1,18}$/.test(value || '') && Number(value) > 0;

  // Capture clicks before legacy inline handlers / prompt-based chapter editing.
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const edit = target.closest('.btn-edit-ch');
    if (edit) {
      const id = edit.closest('[data-id]')?.dataset?.id;
      if (!validId(id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/chapter-editor.html?id=' + encodeURIComponent(id));
      return;
    }

    const create = target.closest('#panda-create-chapter, button[onclick*="createChapter()"]');
    if (!create) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const bookId = document.querySelector('#chapter-book')?.value || '';
    if (!validId(bookId)) {
      window.alert('请先选择要添加章节的书籍。');
      document.querySelector('#chapter-book')?.focus();
      return;
    }
    // Preserve any pre-existing text from the old form during migration.
    const title = document.querySelector('#chapter-title')?.value || '';
    const content = document.querySelector('#chapter-content')?.value || '';
    if (title.trim() || content.trim()) {
      try {
        sessionStorage.setItem('panda-new-chapter-draft-' + bookId, JSON.stringify({ title, content }));
      } catch {}
    }
    window.location.assign('/chapter-editor.html?book=' + encodeURIComponent(bookId));
  }, true);

  function simplifyAdmin() {
    if (!document.querySelector('#admin-panel')) return;

    const style = document.createElement('style');
    style.textContent = `
      .panda-admin-hidden { display: none !important; }
      .panda-admin-shortcuts { display: flex; gap: 10px; flex-wrap: wrap; }
      .panda-admin-shortcuts a { display: inline-flex; align-items: center; text-decoration: none; }
      .panda-admin-shortcuts a:hover { filter: brightness(.94); }
      .panda-admin-note { color: var(--text-light); font-size: 13px; margin: 11px 0 0; }
    `;
    document.head.appendChild(style);

    // Hide sections without deleting elements: legacy loadSettings() still
    // expects its inputs, and showAdminPanel() changes inline display values.
    const settings = document.querySelector('#set-site-name')?.closest('.admin-section');
    if (settings) settings.classList.add('panda-admin-hidden');
    for (const section of document.querySelectorAll('.admin-section')) {
      const header = section.querySelector(':scope > h3');
      if (header?.textContent.includes('批注管理')) section.classList.add('panda-admin-hidden');
    }

    // Existing admin.html still binds an input listener to #chapter-content.
    // Keep the inputs in DOM, but hide the obsolete inline entry form.
    const title = document.querySelector('#chapter-title');
    const content = document.querySelector('#chapter-content');
    title?.closest('.form-group')?.classList.add('panda-admin-hidden');
    content?.closest('.form-group')?.classList.add('panda-admin-hidden');

    const legacyButton = document.querySelector('button[onclick*="createChapter()"]');
    if (legacyButton) {
      legacyButton.removeAttribute('onclick');
      legacyButton.id = 'panda-create-chapter';
      legacyButton.textContent = '进入写作页面';
    }
    const select = document.querySelector('#chapter-book');
    if (select && !document.querySelector('#panda-create-hint')) {
      const hint = document.createElement('p');
      hint.id = 'panda-create-hint';
      hint.className = 'panda-admin-note';
      hint.textContent = '选择书籍后进入独立写作编辑器，设置标题、正文、封面、简介和排版。';
      select.closest('.form-group')?.after(hint);
    }

    // Author profile is a separate editor, so expose a clear entry point.
    if (!document.querySelector('#panda-admin-tools')) {
      const tools = document.createElement('div');
      tools.className = 'admin-section';
      tools.id = 'panda-admin-tools';
      tools.innerHTML = '<h3>✒️ 文学档案馆管理</h3>' +
        '<div class="panda-admin-shortcuts">' +
        '<a class="btn" href="/archive-admin.html">编辑作者 Profile 与公告</a>' +
        '<a class="btn" href="/archive-moderation.html">审核匿名评论</a>' +
        '<a class="btn" href="/archive-structure.html">管理章节目录</a>' +
        '</div>';
      const stats = document.querySelector('#stats-grid')?.closest('.admin-section');
      if (stats) stats.after(tools);
      else document.querySelector('#admin-panel')?.prepend(tools);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', simplifyAdmin, { once: true });
  else simplifyAdmin();
})();
