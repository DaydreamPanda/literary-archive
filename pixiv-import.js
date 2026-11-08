/* Pixiv EPUB migrator for DaydreamPanda literary archive.
 * Reads a user-selected EPUB locally with the existing JSZip library.
 * Each Pixiv HTML chapter page becomes one D1 chapter; numbered headings inside are preserved.
 * No remote cross-site fetches, no OAuth, no new database schema.
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const state = {items:[], cover:null, fileName:'', busy:false, bookId:null, bookCoverPath:null};
  const validId = n => /^[1-9]\d*$/.test(String(n ?? ''));
  const status = (s, isError=false) => {$('#file-info').textContent=s;$('#file-info').classList.toggle('bad',isError);};
  const importStatus = (s, isError=false) => {$('#import-status').textContent=s;$('#import-status').classList.toggle('bad',isError);};
  const log = s => {const el=$('#import-log');el.hidden=false;el.textContent+=(el.textContent?'\n':'')+s;el.scrollTop=el.scrollHeight;};
  const trim = s => String(s ?? '').trim();
  function pathJoin(dir, href) {
    const clean = decodeURIComponent(String(href||'').split('#')[0].split('?')[0]);
    if (!clean || /^(?:[a-z]+:|\/)/i.test(clean)) throw Error('EPUB 包含不支持的外部资源路径');
    const parts = [];
    for (const part of ((dir ? dir+'/' : '') + clean).replace(/\\/g,'/').split('/')) {
      if (!part || part==='.') continue;
      if (part==='..') {if(!parts.length) throw Error('EPUB 路径越界');parts.pop();}
      else parts.push(part);
    }
    return parts.join('/');
  }
  const dirname = file => file.includes('/') ? file.slice(0,file.lastIndexOf('/')) : '';
  function epubSubjects(opf){
    const nodes=opf.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/','subject');
    // EPUB metadata may list the same Pixiv tag more than once.
    const seen=new Set(), tags=[];
    for(const el of nodes){const v=trim(el.textContent).slice(0,50);if(v&&!seen.has(v)){seen.add(v);tags.push(v);}}
    return tags.slice(0,20);
  }
  function metaByName(xml,name) {
    const arr=xml.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/',name);
    const value=arr.length ? arr[0].textContent : '';
    return trim(value);
  }
  function inlineMarkdown(node) {
    if (node.nodeType===Node.TEXT_NODE) return node.nodeValue||'';
    if (node.nodeType!==Node.ELEMENT_NODE) return '';
    const tag=node.tagName.toLowerCase();
    if (['script','style','img','svg','iframe','rt','rp'].includes(tag)) return '';
    if (tag==='br') return '\n';
    const value=[...node.childNodes].map(inlineMarkdown).join('');
    if (!value) return '';
    if (tag==='strong'||tag==='b') return '**'+value.trim()+'**';
    if (tag==='em'||tag==='i') return '*'+value.trim()+'*';
    return value;
  }
  function chapterMarkdown(elements) {
    const out=[];
    function visit(node) {
      if(node.nodeType===Node.TEXT_NODE){if(node.nodeValue?.trim())out.push(node.nodeValue.trim());return;}
      if(node.nodeType!==Node.ELEMENT_NODE)return;
      const tag=node.tagName.toLowerCase();
      if(['style','script','svg','img','iframe'].includes(tag) || node.classList.contains('ChapterBlockMarker'))return;
      if(tag==='br'){out.push('');return;}
      if(/^h[1-6]$/.test(tag)) {const t=trim(inlineMarkdown(node));if(t)out.push('\n'+('#'.repeat(Math.min(Number(tag[1]),6)))+' '+t+'\n');return;}
      if(tag==='blockquote'){const t=trim(inlineMarkdown(node));if(t)out.push('\n'+t.split(/\n+/).map(s=>'> '+s.trim()).join('\n')+'\n');return;}
      if(['p','li','pre'].includes(tag)) {const t=trim(inlineMarkdown(node));if(t)out.push(t);return;}
      for(const child of node.childNodes)visit(child);
    }
    elements.forEach(el=>visit(el));
    return out.join('\n').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function extractPixivPage(html,path,zip) {
    const doc=new DOMParser().parseFromString(html,'text/html');
    const bodyBlocks=[...doc.querySelectorAll('[id^="ChapterPage-"]')].filter(el=>el.classList.contains('ChapterContentBlock'));
    if(!bodyBlocks.length)return null; // skip cover/title/toc/notes/metadata pages
    const title=trim(doc.querySelector('h2.chapter-title')?.textContent||doc.querySelector('title')?.textContent||path.split('/').pop());
    const content=chapterMarkdown(bodyBlocks);
    if(!title||!content)return null;
    const descEl=doc.querySelector('#ChapterDescription');
    const summary=trim(descEl?.textContent||'').replace(/\n{3,}/g,'\n\n').slice(0,800);
    const img=doc.querySelector('.chapter-ugc > img[src]');
    let coverPath=null;
    if(img){try{coverPath=pathJoin(dirname(path),img.getAttribute('src'));if(!zip.file(coverPath))coverPath=null;}catch{}}
    return {title:title.slice(0,200),content,summary,coverPath,checked:true,imported:false,skipExisting:false};
  }
  async function loadEpub(file) {
    if(typeof JSZip==='undefined')throw Error('JSZip 加载失败，请刷新页面');
    if(file.size>50*1024*1024)throw Error('文件不能超过50MB');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const container=await zip.file('META-INF/container.xml')?.async('text');
    if(!container)throw Error('缺少 container.xml，文件可能不是有效 EPUB');
    const root=new DOMParser().parseFromString(container,'application/xml');
    const opfPath=root.querySelector('rootfile')?.getAttribute('full-path');
    if(!opfPath||!zip.file(opfPath))throw Error('未找到 EPUB 的 OPF 目录');
    const opf=new DOMParser().parseFromString(await zip.file(opfPath).async('text'),'application/xml');
    const opfDir=dirname(opfPath);
    const manifest=new Map();
    for (const el of opf.querySelectorAll('manifest item')) manifest.set(el.getAttribute('id'), {path:pathJoin(opfDir,el.getAttribute('href')), mime:el.getAttribute('media-type')||'',cover:el.getAttribute('properties')?.includes('cover-image')});
    const items=[];let extracted=0;
    for(const el of opf.querySelectorAll('spine itemref')){
      const item=manifest.get(el.getAttribute('idref'));
      if(!item || !/(?:xhtml|html|xml)/.test(item.mime) || !zip.file(item.path))continue;
      const html=await zip.file(item.path).async('text');
      extracted+=new TextEncoder().encode(html).byteLength;
      if(extracted>50*1024*1024)throw Error('正文解压后超过50MB');
      const itemData=extractPixivPage(html,item.path,zip);
      if(itemData){
        if(new TextEncoder().encode(itemData.content).byteLength>1_500_000)throw Error('有篇目的正文超过 D1 单章容量，请拆分或压缩后再导入');
        items.push(itemData);
      }
      if(items.length>500)throw Error('每次最多导入500个篇目');
    }
    if(!items.length)throw Error('没有识别到 Pixiv 正文文件（ChapterPage），请确认 EPUB 是该脚本导出的系列小说');
    let coverPath=null;
    const metaCover=opf.querySelector('metadata meta[name="cover"]')?.getAttribute('content');
    if(metaCover&&manifest.has(metaCover))coverPath=manifest.get(metaCover).path;
    if(!coverPath){for(const [,v] of manifest){if(v.cover){coverPath=v.path;break;}}}
    if(!coverPath){for(const [,v] of manifest){if(/cover-image\.(?:png|jpe?g|webp)$/i.test(v.path)){coverPath=v.path;break;}}}
    if(coverPath&&!zip.file(coverPath))coverPath=null;
    const rawDesc=metaByName(opf,'description');
    let desc=rawDesc;
    if(/<[^>]*>/.test(rawDesc))desc=new DOMParser().parseFromString(rawDesc,'text/html').body.textContent||rawDesc;
    return {zip,items,bookTitle:metaByName(opf,'title')||file.name.replace(/\.epub$/i,''),author:metaByName(opf,'creator'),description:trim(desc).slice(0,2000),coverPath,subjects:epubSubjects(opf)};
  }
  function subjects(){return [...new Set((state.source?.subjects||[]).map(trim).filter(Boolean))].slice(0,20);}
  function renderSubjects(){
    const root=$('#pixiv-subject-list');root.replaceChildren();
    for(let i=0;i<(state.source?.subjects||[]).length;i++){
      const line=document.createElement('div');line.className='pixiv-tag-row';
      const input=document.createElement('input');input.type='text';input.maxLength=50;input.value=state.source.subjects[i];
      input.setAttribute('aria-label','第 '+(i+1)+' 个 EPUB 标签');
      input.addEventListener('input',()=>{state.source.subjects[i]=input.value;update();});
      const remove=document.createElement('button');remove.type='button';remove.className='import-btn secondary';remove.textContent='移除';
      remove.addEventListener('click',()=>{state.source.subjects.splice(i,1);renderSubjects();update();});
      line.append(input,remove);root.append(line);
    }
    if(!root.children.length)root.textContent='此 EPUB 没有标签，你可以添加。';
  }
  async function syncBookTags(bookId){
    if(!validId(bookId))throw Error('作品编号无效');
    const incoming=subjects();if(!incoming.length){log('EPUB 没有需要补录的标签。');return 0;}
    const [current,all]=await Promise.all([
      getJson('/api/books/'+bookId), getJson('/api/admin/tags')
    ]);
    const existingIds=new Set((current.book?.tags||[]).map(x=>Number(x.id)));
    const names=new Map((all.tags||[]).map(x=>[trim(x.name),Number(x.id)]));
    let added=0;
    for(const tagName of incoming){
      let id=names.get(tagName);
      if(!id){
        try{const r=await getJson('/api/admin/tags',jsonBody({name:tagName},'POST'));id=Number(r.tag.id);}
        catch(e){
          // Another request may have created it since the initial list was fetched.
          if(/already exists|存在/i.test(e.message)){const fresh=await getJson('/api/admin/tags');id=Number((fresh.tags||[]).find(x=>trim(x.name)===tagName)?.id);}
          if(!id)throw e;
        }
        names.set(tagName,id);
      }
      if(!existingIds.has(id)){existingIds.add(id);added++;}
    }
    if(existingIds.size>20)throw Error('本书标签总数超过20，请在预览中减少标签');
    await getJson('/api/admin/book-tags',jsonBody({book_id:Number(bookId),tag_ids:[...existingIds]},'PUT'));
    log('作品 Tag 已关联：共 '+incoming.length+' 个，新增关联 '+added+' 个。');
    return added;
  }
  function buildPreview(){
    const tbody=$('#chapter-rows');tbody.replaceChildren();
    for(let i=0;i<state.items.length;i++){
      const c=state.items[i],tr=document.createElement('tr');
      const check=document.createElement('input');check.type='checkbox';check.checked=c.checked;check.addEventListener('change',()=>{c.checked=check.checked;update();});
      const td0=document.createElement('td');td0.append(check);
      const td1=document.createElement('td');const input=document.createElement('input');input.type='text';input.value=c.title;input.maxLength=200;input.addEventListener('input',()=>{c.title=trim(input.value);update();});
      const sub=document.createElement('div');sub.className='import-sub';sub.textContent=(c.summary?'含篇目简介 · ':'')+'原文件顺序 '+(i+1)+' · 内部数字小节保留在正文';td1.append(input,sub);
      const td2=document.createElement('td');td2.textContent=c.content.length.toLocaleString();
      const td3=document.createElement('td');td3.textContent=c.coverPath?'有':'无';tr.append(td0,td1,td2,td3);tbody.append(tr);
    }
    renderSubjects();
    $('#preview-step').hidden=false;$('#destination-step').hidden=false;update();
  }
  async function getJson(url,opts={}){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.error||('请求失败，HTTP '+r.status));
    return data;
  }
  const jsonBody=(obj,method)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
  async function refreshBooks(){
    const select=$('#existing-book');select.replaceChildren();
    const data=await getJson('/api/books');
    const books=data.books||[];
    for(const b of books){const option=document.createElement('option');option.value=b.id;option.textContent=b.title;select.append(option);}
    if(!books.length){const option=document.createElement('option');option.value='';option.textContent='暂无现有作品';select.append(option);}
  }
  function update(){
    const n=state.items.filter(x=>x.checked).length;
    $('#import-summary').textContent='已选择 '+n+' 个篇目';
    $('#start-import').disabled=state.busy||!n||!$('#confirm-import').checked||($('input[name="destination"]:checked')?.value==='new'&&!trim($('#book-name').value));
    $('#repair-tags').disabled=state.busy||!state.source||$('input[name="destination"]:checked')?.value!=='existing'||!validId($('#existing-book').value)||!subjects().length;
  }
  function guessGroup(title){
    const t=trim(title);
    const m=t.match(/^(第[零〇一二三四五六七八九十百千\d]+[回章节话篇])\s*[（(【\[]\s*([上中下])\s*(?:部|篇|节)?\s*[）)】\]]\s*(.*)$/)
      || t.match(/^(第[零〇一二三四五六七八九十百千\d]+[回章节话篇])\s*[：:·\s]+([上中下])(?:篇|部|节)?(?:[：:·\s]+(.*))?$/);
    if(m){const part=m[2], rest=trim(m[3]||'').replace(/^[：:·\s]+/,'');return {groupTitle:m[1],sectionTitle:(part+(rest?' · '+rest:'')).slice(0,200),kind:'main'};}
    return {groupTitle:t,sectionTitle:'',kind:/^(番外|后记|附录)/.test(t)?'extra':'main'};
  }
  async function imageFile(zip,path,filename){
    if(!path||!zip.file(path))return null;
    const raw=await zip.file(path).async('blob');
    if(raw.size>12_000_000)throw Error('封面源文件过大，请手动上传');
    // Self-contained D1 cover compression to <1MB, even for a large EPUB PNG.
    let bitmap;
    try{bitmap=await createImageBitmap(raw);}catch(e){throw Error('浏览器无法解码封面');}
    const limit=1100, ratio=Math.min(1,limit/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    for(const quality of [.86,.72,.55,.4]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob&&blob.size<980000)return new File([blob],filename,{type:'image/jpeg'});
    }
    throw Error('封面压缩后仍超过1MB，请在写作页面手动上传');
  }
  async function sendCover(zip,path,endpoint){
    const image=await imageFile(zip,path,'pixiv-cover.jpg');
    if(!image)return;
    const fd=new FormData();fd.set('file',image);
    return getJson(endpoint,{method:'POST',body:fd});
  }
  async function saveStructure(bookId,existing, mapping){
    const book=await getJson('/api/books/'+bookId);
    const oldMap=new Map((existing||[]).map(x=>[Number(x.chapterId),x]));
    const all=(book.chapters||[]).map(ch=>{
      const id=Number(ch.id);
      if(oldMap.has(id))return oldMap.get(id);
      const g=guessGroup(mapping.get(id)||ch.title);
      return {chapterId:id,groupTitle:g.groupTitle.slice(0,200),sectionTitle:g.sectionTitle.slice(0,200),kind:g.kind};
    });
    if(all.length>500)throw Error('本书章节超过500条，需在目录编辑器里手动分组');
    await getJson('/api/admin/archive-structure?bookId='+bookId,jsonBody({items:all},'PUT'));
  }
  async function runImport(){
    if(state.busy||!state.source||!$('#confirm-import').checked)return;
    const selected=state.items.filter(x=>x.checked);
    if(!selected.length)return;
    if(selected.some(x=>!trim(x.title))) {importStatus('请为每个选中的篇目填写标题',true);return;}
    if(new Set(selected.map(x=>trim(x.title))).size<selected.length) {importStatus('发现重复的篇目标题，请修改后再导入，避免误删或覆盖',true);return;}
    const dest=$('input[name="destination"]:checked')?.value||'new';
    const existingBook=dest==='existing'?$('#existing-book').value:null;
    if(dest==='existing'&&!validId(existingBook)){importStatus('请选择已有书籍',true);return;}
    if(dest==='new'&&!trim($('#book-name').value)){importStatus('请输入书名',true);return;}
    state.busy=true;$('#source-file').disabled=true;$('#start-import').disabled=true;
    $('#result-links').hidden=true;$('#import-log').textContent='';$('#import-log').hidden=false;
    let completed=0, skipped=0,metaWarnings=0,bookId=state.bookId;
    const importedMap=new Map();
    try{
      if(!bookId){
        if(dest==='new'){
          importStatus('正在创建书籍…');
          const r=await getJson('/api/admin/books',jsonBody({title:trim($('#book-name').value),author:trim($('#book-author').value),description:trim($('#book-desc').value)},'POST'));
          bookId=r.book?.id;
          if(!validId(bookId))throw Error('书籍已创建，但服务器未返回编号；请在后台查看，避免重复创建');
          log('已创建新书。');
        }else bookId=existingBook;
        state.bookId=bookId;
      }
      const baseInfo=await getJson('/api/books/'+bookId);
      const existingTitles=new Set((baseInfo.chapters||[]).map(c=>trim(c.title)));
      const oldStructure=await getJson('/api/archive-structure?bookId='+bookId+'&t='+Date.now()).then(r=>r.items||[]).catch(()=>[]);
      const lastSortOrder=Math.max(0,...(baseInfo.chapters||[]).map(c=>Number(c.sort_order)||0));
      let order=lastSortOrder;
      if($('#import-book-tags').checked && subjects().length){
        try{await syncBookTags(bookId);}catch(e){metaWarnings++;log('作品标签关联失败：'+e.message);}
      }
      if($('#save-book-cover').checked&&state.source.coverPath){
        try{await sendCover(state.source.zip,state.source.coverPath,'/api/admin/covers?book_id='+bookId);log('作品封面已保存。');}
        catch(e){metaWarnings++;log('作品封面导入失败，可稍后单独上传：'+e.message);}
      }
      for(let i=0;i<selected.length;i++){
        const c=selected[i];
        if(c.imported) {completed++;continue;}
        if(existingTitles.has(trim(c.title))){skipped++;log('跳过同名篇目：'+c.title);continue;}
        importStatus('正在导入第 '+(i+1)+' / '+selected.length+' 个篇目…');
        // Deliberately no blind retry on failed POST, to avoid duplicate chapters
        // when a network error happens after the server has already saved the text.
        order++;
        const response=await getJson('/api/admin/chapters',jsonBody({book_id:Number(bookId),title:trim(c.title),content:c.content,sort_order:order},'POST'));
        const chapterId=response.chapter?.id;
        if(!validId(chapterId))throw Error('章节已发布，但没有返回编号。请在后台检查，不要重复导入');
        importedMap.set(Number(chapterId),trim(c.title));c.imported=true;completed++;existingTitles.add(trim(c.title));
        log('已保存第 '+(i+1)+' 篇：'+c.title);
        if($('#save-chapter-summaries').checked && c.summary){
          try{await getJson('/api/admin/archive-chapter-meta?chapterId='+chapterId,jsonBody({summary:c.summary},'PUT'));}
          catch(e){metaWarnings++;log('篇目简介未保存：'+e.message);}
        }
        if($('#save-chapter-covers').checked&&c.coverPath){
          try{await sendCover(state.source.zip,c.coverPath,'/api/admin/archive-chapter-meta?chapterId='+chapterId);}
          catch(e){metaWarnings++;log('篇目封面未保存：'+e.message);}
        }
        $('#progress-bar').style.width=Math.round(((i+1)/selected.length)*100)+'%';
      }
      if($('#group-chapters').checked){
        try{await saveStructure(bookId,oldStructure,importedMap);log('章节目录已更新，保留了原有分组。');}
        catch(e){metaWarnings++;log('目录自动整理未完成，请在「章节目录管理」里检查：'+e.message);}
      }
      importStatus('导入完成！新增 '+completed+' 篇，跳过已有 '+skipped+' 篇。'+(metaWarnings?'有 '+metaWarnings+' 项封面、简介或目录提醒，详情见日志。':''));
      $('#result-book').href='/book.html?id='+bookId;$('#result-links').hidden=false;
      $('#progress-bar').style.width='100%';
      log('完成。建议打开作品目录逐章核对，并保留原 EPUB 作为备份。');
    }catch(e){
      importStatus('导入中断：'+e.message+'。已经成功保存的章节会保留，重新操作时同名章节会跳过。',true);
      log('中断原因：'+e.message);
      if(state.bookId){$('#result-book').href='/book.html?id='+state.bookId;$('#result-links').hidden=false;}
    }finally{state.busy=false;$('#source-file').disabled=false;update();}
  }
  async function repairTagsOnly(){
    if(state.busy || !state.source)return;
    const id=$('#existing-book').value;
    if($('input[name="destination"]:checked')?.value!=='existing'||!validId(id)){
      importStatus('请先选「导入到已有书籍」，并选择正确的作品',true);return;
    }
    if(!subjects().length){importStatus('没有要补录的 Tag',true);return;}
    state.busy=true;update();$('#import-log').textContent='';$('#import-log').hidden=false;
    try{importStatus('正在补录标签…');const added=await syncBookTags(id);importStatus('补录完成！已关联 '+subjects().length+' 个 EPUB 标签，其中 '+added+' 个为新增关联。章节正文完全未修改。');}
    catch(e){importStatus('补录失败：'+e.message,true);}
    finally{state.busy=false;update();}
  }
  function showCover(zip,path){
    const image=$('#cover-preview');image.hidden=true;
    if(!path||!zip.file(path))return;
    zip.file(path).async('blob').then(blob=>{
      const url=URL.createObjectURL(blob);image.src=url;image.hidden=false;
      image.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
    }).catch(()=>{});
  }
  async function onFileChange(event){
    const file=event.target.files?.[0];if(!file)return;
    state.items=[];state.source=null;state.bookId=null;
    $('#preview-step').hidden=true;$('#destination-step').hidden=true;$('#confirm-import').checked=false;$('#progress-bar').style.width='0%';$('#import-log').hidden=true;$('#result-links').hidden=true;
    status('正在本地读取 EPUB…');
    try{
      if(!file.name.toLowerCase().endsWith('.epub'))throw Error('请选择 EPUB 文件');
      const data=await loadEpub(file);
      state.source=data;state.items=data.items;
      $('#book-name').value=data.bookTitle.slice(0,200);
      $('#book-author').value=data.author.slice(0,100);
      $('#book-desc').value=data.description;
      showCover(data.zip,data.coverPath);
      status('识别成功：'+data.items.length+' 个 Pixiv 篇目，'+data.subjects.length+' 个作品 Tag。信息页、目录页和附注已跳过。');
      buildPreview();await refreshBooks();
    }catch(e){status('解析失败：'+e.message,true);}
  }
  $('#add-pixiv-tag').addEventListener('click',()=>{
    if(!state.source || state.source.subjects.length>=20)return;
    state.source.subjects.push('');renderSubjects();
    $('#pixiv-subject-list .pixiv-tag-row:last-child input')?.focus();
  });
  $('#repair-tags').addEventListener('click',()=>void repairTagsOnly());
  $('#existing-book').addEventListener('change',update);
  $('#source-file').addEventListener('change',onFileChange);
  $('#start-import').addEventListener('click',()=>void runImport());
  $('#confirm-import').addEventListener('change',update);
  $('#book-name').addEventListener('input',update);
  document.querySelectorAll('input[name="destination"]').forEach(input=>input.addEventListener('change',()=>{
    $('#existing-area').hidden=$('input[name="destination"]:checked')?.value!=='existing';update();
  }));
  window.addEventListener('beforeunload',e=>{if(state.busy){e.preventDefault();e.returnValue='';}});
  getJson('/api/me').catch(()=>{$('#auth-warning').hidden=false;$('#auth-warning').textContent='请先在作者后台登录，再返回本页面导入小说。';});
})();
