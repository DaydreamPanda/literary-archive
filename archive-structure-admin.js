/* Manual chapter grouping and ordering, backed by D1. No auto grouping. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const status = $('#structure-status');
  const say = (message, bad = false) => { status.textContent = message; status.style.color = bad ? '#a15b50' : ''; };
  async function json(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || 'HTTP ' + response.status);
    return data;
  }
  const title = value => String(value || '').trim();
  let rows = [], dirty = false, busy = false, draggingId = null;
  function touch() { dirty = true; summary(); }
  function collect() { return rows.map(row => ({ chapterId: row.id, groupTitle: title(row.groupTitle), sectionTitle: title(row.sectionTitle), kind: row.kind })); }
  function summary() {
    const grouped = new Map();
    for (const row of collect()) {
      const key = row.kind + ':' + row.groupTitle;
      if (!grouped.has(key)) grouped.set(key, { name: row.groupTitle, count: 0 });
      grouped.get(key).count++;
    }
    $('#structure-summary').textContent = (dirty ? '● 有未保存的修改\n' : '✓ 当前已保存\n') +
      [...grouped.values()].map(x => x.name + '（' + x.count + ' 节' + (x.count > 1 ? '，可展开' : '，直接阅读') + '）').join('　　');
  }
  function move(id, to) {
    const from = rows.findIndex(x => x.id === id);
    if (from < 0 || to < 0 || to >= rows.length || from === to) return;
    const [row] = rows.splice(from, 1); rows.splice(to, 0, row);
    render();touch();
  }
  function node(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function input(cls, value, onChange) {
    const el = node('input', cls); el.type = 'text'; el.maxLength = 200; el.value = value;
    el.addEventListener('input', () => { onChange(el.value); touch(); });
    return el;
  }
  function render() {
    const root = $('#structure-rows');root.replaceChildren();
    rows.forEach((row, index) => {
      const card = node('div', 'manual-row');card.draggable = true;card.dataset.id = String(row.id);
      const selected = node('input', 'select-chapter');selected.type = 'checkbox';selected.checked = !!row.selected;
      selected.setAttribute('aria-label', '选择 ' + row.title);
      selected.addEventListener('change', () => {row.selected = selected.checked;});
      const handle = node('span', 'drag-handle', '☰');handle.title = '拖动调整顺序';
      const source = node('div', 'source', row.title);
      source.append(node('small', '', '当前顺序 ' + (index + 1) + ' · ' + row.words + ' 字'));
      const group = input('group-title', row.groupTitle, value => { row.groupTitle = value; });
      group.placeholder = '所属大章';group.setAttribute('aria-label','所属大章：'+row.title);
      const section = input('section-title', row.sectionTitle, value => { row.sectionTitle = value; });
      section.placeholder = '节标题';section.setAttribute('aria-label','节标题：'+row.title);
      const kind = node('select', 'chapter-kind');
      for (const [value, label] of [['main', '正文'], ['extra', '番外']]) {const option = node('option', '', label);option.value=value;kind.append(option);}
      kind.value = row.kind;kind.addEventListener('change',()=>{row.kind=kind.value;touch();});
      const actions = node('div','move-actions');
      const up = node('button', 'manual-btn light','↑');up.type='button';up.title='向上移动';up.disabled=index===0;up.addEventListener('click',()=>move(row.id,index-1));
      const down = node('button','manual-btn light','↓');down.type='button';down.title='向下移动';down.disabled=index===rows.length-1;down.addEventListener('click',()=>move(row.id,index+1));
      actions.append(up,down);card.append(selected,handle,source,group,section,kind,actions);
      card.addEventListener('dragstart',event=>{draggingId=row.id;card.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(row.id));});
      card.addEventListener('dragover',event=>{event.preventDefault();card.classList.add('dragover');});
      card.addEventListener('dragleave',()=>card.classList.remove('dragover'));
      card.addEventListener('drop',event=>{event.preventDefault();card.classList.remove('dragover');if(draggingId!==null)move(draggingId,rows.findIndex(x=>x.id===row.id));});
      card.addEventListener('dragend',()=>{draggingId=null;root.querySelectorAll('.manual-row').forEach(x=>x.classList.remove('dragging','dragover'));});
      root.append(card);
    });
    summary();
  }
  async function load() {
    if(busy)return;
    const bookId=$('#structure-book').value;
    $('#structure-preview').href='/book.html?id='+encodeURIComponent(bookId);
    say('正在读取章节…');
    try {
      const [book,structure]=await Promise.all([
        json('/api/books/'+bookId),json('/api/archive-structure?bookId='+bookId+'&t='+Date.now())
      ]);
      const existing=new Map((structure.items||[]).map(x=>[Number(x.chapterId),x]));
      rows=(book.chapters||[]).slice().sort((a,b)=>a.sort_order-b.sort_order || a.id-b.id).map(ch=>{
        const meta=existing.get(Number(ch.id));return {
          id:Number(ch.id),title:ch.title,words:ch.word_count||0,selected:false,
          groupTitle:meta?.groupTitle||ch.title,sectionTitle:meta?.sectionTitle??ch.title,
          kind:meta?.kind||(/番外|外传|特别篇|补遗/.test(ch.title)?'extra':'main')
        };
      });
      dirty=false;render();say(`已加载 ${rows.length} 个篇目。拖动、修改大章名称或勾选合并后，点击「保存目录与顺序」。`);
    }catch(e){say('加载失败：'+e.message,true);}
  }
  function merge() {
    const chosen=rows.filter(r=>r.selected);const name=title($('#merge-title').value);
    if(chosen.length<2){say('请至少勾选两个篇目再合并。',true);return;}
    if(!name){say('先填写一个大章名称。',true);$('#merge-title').focus();return;}
    // Keep merged sections adjacent so the table of contents and prev/next links agree.
    const firstIndex=rows.findIndex(r=>r.selected);
    const chosenIds=new Set(chosen.map(r=>r.id));
    rows=rows.filter(r=>!chosenIds.has(r.id));
    chosen.forEach((row,index)=>{row.groupTitle=name;row.selected=false;rows.splice(firstIndex+index,0,row);});
    render();touch();say('已将 '+chosen.length+' 节合并并排在一起，点击保存才会生效。');
  }
  function split() {
    const chosen=rows.filter(r=>r.selected);
    if(!chosen.length){say('请先选择要拆分的篇目。',true);return;}
    for(const row of chosen){row.groupTitle=row.title;row.sectionTitle=row.title;row.selected=false;}
    render();touch();say('已在编辑区拆分 '+chosen.length+' 节，点击保存才会生效。');
  }
  async function save(){
    if(busy)return;
    const items=collect();
    if(items.some(x=>!x.groupTitle)){say('每一行都需要填写「所属大章」。',true);return;}
    if(items.some(x=>x.groupTitle.length>200||x.sectionTitle.length>200)){say('标题不能超过200字符。',true);return;}
    busy=true;$('#save-structure').disabled=true;say('正在同时保存目录及阅读顺序…');
    try{
      const result=await json('/api/admin/archive-structure?bookId='+$('#structure-book').value,{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})
      });
      dirty=false;summary();say('保存成功！'+result.count+' 个篇目，顺序已更新。打开系列页或阅读页查看。');
    }catch(e){say('保存失败：'+e.message,true);}finally{busy=false;$('#save-structure').disabled=false;}
  }
  async function init(){
    try{
      const me=await json('/api/me');if(me.role!=='super_admin')throw Error('需要超级管理员权限');
      const data=await json('/api/books');const books=(data.books||[]).filter(b=>!b.status||b.status==='normal');
      const select=$('#structure-book');
      if(!books.length){say('请先创建作品。');return;}
      for(const book of books){const op=node('option','',book.title);op.value=book.id;select.append(op);}
      const requested=new URLSearchParams(location.search).get('bookId');
      if(requested&&books.some(x=>String(x.id)===requested))select.value=requested;
      $('#structure-tools').hidden=false;
      select.addEventListener('change',async()=>{if(dirty&&!confirm('放弃未保存的目录修改并切换作品？'))return;await load();});
      $('#save-structure').addEventListener('click',save);
      $('#reload-structure').addEventListener('click',()=>{if(!dirty||confirm('放弃未保存的修改？'))void load();});
      $('#merge-selected').addEventListener('click',merge);
      $('#split-selected').addEventListener('click',split);
      $('#select-all').addEventListener('click',()=>{const all=rows.length>0&&rows.every(x=>x.selected);rows.forEach(x=>x.selected=!all);render();});
      window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
      await load();
    }catch(e){say('无法打开目录编辑器：'+e.message+'。请先登录作者后台。',true);}
  }
  init();
})();
