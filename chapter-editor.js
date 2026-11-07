(() => {
  'use strict';
  const $ = q => document.querySelector(q);
  const title = $('#chapter-title'), body = $('#chapter-body');
  const saveBtn = $('#save-btn'), previewBtn = $('#preview-btn');
  const q = new URLSearchParams(location.search);
  let chapterId = q.get('id'), bookId = q.get('book');
  let version = 0, savedTitle = '', savedBody = '', savedSummary = '';
  let bookData = null, tagList = [], selectedTags = new Set(), savedTags = '';
  let bookDescription = '', hasChapterCover = false, hasBookCover = false;
  let ready = false, saving = false, savingMeta = false, bookSaving = false;
  let suppressUnload = false;
  let richEditor = null;
  const validId = id => /^\d{1,18}$/.test(id || '') && Number(id) > 0;
  const trim = s => s.trim();
  const wordCount = () => trim(body.value).length;
  const changed = () => ready && (trim(title.value) !== savedTitle || trim(body.value) !== savedBody);
  const chapterMetaChanged = () => ready && (trim($('#chapter-summary').value) !== savedSummary || !!$('#chapter-cover').files?.length);
  const bookMetaChanged = () => ready && (trim($('#book-description').value) !== bookDescription || JSON.stringify([...selectedTags].sort()) !== savedTags || !!$('#book-cover').files?.length);
  const dirty = () => changed() || chapterMetaChanged() || bookMetaChanged();
  const message = (target, text, error = false) => { target.textContent = text; target.classList.toggle('is-error', error); };
  const errorPanel = $('#error-panel');
  function showError(text) { errorPanel.hidden = false; errorPanel.textContent = text; }
  function hideError() { errorPanel.hidden = true; errorPanel.textContent = ''; }
  async function request(path, opts = {}) {
    const res = await fetch(path, {credentials:'same-origin',cache:'no-store',...opts});
    const value = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(value.error || (res.status === 401 ? '登录已失效，请从作者后台重新登录。' : '服务器返回 '+res.status));
    return value;
  }
  const payload = (obj, method) => ({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
  function update() {
    $('#word-count').textContent = wordCount().toLocaleString();
    saveBtn.disabled = !ready || saving || !changed() || !trim(title.value) || !trim(body.value);
    saveBtn.textContent = saving ? '正在保存…' : (chapterId ? '保存修改' : '发布章节');
    previewBtn.disabled = !chapterId || changed();
    $('#save-chapter-meta').disabled = !chapterId || savingMeta || (!chapterMetaChanged() && ready);
    $('#save-book-meta').disabled = !bookData || bookSaving || !bookMetaChanged();
    const indicator = $('#sync-indicator');
    indicator.textContent = changed() ? '● 有未保存的修改' : '✓ 正文已保存';
    if (!saving) message($('#save-status'), changed() ? '请保存修改，快捷键 ⌘ S / Ctrl S' : '正文已保存到 D1');

  }
  function selectedTagIds() {return [...selectedTags].sort((a,b)=>a-b);}
  function renderTags() {
    const box = $('#tag-options'); box.replaceChildren();
    if (!tagList.length) { box.textContent = '还没有 Tag，可以在下面新建。'; return; }
    for (const tag of tagList) {
      const label = document.createElement('label');label.className = 'tag-check';
      const input = document.createElement('input');input.type='checkbox';input.value=String(tag.id);input.checked=selectedTags.has(Number(tag.id));
      const name = document.createElement('span');name.textContent=tag.name;
      input.addEventListener('change', () => {if(input.checked) selectedTags.add(Number(tag.id));else selectedTags.delete(Number(tag.id));update();});
      label.append(input,name);box.append(label);
    }
  }
  async function fetchBook() {
    const r = await request('/api/books/'+encodeURIComponent(bookId));
    if (!r.book) throw Error('无法读取书籍资料');
    bookData = r.book;
    $('#book-link').textContent = '《'+bookData.title+'》';
    $('#book-link').href = '/book.html?id='+encodeURIComponent(bookId);
    $('#book-description').value = bookData.description || '';
    bookDescription = trim($('#book-description').value);
    hasBookCover = !!bookData.cover_key;
    if (hasBookCover) {$('#book-cover-preview').src='/api/covers/'+encodeURIComponent(bookId)+'?t='+Date.now();$('#book-cover-preview').hidden=false;}
    selectedTags = new Set((bookData.tags || []).map(t=>Number(t.id)));
    savedTags = JSON.stringify(selectedTagIds());
    try {tagList = (await request('/api/admin/tags')).tags || [];} catch {tagList = (await request('/api/tags')).tags || [];}
    renderTags();
  }
  async function fetchChapterMeta() {
    if (!chapterId) return;
    const r = await request('/api/archive-chapter-meta?chapterId='+encodeURIComponent(chapterId));
    const meta = r.meta || {};
    $('#chapter-summary').value=meta.summary || '';
    savedSummary=trim($('#chapter-summary').value);
    hasChapterCover = !!meta.hasCover;
    $('#remove-chapter-cover').hidden=!hasChapterCover;
    if(hasChapterCover){$('#chapter-cover-preview').src='/api/archive-chapter-cover?chapterId='+encodeURIComponent(chapterId)+'&t='+Date.now();$('#chapter-cover-preview').hidden=false;}
  }
  async function init() {
    try {
      if (!validId(chapterId) && !validId(bookId)) throw Error('请从作者后台的章节列表或添加章节区域进入。');
      await request('/api/me');
      if (validId(chapterId)) {
        const result = await request('/api/chapters/'+encodeURIComponent(chapterId));
        const chapter = result.chapter;
        if (!chapter || typeof result.content !== 'string') throw Error('章节数据不完整');
        bookId = String(chapter.book_id);version=Number(chapter.version)||0;
        title.value=chapter.title || '';body.value=result.content;
        $('#page-heading').textContent='编辑章节';
        document.title='编辑 '+chapter.title+' · 文学档案馆';
      } else {
        chapterId=null;
        $('#page-heading').textContent='新建章节';
        $('#editor-hint').textContent='在独立写作页编写新章节，完成后点击「发布章节」。';
        try {
          const draft=JSON.parse(sessionStorage.getItem('panda-new-chapter-draft-'+bookId)||'null');
          if(draft){title.value=draft.title||'';body.value=draft.content||'';sessionStorage.removeItem('panda-new-chapter-draft-'+bookId);}
        } catch {}
      }
      await fetchBook();
      if (chapterId) await fetchChapterMeta();
      savedTitle = chapterId ? trim(title.value) : '';
      savedBody = chapterId ? trim(body.value) : '';
      await mountRichEditor();
      // Vditor may normalize existing Markdown while loading; avoid false dirty warnings.
      savedBody = chapterId ? trim(body.value) : '';
      ready=true;
      $('#workspace').hidden=false;
      if (!fallbackMode) hideError();update();
    } catch(e) {showError('无法加载编辑器：'+e.message);}
  }
  async function uploadCover(file, endpoint) {
    let asset=file;
    if(file.size > 920_000) asset=await compress(file);
    if(asset.size > 1_000_000) throw Error('图片压缩后仍超过 1 MB，请选择尺寸更小的图片。');
    const fd=new FormData();fd.set('file',asset,asset.name||'cover.jpg');
    return request(endpoint,{method:'POST',body:fd});
  }
  async function compress(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw Error('仅支持 JPEG、PNG、WebP 格式');
    const img=await createImageBitmap(file);
    const factor=Math.min(1,1024/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*factor));canvas.height=Math.max(1,Math.round(img.height*factor));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close?.();
    let blob=null;
    for(const quality of [.80,.65,.48]){
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob && blob.size <= 950000) break;
    }
    if(!blob) throw Error('浏览器无法压缩图片');
    return new File([blob],'cover.jpg',{type:'image/jpeg'});
  }
  function coverPreview(file, id) {
    const img=$(id);const url=URL.createObjectURL(file);img.src=url;img.hidden=false;
    img.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
  }
  async function saveChapterMeta(quiet=false) {
    if(!chapterId) {if(!quiet) message($('#chapter-meta-status'),'请先发布章节，再保存本节设置。',true);return false;}
    if(savingMeta) return false;
    savingMeta=true;update();
    try {
      const summary=trim($('#chapter-summary').value);
      await request('/api/admin/archive-chapter-meta?chapterId='+encodeURIComponent(chapterId),payload({summary},'PUT'));
      const file=$('#chapter-cover').files[0];
      if(file){await uploadCover(file,'/api/admin/archive-chapter-meta?chapterId='+encodeURIComponent(chapterId));$('#chapter-cover').value='';hasChapterCover=true;$('#remove-chapter-cover').hidden=false;$('#chapter-cover-preview').src='/api/archive-chapter-cover?chapterId='+encodeURIComponent(chapterId)+'&t='+Date.now();}
      savedSummary=summary;
      message($('#chapter-meta-status'),'章节设置已保存 ✓');return true;
    } catch(e) {message($('#chapter-meta-status'),'保存失败：'+e.message,true);return false;}
    finally {savingMeta=false;update();}
  }
  async function saveBookMeta() {
    if (!bookData || bookSaving) return;
    bookSaving=true;update();
    try {
      const description=trim($('#book-description').value);
      await request('/api/admin/books/'+encodeURIComponent(bookId),payload({description},'PUT'));
      await request('/api/admin/book-tags',payload({book_id:Number(bookId),tag_ids:selectedTagIds()},'PUT'));
      const file=$('#book-cover').files[0];
      if(file){await uploadCover(file,'/api/admin/covers?book_id='+encodeURIComponent(bookId));$('#book-cover').value='';hasBookCover=true;$('#book-cover-preview').src='/api/covers/'+encodeURIComponent(bookId)+'?t='+Date.now();}
      bookDescription=description;savedTags=JSON.stringify(selectedTagIds());
      message($('#book-meta-status'),'作品封面、简介及 Tag 已保存 ✓');
    } catch(e) {message($('#book-meta-status'),'保存失败：'+e.message,true);}
    finally{bookSaving=false;update();}
  }
  async function saveChapter() {
    if(!ready||saving) return;
    const nextTitle=trim(title.value),nextBody=trim(body.value);
    if(!nextTitle||!nextBody) {message($('#save-status'),'标题和正文不能为空',true);return;}
    if(nextTitle.length>200||nextBody.length>500000) {message($('#save-status'),'标题不能超过200字符，正文不能超过50万字符',true);return;}
    if(!changed()) {message($('#save-status'),'正文已经保存');return;}
    saving=true;hideError();update();message($('#save-status'),'正在保存到 D1…');
    const creating=!chapterId;
    try {
      const endpoint=creating?'/api/admin/chapters':'/api/admin/chapters/'+encodeURIComponent(chapterId);
      const data=creating?{book_id:Number(bookId),title:nextTitle,content:nextBody}:{title:nextTitle,content:nextBody,version};
      const result=await request(endpoint,payload(data,creating?'POST':'PUT'));
      if(creating){
        if(!validId(String(result.chapter?.id||''))) throw Error('服务器未返回章节编号，请在后台检查是否成功创建，避免重复发布。');
        chapterId=String(result.chapter.id);version=0;
        history.replaceState(null,'','/chapter-editor.html?id='+encodeURIComponent(chapterId));
        $('#page-heading').textContent='编辑章节';
        $('#editor-hint').textContent='已发布，可以继续修改并保存。';
      } else version=Number(result.version)||version+1;
      savedTitle=nextTitle;savedBody=nextBody;
      document.title='编辑 '+nextTitle+' · 文学档案馆';
      message($('#save-status'),'章节正文已保存 ✓');
      if(result.warning)showError('保存成功，但请注意：'+result.warning);
      if(creating && (trim($('#chapter-summary').value)||$('#chapter-cover').files.length)) {
        const ok=await saveChapterMeta(true);
        if(!ok)showError('章节正文已发布，但章节简介或封面尚未保存成功，请点击右侧「保存章节设置」重试。');
      }
    } catch(e) {
      message($('#save-status'),'保存失败：'+e.message,true);
      if(/冲突|修改|409/.test(e.message))showError('服务器中的章节已有其他修改，请先复制当前文字保存到本机，再刷新页面。');
    } finally {saving=false;update();}
  }
  let fallbackMode = false;
  function switchToPlainEditor(reason) {
    // Safety first: never prevent the author from editing when a third-party CDN is unavailable.
    fallbackMode = true;
    try { richEditor?.destroy?.(); } catch {}
    $('#vditor-editor').hidden = true;
    $('#fallback-formatbar').hidden = false;
    body.hidden = false;
    body.addEventListener('input', update);
    showError('富文本编辑器暂时无法加载，已自动切换到可以正常保存的 Markdown 备用编辑器。' +
      ' 正文仍从 D1 读取，保存不会丢失。你可以稍后再试富文本模式。');
    console.warn('Vditor fallback enabled:', reason);
  }
  function applyFormat(kind) {
    const s = body.selectionStart, e = body.selectionEnd;
    const selected = body.value.slice(s, e);
    let before = '', after = '', sample = '文字';
    if (kind === 'bold') { before = '**'; after = '**'; }
    else if (kind === 'italic') { before = '*'; after = '*'; }
    else if (kind === 'h2' || kind === 'h3' || kind === 'quote') {
      const prefix = kind === 'h2' ? '## ' : kind === 'h3' ? '### ' : '> ';
      // Prefix each selected line rather than breaking surrounding text.
      const from = body.value.lastIndexOf('\n', Math.max(0, s - 1)) + 1;
      const raw = body.value.slice(from, e);
      const replacement = raw.split('\n').map(line => prefix + line).join('\n');
      body.setRangeText(replacement, from, e, 'end');
      body.focus();
      update();
      return;
    } else return;
    const replacement = before + (selected || sample) + after;
    body.setRangeText(replacement, s, e, 'select');
    body.setSelectionRange(s + before.length, s + before.length + (selected || sample).length);
    body.focus();
    update();
  }
  $('#fallback-formatbar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-format]');
    if (button) applyFormat(button.dataset.format);
  });
  async function loadBackupEditorScript() {
    // cdnjs provides the primary JS/CSS; Vditor's nested assets use unpkg's /dist paths.
    // If the main script is blocked, try loading the same patched version from unpkg.
    if (typeof window.Vditor === 'function') return 'https://unpkg.com/vditor@4.0.1';
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => { script.remove(); reject(new Error('备用 CDN 超时')); }, 8500);
      script.src = 'https://unpkg.com/vditor@4.0.1/dist/index.min.js';
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); reject(new Error('备用 CDN 加载失败')); };
      document.head.appendChild(script);
    });
    if (typeof window.Vditor !== 'function') throw Error('外部编辑器脚本不可用');
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/vditor@4.0.1/dist/index.css';
    document.head.appendChild(css);
    return 'https://unpkg.com/vditor@4.0.1';
  }
  async function mountRichEditor() {
    try {
      const cdnBase = await loadBackupEditorScript();
      const initialMarkdown = body.value;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Vditor 初始化超时')), 16000);
        try {
          richEditor = new window.Vditor('vditor-editor', {
            value: initialMarkdown,
            lang: 'zh_CN',
            cdn: cdnBase,
            mode: 'wysiwyg',
            height: 'auto',
            minHeight: 500,
            theme: 'classic',
            cache: { enable: false },
            placeholder: '从这里开始写你的故事……',
            toolbar: ['headings', 'bold', 'italic', 'quote', '|', 'undo', 'redo', '|', 'edit-mode', 'fullscreen'],
            input: markdown => {
              if (fallbackMode) return;
              body.value = typeof markdown === 'string' ? markdown : richEditor.getValue();
              if (ready) update();
            },
            after: () => {
              if (fallbackMode) return;
              clearTimeout(timeout);
              body.value = richEditor.getValue();
              resolve();
            },
          });
        } catch (e) { clearTimeout(timeout); reject(e); }
      });
    } catch (error) {
      switchToPlainEditor(error.message || String(error));
    }
  }
  $('#chapter-form').addEventListener('submit',e=>{e.preventDefault();void saveChapter();});
  saveBtn.addEventListener('click',()=>void saveChapter());
  previewBtn.addEventListener('click',()=>{if(!chapterId||changed())return;window.open('/read.html?id='+encodeURIComponent(chapterId),'_blank','noopener,noreferrer');});
  title.addEventListener('input',update);
  $('#chapter-summary').addEventListener('input',update);$('#book-description').addEventListener('input',update);
  $('#chapter-cover').addEventListener('change',e=>{if(e.target.files?.[0])coverPreview(e.target.files[0],'#chapter-cover-preview');update();});
  $('#book-cover').addEventListener('change',e=>{if(e.target.files?.[0])coverPreview(e.target.files[0],'#book-cover-preview');update();});
  $('#remove-chapter-cover').addEventListener('click',async()=>{
    if(!chapterId||!hasChapterCover)return;
    if(!confirm('确定删除本节独立封面？删除后将显示作品封面。'))return;
    try{await request('/api/admin/archive-chapter-meta?chapterId='+encodeURIComponent(chapterId),{method:'DELETE'});hasChapterCover=false;$('#chapter-cover-preview').hidden=true;$('#chapter-cover').value='';$('#remove-chapter-cover').hidden=true;message($('#chapter-meta-status'),'已删除章节封面');update();}catch(e){message($('#chapter-meta-status'),e.message,true);}
  });
  $('#save-chapter-meta').addEventListener('click',()=>void saveChapterMeta());
  $('#save-book-meta').addEventListener('click',()=>void saveBookMeta());
  $('#create-tag').addEventListener('click',async()=>{
    const input=$('#new-tag-name');const name=trim(input.value);if(!name)return;
    try{const data=await request('/api/admin/tags',payload({name},'POST'));tagList.push(data.tag);selectedTags.add(Number(data.tag.id));input.value='';renderTags();update();message($('#book-meta-status'),'新 Tag 已创建，请点击「保存作品资料」完成关联。');}
    catch(e){message($('#book-meta-status'),'添加 Tag 失败：'+e.message,true);}
  });
  document.addEventListener('keydown',e=>{
    if(!(e.metaKey||e.ctrlKey))return;
    const k=e.key.toLowerCase();
    if(k==='s'){e.preventDefault();void saveChapter();}
  });
  window.addEventListener('beforeunload',e=>{if(dirty()&&!suppressUnload){e.preventDefault();e.returnValue='';}});
  let theme='paper';try{theme=localStorage.getItem('archive-theme')||'paper';}catch{}
  const themeButton=$('#theme-switch');
  const applyTheme=()=>{document.documentElement.dataset.archiveTheme=theme;themeButton.textContent=theme==='night'?'☀':'☾';};
  themeButton.addEventListener('click',()=>{theme=theme==='night'?'paper':'night';try{localStorage.setItem('archive-theme',theme);}catch{}applyTheme();});
  applyTheme();void init();
})();
