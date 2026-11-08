/* Quick navigation between manually grouped sections, reader page only.
 * No changes to chapter content, ordering, or database records.
 */
(() => {
  'use strict';
  if (document.body?.dataset.page && document.body.dataset.page !== 'reader') return;

  const positiveId = value => /^[1-9]\d*$/.test(String(value || ''));
  const getJson = async path => {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  };

  function installStyles() {
    if (document.getElementById('panda-section-nav-css')) return;
    const style = document.createElement('style');
    style.id = 'panda-section-nav-css';
    style.textContent = `
      .panda-section-nav {
        width: min(100%, 680px);
        margin: 0 auto 42px;
        padding: 0 5px;
        color: var(--ink);
      }
      .panda-section-nav__heading {
        display: flex;
        justify-content: center;
        align-items: stretch;
        max-width: 580px;
        margin: 0 auto 17px;
        text-align: center;
      }
      .panda-section-nav__title,
      .panda-section-nav__count {
        border: 1px solid var(--rule);
        background: var(--paper-light);
        padding: 9px 14px;
        font-size: 13px;
        line-height: 1.5;
      }
      .panda-section-nav__title {
        min-width: 0;
        flex: 1;
        overflow-wrap: anywhere;
        letter-spacing: .045em;
      }
      .panda-section-nav__count {
        white-space: nowrap;
        margin-left: -1px;
        font-family: Georgia, serif;
        color: var(--ink-soft);
        font-size: 13px;
      }
      .panda-section-nav__bars {
        display: flex;
        align-items: center;
        gap: clamp(6px, 1.3vw, 13px);
        padding: 4px 2px;
      }
      .panda-section-nav__bar {
        display: block;
        flex: 1 1 0;
        min-width: 8px;
        height: 9px;
        border: 1px solid var(--ink-soft);
        background: transparent;
        border-radius: 1px;
        text-decoration: none;
        cursor: pointer;
        transform-origin: center;
        transition: transform .17s ease, background-color .17s ease,
                    border-color .17s ease, box-shadow .17s ease;
      }
      .panda-section-nav__bar[aria-current="page"] {
        background: var(--ink);
        border-color: var(--ink);
      }
      .panda-section-nav__bar:hover,
      .panda-section-nav__bar:focus-visible {
        transform: scale(1.035, 1.65);
        background: var(--accent);
        border-color: var(--accent);
        box-shadow: 0 1px 6px rgba(67, 49, 30, .13);
        outline-offset: 5px;
        z-index: 1;
      }
      @media (prefers-reduced-motion: reduce) {
        .panda-section-nav__bar { transition: none; }
      }
      @media (max-width: 600px) {
        .panda-section-nav { margin-bottom: 30px; }
        .panda-section-nav__heading { margin-bottom: 12px; }
        .panda-section-nav__title, .panda-section-nav__count {
          padding: 8px 10px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function addQuickNavigation(root, chapterId) {
    if (root.querySelector('.panda-section-nav')) return;
    const bookLink = root.querySelector('.crumblist a[href*="book.html?id="]');
    if (!bookLink) return;

    const bookId = new URL(bookLink.href, location.href).searchParams.get('id');
    if (!positiveId(bookId)) return;

    const [bookData, structureData] = await Promise.all([
      getJson('/api/books/' + encodeURIComponent(bookId)),
      getJson('/api/archive-structure?bookId=' + encodeURIComponent(bookId))
    ]);

    const chapters = Array.isArray(bookData.chapters) ? bookData.chapters : [];
    const entries = Array.isArray(structureData.items) ? structureData.items : [];
    const current = entries.find(item => Number(item.chapterId) === chapterId);
    if (!current || !current.groupTitle) return;

    // Only display on a manually defined chapter with multiple actual sections.
    const peers = chapters
      .filter(ch => entries.some(item => Number(item.chapterId) === Number(ch.id) &&
        item.groupTitle === current.groupTitle && item.kind === current.kind))
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id));

    if (peers.length < 2) return;
    const currentIndex = peers.findIndex(ch => Number(ch.id) === chapterId);
    if (currentIndex < 0) return;

    const wrapper = root.querySelector('.read-content-wrap');
    if (!wrapper || wrapper.querySelector('.panda-section-nav')) return;

    installStyles();
    const nav = document.createElement('nav');
    nav.className = 'panda-section-nav';
    nav.setAttribute('aria-label', '本章小节快速跳转');

    const header = document.createElement('div');
    header.className = 'panda-section-nav__heading';
    const title = document.createElement('span');
    title.className = 'panda-section-nav__title';
    title.textContent = current.groupTitle;
    const counter = document.createElement('span');
    counter.className = 'panda-section-nav__count';
    counter.textContent = `${currentIndex + 1}/${peers.length}节`;
    header.append(title, counter);

    const bars = document.createElement('div');
    bars.className = 'panda-section-nav__bars';
    bars.setAttribute('aria-label', '点击长条切换小节');
    const entryMap = new Map(entries.map(item => [Number(item.chapterId), item]));
    peers.forEach((ch, index) => {
      const section = entryMap.get(Number(ch.id));
      const bar = document.createElement('a');
      bar.className = 'panda-section-nav__bar';
      bar.href = './read.html?id=' + encodeURIComponent(ch.id);
      const description = section?.sectionTitle || ch.title;
      bar.title = `第${index + 1}/${peers.length}节：${description}`;
      bar.setAttribute('aria-label', bar.title);
      if (Number(ch.id) === chapterId) bar.setAttribute('aria-current', 'page');
      bars.appendChild(bar);
    });

    nav.append(header, bars);
    wrapper.prepend(nav); // Directly below the line above the reading area.
  }

  function start() {
    if (document.body.dataset.page !== 'reader') return;
    const root = document.getElementById('read-main');
    const chapterId = Number(new URLSearchParams(location.search).get('id'));
    if (!root || !positiveId(chapterId)) return;

    let started = false;
    const observer = new MutationObserver(checkReady);
    function checkReady() {
      if (started || !root.querySelector('.read-intro') || !root.querySelector('.read-content-wrap')) return;
      started = true;
      observer.disconnect();
      addQuickNavigation(root, chapterId).catch(err =>
        console.warn('本章快捷导航加载失败:', err.message));
    }
    observer.observe(root, { childList: true });
    checkReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
