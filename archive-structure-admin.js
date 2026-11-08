/* Unified chapter studio. A group holds one or more actual D1 chapters.
   Changes are staged locally until Save; only explicit deletes are immediate. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const node = (tag, cls = '', value) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value !== undefined) n.textContent = value;
    return n;
  };
  const clean = s => String(s ?? '').trim();
  const idOK = id => /^[1-9]\d*$/.test(String(id ?? ''));
  const titleMax = 200;
  let groups = [], chosen = new Set(), organizing = false, focus = null;
  let dirty = false, busy = false, seq = 0, drag = null, currentBook = null;

  async function json(path, options = {}) {
    const res = await fetch(path, {credentials:'same-origin',cache:'no-store', ...options});
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(result.error || `服务器返回 ${res.status}`);
    return result;
  }
  const request = (method, path, data) => json(path, {
    method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
  });
  function notice(message, error = false) {
    const el = $('#structure-status'); el.textContent = message; el.classList.toggle('is-error', error);
  }
  function setDirty() { dirty = true; updateSaveUI(); }
  function updateSaveUI() {
    const n = groups.reduce((sum,g)=>sum+g.chapters.length,0);
    $('#chapter-count').textContent = n;
    $('#save-state').textContent = busy ? '保存中…' : dirty ? '● 存在未保存的修改' : '✓ 已保存';
    $('#save-structure').disabled = busy || !dirty;
    $('#structure-summary').textContent = `共 ${groups.length} 个大章 · ${n} 个正文单元`;
    $('#reload-structure').hidden = false;
    $('#selected-count').textContent = `已选 ${chosen.size} 个篇目`;
    $('#merge-selected').disabled = chosen.size < 2;
    $('#split-selected').disabled = chosen.size === 0;
    $('#delete-selected').disabled = chosen.size === 0 || dirty;
  }
  const gkey = () => 'g' + (++seq);
  function groupContaining(chapterId) {
    return groups.find(g => g.chapters.some(c => c.id === chapterId));
  }
  function chapterById(chapterId) {
    return groupContaining(chapterId)?.chapters.find(c => c.id === chapterId);
  }
  function removeEmpty() { groups = groups.filter(g => g.chapters.length); }
  function makeGroup(title, kind, chapters) {
    return {key:gkey(), title, kind, chapters, collapsed:false};
  }
  function initializeTree(chapters, metadata) {
    const m = new Map((metadata || []).map(x => [Number(x.chapterId), x]));
    groups = [];
    const byGroup = new Map();
    for (const ch of chapters.slice().sort((a,b) => a.sort_order - b.sort_order || a.id - b.id)) {
      const meta = m.get(Number(ch.id)) || {};
      const groupTitle = clean(meta.groupTitle) || ch.title;
      const kind = meta.kind === 'extra' ? 'extra' : meta.kind === 'main' ? 'main' : /番外|外传|特别篇|补遗/.test(ch.title) ? 'extra' : 'main';
      const key = kind + '\u0000' + groupTitle;
      let group = byGroup.get(key);
      if (!group) { group = makeGroup(groupTitle,kind,[]); groups.push(group); byGroup.set(key,group); }
      group.chapters.push({id:Number(ch.id), title:ch.title, sectionTitle:clean(meta.sectionTitle)||ch.title, words:Number(ch.word_count)||0});
    }
    chosen.clear(); organizing=false; focus=null; dirty=false; $('#chapter-search').value='';
    $('#toggle-organize').textContent='多选整理';
    $('#selection-panel').hidden=true;
  }
  function allChapters() { return groups.flatMap(g=>g.chapters); }
  function ensureUniqueGroupName(group) {
    const clash = groups.some(g=>g!==group && g.title===group.title && g.kind===group.kind);
    if (clash) {notice('已经有同名大章。请改成其他名称，或通过「所属大章」把小节移进去。',true);return false;}
    return true;
  }
  function moveGroup(from, to, after = false) {
    const a = groups.findIndex(g=>g.key===from), b=groups.findIndex(g=>g.key===to);
    if (a<0 || b<0 || a===b) return;
    const [item] = groups.splice(a,1);
    const target = groups.findIndex(g=>g.key===to);
    groups.splice(target + (after?1:0),0,item);
    setDirty(); render();
  }
  function moveChapter(id, targetId, after = false) {
    if (id===targetId) return;
    const source=groupContaining(id), destination=groupContaining(targetId);
    if (!source || !destination) return;
    // Two standalone chapters are reordered, not silently merged.
    if (source !== destination && source.chapters.length===1 && destination.chapters.length===1) {
      moveGroup(source.key,destination.key,after);
      focus={type:'chapter',id};render();return;
    }
    const from=source.chapters.findIndex(c=>c.id===id);
    const [item]=source.chapters.splice(from,1);
    const position=destination.chapters.findIndex(c=>c.id===targetId);
    destination.chapters.splice(position+(after?1:0),0,item);
    removeEmpty();
    focus={type:'chapter',id};setDirty();render();
  }
  function appendChapter(id,groupKey) {
    const source=groupContaining(id),destination=groups.find(g=>g.key===groupKey);
    if (!source || !destination || source===destination) return;
    const from=source.chapters.findIndex(c=>c.id===id);
    const [item]=source.chapters.splice(from,1);
    destination.chapters.push(item);
    removeEmpty();focus={type:'chapter',id};setDirty();render();
  }
  function moveChapterInside(id, direction) {
    const g=groupContaining(id);if(!g)return;
    const idx=g.chapters.findIndex(c=>c.id===id),to=idx+direction;
    if(to<0||to>=g.chapters.length)return;
    const [ch]=g.chapters.splice(idx,1);g.chapters.splice(to,0,ch);setDirty();render();
  }
  function disbandGroup(group) {
    const at=groups.indexOf(group);if(at<0)return;
    const parts=group.chapters.map(ch=>makeGroup(ch.sectionTitle,group.kind,[ch]));
    groups.splice(at,1,...parts);focus={type:'chapter',id:parts[0].chapters[0].id};setDirty();render();
  }
  function detachChapters(ids) {
    for(const id of ids) {
      const g=groupContaining(id);if(!g)continue;
      const ch=g.chapters.find(c=>c.id===id);
      const index=groups.indexOf(g);
      g.chapters.splice(g.chapters.indexOf(ch),1);
      const own=makeGroup(ch.sectionTitle,g.kind,[ch]);
      groups.splice(index+(g.chapters.length?1:0),0,own);
      removeEmpty();
    }
    chosen.clear();setDirty();render();
  }
  function mergeSelected() {
    if (chosen.size<2) {notice('至少选择两个篇目才能合并。',true);return;}
    const title=clean($('#merge-title').value);
    if(!title || title.length>titleMax) {notice('请填写 1 至 200 字的大章名称。',true);return;}
    const selected=allChapters().filter(c=>chosen.has(c.id));
    const selectedKinds=new Set(selected.map(c=>groupContaining(c.id)?.kind));
    if(selectedKinds.size>1){notice('正文和番外请分开合并。',true);return;}
    const anchor=groups.findIndex(g=>g.chapters.some(c=>chosen.has(c.id)));
    const kind=groups[anchor]?.kind||'main';
    if(groups.some(g=>g.title===title && g.kind===kind)) {notice('这个大章名称已存在。请改一个名称，或在右侧「所属大章」里移动小节。',true);return;}
    for(const g of groups)g.chapters=g.chapters.filter(c=>!chosen.has(c.id));
    removeEmpty();
    const dest=makeGroup(title,kind,selected);
    groups.splice(Math.min(anchor,groups.length),0,dest);
    chosen.clear();organizing=false;$('#selection-panel').hidden=true;$('#toggle-organize').textContent='多选整理';
    focus={type:'group',key:dest.key};setDirty();render();notice('已合并 '+selected.length+' 节。确认后点击顶部保存。');
  }
  function render() {
    const root=$('#chapter-tree');root.replaceChildren();
    const query=clean($('#chapter-search').value).toLocaleLowerCase();
    $('#search-hint').textContent=query?'搜索模式暂时关闭拖动和排序。清空搜索后恢复。':'';
    if(!groups.length){root.append(node('div','studio-empty','这里还没有章节。可点击上方「新增章节」。'));renderInspector();updateSaveUI();return;}
    let shown=0;
    for(const g of groups){
      const visible=g.chapters.filter(c=>!query || (g.title+' '+c.sectionTitle+' '+c.title).toLocaleLowerCase().includes(query));
      if (!visible.length) continue;
      shown+=visible.length;
      const group=node('section','studio-group'+(focus?.type==='group'&&focus.key===g.key?' is-selected':'')+(g.chapters.length===1?' studio-group-single':''));
      group.dataset.groupKey=g.key;
      const single=g.chapters.length===1;
      if (!single) {
        const header=node('div','studio-row studio-group-row');
        const grip=node('span','studio-handle','⋮⋮');grip.title='拖动整个大章';grip.draggable=!organizing&&!query;
        grip.setAttribute('aria-label','拖动大章 '+g.title);
        bindDrag(grip,{type:'group',key:g.key});
        header.append(grip);
        const toggle=node('button','studio-toggle',g.collapsed&&!query?'▸':'▾');toggle.type='button';toggle.title='展开/收起大章';toggle.addEventListener('click',()=>{g.collapsed=!g.collapsed;render();});header.append(toggle);
        const main=entryButton(g.title,`${g.chapters.length} 节 · ${g.kind==='extra'?'番外':'正文'}`,()=>{focus={type:'group',key:g.key};render();});
        header.append(main);
        if(focus?.type==='group'&&focus.key===g.key)header.append(node('span','studio-selected-marker'));
        bindDrop(header,()=>({type:'group',key:g.key}));
        group.append(header);
      }
      if(!g.collapsed||query||single){
        for(const c of visible){
          const row=node('div','studio-chapter'+(focus?.type==='chapter'&&focus.id===c.id?' is-selected':''));
          row.dataset.chapterId=String(c.id);
          if(organizing){const check=node('input','studio-chapter-checkbox');check.type='checkbox';check.checked=chosen.has(c.id);check.setAttribute('aria-label','选择'+c.sectionTitle);check.addEventListener('change',()=>{if(check.checked)chosen.add(c.id);else chosen.delete(c.id);updateSaveUI();});row.append(check);}
          else {const grip=node('span','studio-handle','⋮⋮');grip.title='拖动调整顺序';grip.draggable=!query;bindDrag(grip,{type:'chapter',id:c.id});row.append(grip);}
          const sub=single?`${c.words.toLocaleString()} 字 · ${g.kind==='extra'?'番外':'独立章节'}`:`${c.words.toLocaleString()} 字`;
          row.append(entryButton(c.sectionTitle,sub,()=>{focus={type:'chapter',id:c.id};render();}));
          if(focus?.type==='chapter'&&focus.id===c.id)row.append(node('span','studio-selected-marker'));
          if(!query)bindDrop(row,()=>({type:'chapter',id:c.id}));
          group.append(row);
        }
      }
      root.append(group);
    }
    if(!shown)root.append(node('div','studio-empty','没有匹配的章节。'));
    renderInspector();updateSaveUI();
  }
  function entryButton(label, sub, callback){
    const b=node('button','studio-entry-main');b.type='button';b.append(node('strong','',label),node('small','',sub));b.addEventListener('click',callback);return b;
  }
  function bindDrag(handle,item){
    handle.addEventListener('dragstart',e=>{if(organizing || clean($('#chapter-search').value)){e.preventDefault();return;}drag=item;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',JSON.stringify(item));handle.closest('.studio-group,.studio-chapter')?.classList.add('is-dragging');});
    handle.addEventListener('dragend',()=>{drag=null;document.querySelectorAll('.is-dragging,.is-dragover').forEach(x=>x.classList.remove('is-dragging','is-dragover'));});
  }
  function bindDrop(el,destination){
    el.addEventListener('dragover',e=>{if(!drag)return;e.preventDefault();e.dataTransfer.dropEffect='move';el.classList.add('is-dragover');});
    el.addEventListener('dragleave',()=>el.classList.remove('is-dragover'));
    el.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();el.classList.remove('is-dragover');if(!drag)return;
      const t=destination(), after=e.clientY>el.getBoundingClientRect().top+el.getBoundingClientRect().height/2;
      if(drag.type==='group'){
        const target=t.type==='group'?t.key:groupContaining(t.id)?.key;
        if(target)moveGroup(drag.key,target,after);
      } else if(t.type==='group') appendChapter(drag.id,t.key);
      else moveChapter(drag.id,t.id,after);
      drag=null;
    });
  }
  function field(label,value,onInput,hint=''){
    const wrap=node('div','studio-field');const lab=node('label','',label);const input=node('input');input.type='text';input.maxLength=200;input.value=value;input.addEventListener('input',()=>{onInput(clean(input.value),false);setDirty();});input.addEventListener('change',()=>{onInput(clean(input.value),true);render();});wrap.append(lab,input);if(hint)wrap.append(node('small','',hint));return wrap;
  }
  function selectField(label,options,value,onChange){
    const wrap=node('div','studio-field'),lab=node('label','',label),sel=node('select');
    for(const opt of options){const e=node('option','',opt.label);e.value=opt.value;sel.append(e);}sel.value=value;
    sel.addEventListener('change',()=>onChange(sel.value));wrap.append(lab,sel);return wrap;
  }
  function action(label,callback,cls='soft'){
    const btn=node('button','studio-btn '+cls,label);btn.type='button';btn.addEventListener('click',callback);return btn;
  }
  function renderInspector(){
    const root=$('#inspector-content');root.replaceChildren();
    if(!focus){root.append(node('div','studio-empty','点击左侧章节，在这里编辑标题、归属、正文或导出文件。'));return;}
    if(focus.type==='group'){
      const group=groups.find(g=>g.key===focus.key);
      if(!group){focus=null;return renderInspector();}
      root.append(node('p','studio-item-count',`大章 · ${group.chapters.length} 个小节`));
      root.append(field('大章标题',group.title,(v,changed)=>{
        group.title=v;if(changed)ensureUniqueGroupName(group);
      },'这是系列目录中可展开的标题。'));
      root.append(selectField('分类',[{value:'main',label:'正文'},{value:'extra',label:'番外'}],group.kind,v=>{group.kind=v;setDirty();render();}));
      const bar=node('div','studio-inspector-actions');
      bar.append(action('↑ 上移整章',()=>moveGroup(group.key,groups[groups.indexOf(group)-1]?.key||'',false)));
      bar.append(action('↓ 下移整章',()=>moveGroup(group.key,groups[groups.indexOf(group)+1]?.key||'',true)));
      root.append(bar);
      const bar2=node('div','studio-inspector-actions');bar2.append(action('拆分为独立章节',()=>{if(confirm('把这一回的所有小节拆成独立章？正文不会被删除。'))disbandGroup(group);}));root.append(bar2);
      root.append(node('p','studio-tip','想把其他章节移进这一回？选中小节，在右侧「所属大章」里选择它；也可以直接拖到左侧大章标题上。'));
      return;
    }
    const ch=chapterById(focus.id), g=groupContaining(focus.id);
    if(!ch||!g){focus=null;return renderInspector();}
    root.append(node('p','studio-item-count',`正文单元 #${ch.id} · ${ch.words.toLocaleString()} 字`));
    root.append(field('节标题（阅读页也会同步更新）',ch.sectionTitle,(v,changed)=>{
      const old=ch.sectionTitle;ch.sectionTitle=v;
      if(g.chapters.length===1 && g.title===old)g.title=v;
    },'保存后同步修改 D1 的正式章节标题，正文页、后台和上下章导航都会一致。'));
    const opts=[{value:'__single__',label:'独立成章'},...groups.filter(x=>x!==g).map(x=>({value:x.key,label:x.title+'（'+(x.kind==='extra'?'番外':'正文')+'）'}))];
    opts.push({value:g.key,label:g.title+'（当前）'});
    root.append(selectField('所属大章',opts,g.key,val=>{
      if(val==='__single__')detachChapters([ch.id]);
      else appendChapter(ch.id,val);
    }));
    root.append(selectField('分类',[{value:'main',label:'正文'},{value:'extra',label:'番外'}],g.kind,val=>{
      if(g.chapters.length===1){g.kind=val;setDirty();render();}
      else{const idx=groups.indexOf(g);g.chapters=g.chapters.filter(x=>x.id!==ch.id);groups.splice(idx+1,0,makeGroup(ch.sectionTitle,val,[ch]));setDirty();render();}
    }));
    const moveBar=node('div','studio-inspector-actions');
    const at=g.chapters.indexOf(ch);const up=action('↑ 上移一节',()=>moveChapterInside(ch.id,-1));up.disabled=at===0;
    const down=action('↓ 下移一节',()=>moveChapterInside(ch.id,1));down.disabled=at===g.chapters.length-1;
    moveBar.append(up,down);root.append(moveBar);
    root.append(node('hr','studio-rule'));
    const actions=node('div','studio-inspector-actions');
    const edit=node('a','studio-btn primary','编辑正文 ↗');edit.href='/chapter-editor.html?id='+ch.id;
    const view=node('a','studio-btn soft','阅读预览 ↗');view.href='/read.html?id='+ch.id;view.target='_blank';view.rel='noopener noreferrer';
    actions.append(edit,view);root.append(actions);
    const more=node('div','studio-inspector-actions');
    more.append(action('导出 TXT',()=>void exportChapter(ch)));
    more.append(action('删除章节',()=>void deleteChapter(ch),'danger'));root.append(more);
    root.append(node('p','studio-tip','删除会立即执行且无法撤销。修改章名、节名与排序则需要点击顶部保存。'));
  }
  async function exportChapter(ch){
    try{const data=await json('/api/chapters/'+ch.id);downloadTxt((ch.sectionTitle||ch.title)+'.txt',data.content||'');notice('已导出该章节。');}
    catch(e){notice('导出失败：'+e.message,true);}
  }
  function downloadTxt(filename,content){
    const safe=filename.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150);
    const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
    const a=node('a');a.href=url;a.download=safe||'chapter.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function exportBook(){
    const chapters=allChapters();
    if(!chapters.length){notice('这本书没有可导出的正文。');return;}
    if(chapters.length>150 && !confirm('本书包含 '+chapters.length+' 节，导出可能占用较多浏览器内存，确定继续？'))return;
    const button=$('#export-book');button.disabled=true;
    try{
      const parts=[];
      for(let i=0;i<chapters.length;i++){
        notice(`正在导出第 ${i+1} / ${chapters.length} 节…`);
        const ch=chapters[i];const data=await json('/api/chapters/'+ch.id);
        parts.push(ch.sectionTitle+'\n\n'+(data.content||''));
      }
      downloadTxt(($('#structure-book').selectedOptions[0]?.textContent||'全书')+'.txt',parts.join('\n\n\n'));
      notice('全书 TXT 已导出，共 '+chapters.length+' 节。');
    }catch(e){notice('导出中断：'+e.message,true);}finally{button.disabled=false;}
  }
  async function deleteSelected(){
    if(dirty){notice('请先保存或放弃未保存的目录修改，才能批量删除。',true);return;}
    const ids=[...chosen];if(!ids.length)return;
    if(!confirm('将永久删除 '+ids.length+' 个章节及其相关数据，确定继续？'))return;
    if(prompt('为防误操作，请输入「删除」继续：')!=='删除')return;
    let completed=0;
    try{
      for(const id of ids){
        await json('/api/admin/chapters/'+id,{method:'DELETE'});
        completed++;notice('已删除 '+completed+' / '+ids.length+' 节…');
      }
      await load();notice('已删除 '+completed+' 个章节。');
    }catch(e){await load();notice('已删除 '+completed+' 个章节，剩余操作中断：'+e.message,true);}
  }
  async function deleteChapter(ch){
    if(dirty){notice('请先保存或放弃未保存的目录修改，再删除章节。',true);return;}
    if(!confirm('确定永久删除章节「'+ch.title+'」？正文和该章节评论可能一并删除，此操作不可撤销。'))return;
    try{await json('/api/admin/chapters/'+ch.id,{method:'DELETE'});notice('章节已删除，正在更新目录…');await load();}
    catch(e){notice('删除失败：'+e.message,true);}
  }
  function toggleOrganize(on){organizing=on;chosen.clear();$('#selection-panel').hidden=!on;$('#toggle-organize').textContent=on?'退出整理':'多选整理';render();}
  function collect(){return groups.flatMap(g=>g.chapters.map(c=>({chapterId:c.id,groupTitle:clean(g.title),sectionTitle:clean(c.sectionTitle),kind:g.kind})));}
  async function save(){
    if(busy||!dirty)return;
    const items=collect();
    if(items.some(x=>!x.groupTitle || !x.sectionTitle || x.groupTitle.length>200 || x.sectionTitle.length>200)) {notice('每个大章和小节都需要填写有效标题，最多200字。',true);return;}
    const names=new Set();for(const g of groups){const key=g.kind+':'+g.title;if(names.has(key)){notice('检测到重复大章名称：'+g.title+'。请先合并或重命名。',true);return;}names.add(key);}
    busy=true;updateSaveUI();notice('正在保存标题、分组及阅读顺序…');
    try{
      const result=await request('PUT','/api/admin/archive-structure?bookId='+currentBook,{items});
      dirty=false;notice('保存成功！已更新 '+result.count+' 个章节。阅读页标题和上下章顺序会同步生效。');
      await load(true);
    }catch(e){notice('保存失败：'+e.message,true);}
    finally{busy=false;updateSaveUI();}
  }
  async function load(keepStatus=false){
    if(!idOK(currentBook))return;
    if(!keepStatus)notice('正在加载章节…');
    try{
      const [data,structure]=await Promise.all([
        json('/api/books/'+currentBook),json('/api/archive-structure?bookId='+currentBook+'&t='+Date.now())
      ]);
      initializeTree(data.chapters||[],structure.items||[]);
      $('#structure-preview').href='/book.html?id='+currentBook;
      $('#new-chapter').href='/chapter-editor.html?book='+currentBook;
      $('#structure-tools').hidden=false;
      render();
      if(!keepStatus)notice('已载入《'+data.book.title+'》。选择左侧章或节，在右侧进行编辑。');
    }catch(e){notice('加载目录失败：'+e.message,true);}
  }
  async function init(){
    try{
      const me=await json('/api/me');if(me.role!=='super_admin')throw Error('该页面仅限超级管理员');
      const response=await json('/api/books');
      const books=(response.books||[]).filter(b=>!b.status||b.status==='normal');
      const select=$('#structure-book');
      if(!books.length){notice('请先在后台创建一本书。');return;}
      for(const b of books){const opt=node('option','',b.title);opt.value=b.id;select.append(opt);}
      const requested=new URLSearchParams(location.search).get('bookId');
      if(idOK(requested)&&books.some(b=>String(b.id)===requested))select.value=requested;
      currentBook=select.value;
      select.addEventListener('change',async()=>{
        if(dirty&&!confirm('切换书籍将放弃未保存修改，确定继续？')){select.value=currentBook;return;}
        currentBook=select.value;await load();
      });
      $('#chapter-search').addEventListener('input',render);
      $('#toggle-organize').addEventListener('click',()=>toggleOrganize(!organizing));
      $('#cancel-organize').addEventListener('click',()=>toggleOrganize(false));
      $('#merge-selected').addEventListener('click',mergeSelected);
      $('#split-selected').addEventListener('click',()=>{if(chosen.size)detachChapters([...chosen]);});
      $('#delete-selected').addEventListener('click',()=>void deleteSelected());
      $('#export-book').addEventListener('click',()=>void exportBook());
      $('#select-all').addEventListener('click',()=>{
        const search=clean($('#chapter-search').value).toLocaleLowerCase();
        const visible=allChapters().filter(c=>!search||(c.sectionTitle+' '+c.title+' '+(groupContaining(c.id)?.title||'')).toLocaleLowerCase().includes(search));
        const all=visible.every(c=>chosen.has(c.id));for(const c of visible){if(all)chosen.delete(c.id);else chosen.add(c.id);}render();
      });
      $('#save-structure').addEventListener('click',()=>void save());
      $('#reload-structure').addEventListener('click',()=>{if(!dirty||confirm('确认放弃所有尚未保存的修改？'))void load();});
      window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
      await load();
    }catch(e){notice('无法打开章节工作台：'+e.message+'。请先登录作者后台。',true);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else void init();
})();
