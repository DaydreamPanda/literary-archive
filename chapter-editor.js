(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const title = $('#chapter-title');
  const body = $('#chapter-body');
  const form = $('#chapter-form');
  const saveButton = $('#save-btn');
  const previewButton = $('#preview-btn');
  const saveStatus = $('#save-status');
  const syncIndicator = $('#sync-indicator');
  const errorPanel = $('#error-panel');
  const params = new URLSearchParams(location.search);
  let chapterId = params.get('id');
  let bookId = params.get('book');
  let version = 0;
  let savedTitle = '';
  let savedContent = '';
  let saving = false;
  let ready = false;

  function validId(value) { return /^\d{1,18}$/.test(value || '') && Number(value) > 0; }
  function clean(s) { return s.trim(); }
  function changed() { return ready && (clean(title.value) !== savedTitle || clean(body.value) !== savedContent); }
  function notify(message, error = false) {
    saveStatus.textContent = message;
    saveStatus.style.color = error ? '#b35f50' : '';
  }
  function showError(message) { errorPanel.hidden = false; errorPanel.textContent = message; }
  function hideError() { errorPanel.hidden = true; errorPanel.textContent = ''; }
  function updateButtons() {
    const dirty = changed();
    $('#word-count').textContent = clean(body.value).length.toLocaleString();
    saveButton.disabled = !ready || saving || !dirty || !clean(title.value) || !clean(body.value);
    saveButton.textContent = saving ? '正在保存…' : (chapterId ? '保存修改' : '发布章节');
    previewButton.disabled = !chapterId;
    if (!saving) {
      syncIndicator.textContent = dirty ? '● 有未保存的修改' : '✓ 已保存';
      if (dirty) notify('有未保存的修改。按 ⌘ S / Ctrl S 保存');
      else notify('所有修改均已保存');
    }
  }
  async function getJson(path, options = {}) {
    let response;
    try { response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options }); }
    catch { throw new Error('网络连接失败，请检查网络后重试。'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new Error('登录已失效，请先在 /admin.html 重新登录。');
      throw new Error(result.error || `请求失败（${response.status}）`);
    }
    return result;
  }
  async function initialize() {
    try {
      if (!validId(chapterId) && !validId(bookId)) {
        showError('没有找到章节编号。请从「作者后台 → 章节管理 → 编辑」进入本页面。');
        return;
      }
      await getJson('/api/me');
      if (validId(chapterId)) {
        const result = await getJson('/api/chapters/' + encodeURIComponent(chapterId));
        const chapter = result.chapter;
        if (!chapter || typeof result.content !== 'string') throw new Error('无法读取完整章节内容。');
        bookId = String(chapter.book_id);
        version = Number(chapter.version) || 0;
        title.value = chapter.title || '';
        body.value = result.content;
        savedTitle = clean(title.value);
        savedContent = clean(body.value);
        $('#page-heading').textContent = '编辑章节';
        $('#book-caption').textContent = '《' + (chapter.book_title || '作品') + '》';
        document.title = '编辑 · ' + chapter.title + ' · 文学档案馆';
      } else {
        chapterId = null;
        const result = await getJson('/api/books/' + encodeURIComponent(bookId));
        $('#book-caption').textContent = '《' + (result.book?.title || '作品') + '》';
        $('#page-heading').textContent = '新建章节';
        $('#editor-hint').textContent = '在这里写正文，完成后点击「发布章节」。';
        savedTitle = '';
        savedContent = '';
      }
      ready = true;
      form.hidden = false;
      hideError();
      updateButtons();
    } catch (error) {
      showError('无法进入编辑模式：' + error.message);
      $('#book-caption').textContent = '无法加载章节';
    }
  }
  async function saveChapter() {
    if (!ready || saving) return false;
    const nextTitle = clean(title.value);
    const nextContent = clean(body.value);
    if (!nextTitle || !nextContent) {
      notify('标题和正文都需要填写才能保存。', true);
      return false;
    }
    if (!changed()) {
      notify('当前内容已保存。');
      return true;
    }
    if (nextTitle.length > 200 || nextContent.length > 500000) {
      notify('标题不能超过200字符，正文不能超过50万字符。', true);
      return false;
    }
    saving = true;
    hideError();
    syncIndicator.textContent = '正在保存…';
    notify('正在安全保存到数据库…');
    updateButtons();
    try {
      const creating = !chapterId;
      const path = creating ? '/api/admin/chapters' : '/api/admin/chapters/' + encodeURIComponent(chapterId);
      const payload = creating
        ? {book_id: Number(bookId), title: nextTitle, content: nextContent}
        : {title: nextTitle, content: nextContent, version};
      const result = await getJson(path, {
        method: creating ? 'POST' : 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      if (creating) {
        const newId = result.chapter?.id;
        if (!validId(String(newId || ''))) throw new Error('服务器没有返回章节编号，请先在后台核对，避免重复创建。');
        chapterId = String(newId);
        version = 0;
        history.replaceState(null, '', '/chapter-editor.html?id=' + encodeURIComponent(chapterId));
        $('#page-heading').textContent = '编辑章节';
      } else {
        version = Number(result.version) || (version + 1);
      }
      savedTitle = nextTitle;
      savedContent = nextContent;
      document.title = '编辑 · ' + nextTitle + ' · 文学档案馆';
      if (result.warning) showError('保存成功，但请注意：' + result.warning);
      notify('已保存至 D1 数据库 ✓');
      return true;
    } catch (error) {
      if (error.message.includes('其他人修改') || error.message.includes('409')) {
        showError('检测到章节在另一处被修改。请先复制当前正文留存，再刷新页面，以免覆盖最新版本。');
      }
      notify('保存失败：' + error.message, true);
      return false;
    } finally {
      saving = false;
      updateButtons();
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); void saveChapter(); });
  title.addEventListener('input', updateButtons);
  body.addEventListener('input', updateButtons);
  saveButton.addEventListener('click', () => void saveChapter());
  previewButton.addEventListener('click', () => {
    if (!chapterId) return;
    if (changed()) {
      notify('请先保存修改，再预览阅读页面。', true);
      return;
    }
    window.open('/read.html?id=' + encodeURIComponent(chapterId), '_blank', 'noopener,noreferrer');
  });
  window.addEventListener('beforeunload', (event) => {
    if (changed()) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveChapter();
    }
  });
  const themeSwitch = $('#theme-switch');
  let theme = 'paper';
  try { theme = localStorage.getItem('archive-theme') || 'paper'; } catch {}
  document.documentElement.dataset.archiveTheme = theme;
  themeSwitch.textContent = theme === 'night' ? '☀' : '☾';
  themeSwitch.addEventListener('click', () => {
    theme = theme === 'night' ? 'paper' : 'night';
    document.documentElement.dataset.archiveTheme = theme;
    themeSwitch.textContent = theme === 'night' ? '☀' : '☾';
    try { localStorage.setItem('archive-theme', theme); } catch {}
  });
  void initialize();
})();
