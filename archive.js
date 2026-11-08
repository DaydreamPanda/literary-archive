
/* Public Literary Archive pages: live Cloudflare Pages/D1 only. */
(() => {
  'use strict';

  const q = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  function link(path) {
    return './' + path;
  }

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) throw Error('服务器返回 ' + res.status);
    return res.json();
  }

  let profile = { ...(window.ARCHIVE_CONFIG || {}) };

  async function initProfile() {
    try {
      const [a, b] = await Promise.all([
        api('/api/archive-profile'),
        api('/api/settings')
      ]);

      profile = { ...profile, ...(a.profile || {}) };

      if (b.settings?.site_name) {
        profile.siteName = b.settings.site_name;
      }
      if (b.settings?.site_desc && !profile.announcement) {
        profile.announcement = b.settings.site_desc;
      }
    } catch (e) {
      console.warn('公开个人资料使用默认设置:', e.message);
    }

    document.querySelectorAll('[data-site-name]').forEach(
      el => el.textContent = profile.siteName || '私人文学档案馆'
    );
    document.querySelectorAll('[data-author-name]').forEach(
      el => el.textContent = profile.authorName || '作者'
    );
    document.querySelectorAll('[data-year]').forEach(
      el => el.textContent = new Date().getFullYear()
    );

    return profile;
  }

  function cover(book, cls = 'cover-mini') {
    const title = esc(book?.title || '作品');
    const initials = esc((book?.title || '卷').slice(0, 4));

    return `<div class="cover-art ${cls}">
      <span class="cover-mark">${initials}</span>
      <span class="cover-subtitle">LITERARY ARCHIVE</span>
      ${book?.cover_key
        ? `<img loading="lazy" src="/api/covers/${Number(book.id)}"
             alt="${title}封面" onerror="this.remove()">`
        : ''}
    </div>`;
  }

  function tags(items) {
    return `<div class="story-tags">${
      (items || []).map(t =>
        `<span class="tag">${esc(t.name)}</span>`
      ).join('')
    }</div>`;
  }

  function makeHead() {
    return `<header class="site-head">
      <a class="site-identity" href="${link('index.html')}">
        <span class="site-seal">文</span>
        <span>
          <span class="site-name" data-site-name>私人文学档案馆</span>
          <span class="site-kicker">Personal Literary Archive</span>
        </span>
      </a>
      <nav class="site-nav">
        <a href="${link('index.html')}">首页</a>
        <a href="${link('index.html')}#works">作品目录</a>
        <a href="./admin.html">作者后台</a>
        <button type="button" class="icon-button theme-toggle"
                aria-label="切换夜间模式" title="切换夜间模式">☾</button>
      </nav>
    </header>`;
  }

  function footer() {
    return `<footer class="archive-footer">
      <div>© <span data-year></span>
        <span data-site-name>私人文学档案馆</span> · ALL STORIES RESERVED
      </div>
      <div>
        <a href="./archive-admin.html">编辑作者资料</a>
        · 18+ 内容提示 ·
        <a href="https://github.com/xingzihai/novel-site"
           target="_blank" rel="noopener noreferrer">
          Powered by Novel Site
        </a>
      </div>
    </footer>`;
  }

  function heading(title, en = '') {
    return `<div class="page-heading">
      <h2>${esc(title)}</h2>
      ${en ? `<span class="eyebrow">${esc(en)}</span>` : ''}
    </div>`;
  }

  function toast(message) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function ageGate() {
    try {
      if (localStorage.getItem('archive-18-confirmed') === 'yes') return;
    } catch {}

    const el = document.createElement('div');
    el.className = 'age-curtain';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '成年读者确认');

    el.innerHTML = `<div class="age-card">
      <div class="age-stamp">18+</div>
      <h2>成年读者确认</h2>
      <p>本站收录可能含有成人主题与露骨描写的文学作品。请确认你已达到所在地区法律规定的成年年龄，并愿意自愿浏览此类内容。</p>
      <button type="button" class="age-accept">我已成年，进入网站</button>
      <button type="button" class="age-decline">我未成年，退出网站</button>
      <p class="age-note">点击确认只提供基础年龄提示，无法代替法律要求的年龄验证。</p>
    </div>`;

    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';

    const focus = el.querySelector('.age-accept');
    focus.focus();

    el.querySelector('.age-accept').onclick = () => {
      try {
        localStorage.setItem('archive-18-confirmed', 'yes');
      } catch {}
      el.remove();
      document.body.style.overflow = '';
    };

    el.querySelector('.age-decline').onclick = () => {
      document.body.innerHTML =
        '<main class="admin-shell" style="text-align:center">' +
        '<h1>访问已结束</h1>' +
        '<p>本网站仅向已达到当地法定成年年龄的读者开放。</p>' +
        '</main>';
      document.body.style.overflow = '';
    };
  }

  function initTheme() {
    let theme = 'paper';
    try {
      theme = localStorage.getItem('archive-theme') || 'paper';
    } catch {}

    document.documentElement.dataset.archiveTheme = theme;

    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.textContent = theme === 'night' ? '☀' : '☾';
      b.onclick = () => {
        theme = theme === 'night' ? 'paper' : 'night';
        document.documentElement.dataset.archiveTheme = theme;

        try {
          localStorage.setItem('archive-theme', theme);
        } catch {}

        document.querySelectorAll('.theme-toggle').forEach(el => {
          el.textContent = theme === 'night' ? '☀' : '☾';
        });
      };
    });
  }

  function mount() {
    const head = $('#site-header');
    const ft = $('#site-footer');
    if (head) head.innerHTML = makeHead();
    if (ft) ft.innerHTML = footer();
    initTheme();
    ageGate();
  }

  function classify(b) {
    return (b.tags || []).some(t =>
      /(^单篇$|短篇|one.?shot)/i.test(t.name)
    ) ? 'single' : 'series';
  }

  function card(b) {
    return `<a class="book-card" href="${link('book.html?id=' + b.id)}">
      ${cover(b)}
      <div class="book-card-main">
        <h3>${esc(b.title)}</h3>
        <div class="book-meta">
          ${esc((b.tags || []).map(t => t.name).slice(0, 2).join(' · ')) || '原创作品'}

· ${classify(b) === 'single'
  ? `${Number(b.total_words) || 0} 字`
  : `${Number(b.chapter_count) || 0} 章 · ${((Number(b.total_words) || 0) / 10000).toFixed(1)} 万字`}

        </div>
        <p class="book-excerpt">${esc(b.description || '暂无简介。')}</p>
      </div>
      <span class="arr" aria-hidden="true">›</span>
    </a>`;
  }

  async function home() {
    await initProfile();

    $('#author-name').textContent = profile.authorName || '作者笔名';
    $('#author-bio').textContent = profile.biography || '';
    $('#announcement').textContent = profile.announcement || '';

    if (profile.avatarUrl && /^https:\/\//i.test(profile.avatarUrl)) {
      $('#avatar').innerHTML =
        `<img src="${esc(profile.avatarUrl)}" alt="作者头像">`;
    } else {
      $('#avatar').textContent = (profile.authorName || '文').slice(0, 1);
    }

    const links = $('#social-links');
    links.innerHTML = '';

    const validLinks = (profile.links || []).filter(
      item => item && /^https:\/\//i.test(item.url)
    );

    validLinks.forEach(item => {
      const a = document.createElement('a');
      a.className = 'platform-link';
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      const symbol = document.createElement('span');
      symbol.className = 'platform-monogram';
      symbol.textContent = (item.label || '?').slice(0, 1).toUpperCase();

      const label = document.createElement('span');
      label.textContent = item.label;

      a.append(symbol, label);
      links.appendChild(a);
    });

    let books = [];

    try {
      books = ((await api('/api/books')).books || [])
        .filter(b => !b.status || b.status === 'normal');
    } catch (e) {
      $('#series-list').innerHTML =
        `<div class="error">作品加载失败：${esc(e.message)}。</div>`;
      return;
    }

    const input = $('#search-books');
    const chips = $('#tag-filters');
    let active = '全部';

    // 最常用的10个Tag，每本书只计数一次
    const tagCounts = new Map();

    books.forEach(book => {
      const uniqueTags = new Set(
        (book.tags || []).map(t => t.name).filter(Boolean)
      );

      uniqueTags.forEach(name => {
        tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
      });
    });

    const tagNames = [
      '全部',
      ...[...tagCounts.entries()]
        .sort((a, b) =>
          b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')
        )
        .slice(0, 15)
        .map(([name]) => name)
    ];

    function draw() {
      const term = input.value.trim().toLowerCase();

      const filtered = books.filter(b =>
        (active === '全部' ||
          (b.tags || []).some(t => t.name === active)) &&
        (!term || [
          b.title, b.author, b.description,
          ...(b.tags || []).map(t => t.name)
        ].join(' ').toLowerCase().includes(term))
      );

      // 系列作品按最近更新时间排序
      const series = filtered
        .filter(b => classify(b) === 'series')
        .sort((a, b) =>
          (b.updated_at || '').localeCompare(a.updated_at || '') ||
          Number(b.id) - Number(a.id)
        );

      const single = filtered.filter(b => classify(b) === 'single');

      $('#series-list').innerHTML = series.length
        ? series.map(card).join('')
        : '<div class="archive-empty">此分类暂无系列作品</div>';

      $('#single-list').innerHTML = single.length
        ? single.map(card).join('')
        : '<div class="archive-empty">此分类暂无单篇作品</div>';

      $('#series-count').textContent = series.length + ' 部';
      $('#single-count').textContent = single.length + ' 部';
    }

    chips.innerHTML = tagNames.map(t =>
      `<button type="button" class="chip ${t === '全部' ? 'is-active' : ''}"
        data-tag="${esc(t)}">${esc(t)}</button>`
    ).join('');

    chips.addEventListener('click', e => {
      const b = e.target.closest('[data-tag]');
      if (!b) return;

      active = b.dataset.tag;

      chips.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('is-active', btn === b);
      });

      draw();
    });

    input.addEventListener('input', draw);
    draw();
  }

  // 每个原始章节是一个可阅读单元
  // 多个单元可归入同一个大章
  function structureGroups(chapters, items) {
    const map = new Map(
      (Array.isArray(items) ? items : [])
        .map(x => [Number(x.chapterId), x])
    );

    const groups = [];
    const byKey = new Map();

    chapters.forEach(ch => {
      const meta = map.get(Number(ch.id)) || {};

      const extra = meta.kind === 'extra' ||
        (meta.kind !== 'main' &&
          /(番外|外传|特别篇|补遗)/i.test(ch.title));

      const kind = extra ? 'extra' : 'main';
      const title = String(meta.groupTitle || ch.title).trim().slice(0, 200);
      const key = kind + ':' + title;

      if (!byKey.has(key)) {
        const group = { title, kind, children: [] };
        groups.push(group);
        byKey.set(key, group);
      }

      byKey.get(key).children.push({
        ...ch,
        sectionTitle: String(meta.sectionTitle || ch.title).trim().slice(0, 200)
      });
    });

    return groups;
  }

  function renderGroups(title, groups, book) {
    if (!groups.length) return '';

    let html = `<section class="chapter-section">
      ${heading(title, groups.length + ' CHAPTERS')}
      <div class="chapter-collection-hint">
        ${title === '正文'
          ? '点击章节进入阅读，含多节的章节可展开目录。'
          : '番外与正文独立排列。'}
      </div>
      <div class="chapter-stack">`;

    groups.forEach((group, i) => {
      const multi = group.children.length > 1;
      const words = group.children.reduce(
        (n, c) => n + (Number(c.word_count) || 0), 0
      );
      const groupId = title + '-' + i;

      const main = `${cover({ title: group.title })}
        <span class="chapter-parent-copy">
          <h3>${esc(group.title)}</h3>
          <small>${multi ? `共 ${group.children.length} 节 · ` : ''}
            约 ${words} 字
          </small>
        </span>`;

      html += '<div class="chapter-entry">';

      if (multi) {
        html += `<button class="chapter-parent" type="button"
          aria-expanded="false" aria-controls="${esc(groupId)}">
          ${main}
          <span class="chapter-chevron" aria-hidden="true">⌄</span>
        </button>`;

        html += `<div class="chapter-children hidden" id="${esc(groupId)}">
          ${group.children.map(c =>
            `<a class="chapter-child" href="${link('read.html?id=' + c.id)}">
              <span>${esc(c.sectionTitle)}</span>
              <small>${Number(c.word_count) || 0} 字 ›</small>
            </a>`
          ).join('')}
        </div>`;
      } else {
        html += `<a class="chapter-parent-link"
          href="${link('read.html?id=' + group.children[0].id)}">
          ${main}
          <span class="arr">›</span>
        </a>`;
      }

      html += '</div>';
    });

    return html + '</div></section>';
  }

  async function book() {
    await initProfile();

    const id = q.get('id');

    if (!/^\d+$/.test(id || '')) {
      $('#book-content').innerHTML =
        '<div class="error">作品编号无效</div>';
      return;
    }

    try {
      const data = await api('/api/books/' + id);
      const b = data.book;

      const cs = (data.chapters || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order);

      let items = [];

      try {
        items = (
          await api('/api/archive-structure?bookId=' + id)
        ).items || [];
      } catch (e) {
        console.warn('章节结构使用默认目录:', e.message);
      }

      const groups = structureGroups(cs, items);
      const main = groups.filter(g => g.kind === 'main');
      const extra = groups.filter(g => g.kind === 'extra');

      document.title = b.title + ' · ' + profile.siteName;
      $('#crumb-title').textContent = b.title;

      $('#book-content').innerHTML =
        `<div class="series-top">
          ${cover(b, 'series-cover')}
          <div class="series-info">
            <div class="eyebrow">SERIES ARCHIVE / ${String(b.id).padStart(3, '0')}</div>
            <h1>${esc(b.title)}</h1>
            <div class="series-meta">
              <span>作者 ${esc(b.author || profile.authorName || '')}</span>
              <span>${main.length} 章 · ${cs.length} 节/篇</span>
              <span>更新于 ${esc(String(b.updated_at || '').slice(0, 10))}</span>
            </div>
            <div class="series-description">${esc(b.description || '尚未填写作品简介。')}</div>
            ${tags(b.tags)}
          </div>
        </div>
        ${renderGroups('正文', main, b)}
        ${renderGroups('番外', extra, b)}
        ${cs.length ? '' : '<div class="archive-empty">这个系列暂时还没有章节</div>'}
        <div class="tool-actions hidden" id="owner-structure-link">
          <a class="soft-btn" href="${link('archive-structure.html?bookId=' + id)}">
            编辑本系列章节结构
          </a>
        </div>`;

      $('#book-content').querySelectorAll('.chapter-parent')
        .forEach(btn => btn.addEventListener('click', () => {
          const el = document.getElementById(
            btn.getAttribute('aria-controls')
          );
          const isOpen = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!isOpen));
          el.classList.toggle('hidden', isOpen);
        }));

      api('/api/me').then(me => {
        if (me.role === 'super_admin') {
          $('#owner-structure-link')?.classList.remove('hidden');
        }
      }).catch(() => {});

    } catch (e) {
      $('#book-content').innerHTML =
        `<div class="error">无法读取作品：${esc(e.message)}</div>`;
    }
  }

  function paras(s) {
    return window.ArchiveMarkdown
      ? window.ArchiveMarkdown.render(s)
      : String(s || '')
          .split(/\n/)
          .filter(Boolean)
          .map(line => '<p>' + esc(line) + '</p>')
          .join('');
  }

  function updateLikeUI(button, state) {
    button.dataset.liked = String(Boolean(state.liked));
    button.setAttribute('aria-pressed', String(Boolean(state.liked)));
    button.setAttribute(
      'aria-label',
      (state.liked ? '取消点赞' : '点赞本节') +
      '，当前 ' + (Number(state.count) || 0) + ' 个赞'
    );

    button.querySelector('.heart-icon').textContent =
      state.liked ? '♥' : '♡';

    button.querySelector('.like-count').textContent =
      Number(state.count) || 0;
  }

  async function setupLikes(chapterId) {
    const button = $('#like-chapter');
    if (!button) return;

    button.disabled = true;
    let state = { liked: false, count: 0, enabled: false };

    try {
      state = await api('/api/archive-likes?chapterId=' + chapterId);
      updateLikeUI(button, state);
      button.disabled = !state.enabled;

      if (!state.enabled) {
        button.title = '站点尚未启用点赞功能';
      }
    } catch (e) {
      button.title = '暂时无法读取点赞数';
      button.querySelector('.like-count').textContent = '?';
      console.warn('点赞统计读取失败:', e.message);
      return;
    }

    button.onclick = async () => {
      if (button.disabled) return;

      button.disabled = true;

      try {
        const response = await fetch('/api/archive-likes', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            liked: !state.liked
          })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw Error(result.error || '点赞失败');

        state = result;
        updateLikeUI(button, state);
        toast(state.liked ? '感谢你的喜欢' : '已取消点赞');
      } catch (e) {
        toast(e.message);
      } finally {
        button.disabled = false;
      }
    };
  }

  async function loadComments(chapterId) {
    const list = $('#comment-list');
    if (!list) return;

    try {
      const data = await api(
        '/api/archive-comments?chapterId=' + chapterId
      );
      const comments = Array.isArray(data.comments) ? data.comments : [];

      list.innerHTML = comments.length
        ? comments.map(c =>
            `<article class="comment-item">
              <div class="comment-item-head">
                <strong>读者评论</strong>
                <time>${esc(String(c.created_at || '').slice(0, 10))}</time>
              </div>
              <p>${esc(c.body)}</p>
            </article>`
          ).join('')
        : '<p class="comment-note">还没有公开评论。欢迎留下第一条留言。</p>';
    } catch (e) {
      list.innerHTML =
        '<p class="comment-note">暂时无法读取评论：' +
        esc(e.message) + '</p>';
    }
  }

  function setupComments(chapterId) {
    loadComments(chapterId);

    const form = $('#comment-form');
    const box = $('#comment-text');
    const status = $('#comment-status');
    const submit = $('#comment-submit');

    form.addEventListener('submit', async e => {
      e.preventDefault();

      const body = box.value.trim();

      if (body.length < 2 || body.length > 1000) {
        status.textContent = '评论需要 2 至 1000 字';
        status.setAttribute('role', 'alert');
        return;
      }

      submit.disabled = true;
      status.textContent = '正在提交…';
      status.removeAttribute('role');

      try {
        const r = await fetch('/api/archive-comments', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            body,
            contact: form.elements.contact.value
          })
        });

        const result = await r.json().catch(() => ({}));
        if (!r.ok) throw Error(result.error || '提交失败');

        status.textContent =
          '评论已提交，作者审核通过后将以「读者评论」显示。';

        box.value = '';
        await loadComments(chapterId);
      } catch (e) {
        status.textContent = e.message;
        status.setAttribute('role', 'alert');
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function reader() {
    await initProfile();

    const id = q.get('id');

    if (!/^\d+$/.test(id || '')) {
      $('#read-main').innerHTML =
        '<div class="error">章节编号无效</div>';
      return;
    }

    try {
      const data = await api('/api/chapters/' + id);
      const c = data.chapter;

      let bookData = null;

      try {
        bookData = await api('/api/books/' + c.book_id);
      } catch {}

      const b = bookData?.book || {
        id: c.book_id,
        title: c.book_title
      };

      document.title = c.title + ' · ' + profile.siteName;

      let chapterMeta = {};

      try {
        chapterMeta = (
          await api('/api/archive-chapter-meta?chapterId=' + id)
        ).meta || {};
      } catch (e) {
        console.warn('章节资料加载失败:', e.message);
      }

      let chapterParent = '';

      try {
        const struct = await api(
          '/api/archive-structure?bookId=' + c.book_id
        );

        const my = (struct.items || []).find(
          x => Number(x.chapterId) === Number(c.id)
        );

        const peers = (struct.items || []).filter(
          x => x.groupTitle === my?.groupTitle &&
               x.kind === my?.kind
        );

        if (my && peers.length > 1) {
          chapterParent = my.groupTitle;
        }
      } catch {}

      const readCover = chapterMeta.hasCover
        ? `<div class="cover-art read-cover">
            <span class="cover-mark">${esc(c.title.slice(0, 4))}</span>
            <span class="cover-subtitle">LITERARY ARCHIVE</span>
            <img alt="章节封面"
                 src="/api/archive-chapter-cover?chapterId=${Number(id)}">
          </div>`
        : cover(b, 'read-cover');

      $('#read-main').innerHTML = `
        <div class="crumblist">
          <a href="${link('index.html')}">首页</a>
          <span>›</span>
          <a href="${link('book.html?id=' + c.book_id)}">${esc(b.title)}</a>
          <span>›</span>
          <span>${esc(c.title)}</span>
        </div>

        <div class="read-intro">
          ${readCover}
          <div>
            <div class="eyebrow">
              CHAPTER ${String(c.sort_order || '').padStart(2, '0')}
            </div>
            <h1>${esc(c.title)}</h1>
            <p class="read-subtitle">
              《${esc(b.title)}》
              ${chapterParent ? ' · ' + esc(chapterParent) : ''}
              · ${Number(c.word_count) || 0} 字
            </p>
            ${tags(b.tags)}
            ${chapterMeta.summary
              ? `<p class="chapter-summary">${esc(chapterMeta.summary)}</p>`
              : ''}
            <div class="read-setting">
              <span class="eyebrow">文字大小</span>
              <button class="soft-btn" id="font-less">A−</button>
              <button class="soft-btn" id="font-more">A＋</button>
              <button class="soft-btn theme-toggle" type="button">夜间模式</button>
            </div>
          </div>
        </div>

        <div class="read-content-wrap">
          <div class="reader-actions">
            <button type="button" class="like-button" id="like-chapter"
              title="点赞本节" aria-label="点赞本节" aria-pressed="false">
              <span class="heart-icon" aria-hidden="true">♡</span>
              <span class="like-count" id="like-count" aria-hidden="true">…</span>
            </button>
            <button type="button" id="share-chapter" title="分享本章链接">↗</button>
            <button type="button" id="jump-comments" title="跳到评论区域">☷</button>
            <small>阅读工具</small>
          </div>
          <article class="prose" id="chapter-prose">${paras(data.content)}</article>
        </div>

        <div class="reader-bottom">
          <nav class="pager-nav">
            ${data.prevChapter
              ? `<a href="${link('read.html?id=' + data.prevChapter.id)}">
                  ‹ 上一章
                  <small>${esc(data.prevChapter.title)}</small>
                </a>`
              : `<a href="${link('book.html?id=' + c.book_id)}">‹ 返回目录</a>`}

            ${data.nextChapter
              ? `<a href="${link('read.html?id=' + data.nextChapter.id)}">
                  下一章 ›
                  <small>${esc(data.nextChapter.title)}</small>
                </a>`
              : `<a href="${link('book.html?id=' + c.book_id)}">
                  已是最后一章 · 目录 ›
                </a>`}
          </nav>

          <div class="comment-box" id="comments">
            <h2>读者评论</h2>
            <p class="comment-note">
              无需登录，所有留言统一以「读者评论」展示。
              评论经作者审核后公开，暂不支持回复。
            </p>
            <div class="comment-list" id="comment-list">
              <p class="comment-note">评论载入中…</p>
            </div>
            <form class="comment-form" id="comment-form">
              <label for="comment-text" class="field-label">
                发表匿名评论
              </label>
              <textarea id="comment-text" maxlength="1000" minlength="2"
                required placeholder="写下你对这一节的想法……"></textarea>
              <label class="comment-honeypot" aria-hidden="true">
                请勿填写此项
                <input name="contact" type="text" tabindex="-1"
                       autocomplete="off">
              </label>
              <div class="comment-form-foot">
                <span class="comment-note">公开前需要作者审核。</span>
                <button type="submit" id="comment-submit">提交评论</button>
              </div>
              <span class="comment-status" id="comment-status"
                    aria-live="polite"></span>
            </form>
          </div>
        </div>`;

      try {
        localStorage.setItem('archive-last-read', JSON.stringify({
          chapterId: c.id,
          bookId: c.book_id,
          title: c.title,
          at: Date.now()
        }));
      } catch {}

      let font = 19;

      try {
        font = +localStorage.getItem('archive-font-size') || 19;
      } catch {}

      const apply = () => {
        font = Math.min(27, Math.max(15, font));
        document.documentElement.style.setProperty(
          '--reader-font', font + 'px'
        );
        try {
          localStorage.setItem('archive-font-size', font);
        } catch {}
      };

      apply();

      $('#font-less').onclick = () => {
        font--;
        apply();
      };
      $('#font-more').onclick = () => {
        font++;
        apply();
      };

      initTheme();
      setupLikes(c.id);

      $('#jump-comments').onclick = () =>
        $('#comments').scrollIntoView({ behavior: 'smooth' });

      setupComments(c.id);

      $('#share-chapter').onclick = async () => {
        const url = location.href;
        try {
          if (navigator.share) {
            await navigator.share({ title: c.title, url });
            return;
          }
          await navigator.clipboard.writeText(url);
          toast('章节链接已复制');
        } catch (e) {
          if (e.name !== 'AbortError') {
            toast('无法复制，请手动复制地址栏链接');
          }
        }
      };

    } catch (e) {
      $('#read-main').innerHTML =
        `<div class="error">无法加载章节：${esc(e.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    mount();

    switch (document.body.dataset.page) {
      case 'home':
        await home();
        break;
      case 'book':
        await book();
        break;
      case 'reader':
        await reader();
        break;
      default:
        await initProfile();
    }
  });
})();
