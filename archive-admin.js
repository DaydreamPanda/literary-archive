(() => {
  'use strict';
  const $ = x => document.querySelector(x);
  const status = $('#admin-status');
  const form = $('#profile-form');
  function message(s,err=false){status.textContent=s;status.style.color=err?'#ad5247':'';}
  async function json(path,options){const r=await fetch(path,{credentials:'same-origin',...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;}
  async function load(){
    if(location.protocol==='file:'){message('本地文件预览无法连接管理员身份。部署到 Cloudflare 并登录 /admin.html 后即可使用。');return;}
    try{
      const me=await json('/api/me');
      if(me.role!=='super_admin'){message('需要超级管理员账号。请先从 /admin.html 登录。',true);return;}
      const remote=await json('/api/archive-profile');const p={...(window.ARCHIVE_CONFIG||{}),...(remote.profile||{})};
      $('#field-name').value=p.authorName||'';$('#field-bio').value=p.biography||'';$('#field-announcement').value=p.announcement||'';$('#field-avatar').value=p.avatarUrl||'';
      $('#field-links').value=(p.links||[]).map(x=>x.label+' | '+x.url).join('\n');
      form.classList.remove('hidden');message('已登录，可以编辑作者资料。');
    }catch(e){message('读取资料失败：'+e.message+'。可先打开 /admin.html 登录。',true);}
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const links=[];
    for(const line of $('#field-links').value.split('\n')){
      if(!line.trim())continue;const pos=line.indexOf('|');if(pos<1){message('外部链接格式：名称 | https://网址',true);return;}
      const item={label:line.slice(0,pos).trim(),url:line.slice(pos+1).trim()};
      if(!item.label||!/^https:\/\/[^\s]+$/i.test(item.url)){message('外部链接必须使用 HTTPS 地址',true);return;}links.push(item);
    }
    const profile={authorName:$('#field-name').value,biography:$('#field-bio').value,announcement:$('#field-announcement').value,avatarUrl:$('#field-avatar').value,links};
    const btn=$('#save-profile');btn.disabled=true;message('正在保存…');
    try{await json('/api/admin/archive-profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile})});message('保存成功！刷新首页即可看到新资料。');}
    catch(e){message('保存失败：'+e.message,true);}
    finally{btn.disabled=false;}
  });
  load();
})();
