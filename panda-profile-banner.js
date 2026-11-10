/* Profile banner for the homepage and the existing author-profile editor. */
(() => {
  'use strict';
  const PUBLIC = '/api/archive-banner';
  const ADMIN = '/api/admin/archive-banner';
  const $ = selector => document.querySelector(selector);
  const safeY = value => Number.isFinite(Number(value)) ? Math.max(0,Math.min(100,Math.round(Number(value)))) : 50;

  async function info() {
    const response = await fetch(PUBLIC+'?meta=1',{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error('横幅信息读取失败：'+response.status);
    return response.json();
  }
  function homepage() {
    const hero=$('.hero-grid');
    if(!hero)return;
    info().then(data=>{
      if(!data.exists)return;
      const section=document.createElement('section');section.className='panda-profile-banner';
      section.setAttribute('aria-label','作者主页横幅');section.hidden=true;
      const img=document.createElement('img');img.alt='作者主页背景横幅';
      img.style.objectPosition='center '+safeY(data.position)+'%';
      img.onload=()=>{section.hidden=false;document.body.classList.add('has-panda-profile-banner');};
      img.onerror=()=>{section.remove();};
      section.append(img);hero.before(section);
      img.src=PUBLIC+'?v='+encodeURIComponent(data.version||'1');
    }).catch(e=>console.warn('Banner is unavailable:',e.message));
  }
  function editor() {
    const form=$('#profile-form');if(!form)return;
    const panel=document.createElement('section');panel.className='panda-banner-tools';
    panel.innerHTML=`
      <h2>主页横幅 / PROFILE BANNER</h2>
      <p class="panda-banner-help">像 Pixiv 个人主页一样，在网站首页顶部展示一张横向背景图片。建议图片比例约 2.8:1，例如 1680 × 600 像素。图片会自动压缩至 1 MB 以内，手机上会适当裁剪。</p>
      <div class="panda-banner-preview" id="panda-banner-preview"><span id="panda-banner-empty">还没有设置主页横幅</span><img id="panda-banner-img" alt="横幅预览" hidden></div>
      <label class="field-label" for="panda-banner-file">从电脑选择图片（JPG、PNG、WebP）</label>
      <input id="panda-banner-file" type="file" accept="image/jpeg,image/png,image/webp">
      <label class="field-label" for="panda-banner-y">调整图片上下位置：<output id="panda-banner-y-label">50%</output></label>
      <input id="panda-banner-y" type="range" min="0" max="100" step="1" value="50" aria-label="横幅图片垂直位置">
      <div class="panda-banner-actions">
        <button class="primary" type="button" id="panda-banner-upload">上传并启用横幅</button>
        <button type="button" id="panda-banner-save-position">仅保存图片位置</button>
        <button type="button" id="panda-banner-remove">移除横幅</button>
      </div>
      <div class="panda-banner-status" id="panda-banner-status" aria-live="polite"></div>`;
    const saveProfile = $('#save-profile');
    if(saveProfile?.parentElement)form.insertBefore(panel,saveProfile.parentElement);
    else form.append(panel);

    const file=$('#panda-banner-file'),preview=$('#panda-banner-img'),empty=$('#panda-banner-empty');
    const slider=$('#panda-banner-y'),positionLabel=$('#panda-banner-y-label');
    const upload=$('#panda-banner-upload'),savePosition=$('#panda-banner-save-position'),remove=$('#panda-banner-remove');
    const status=$('#panda-banner-status');
    let exists=false, busy=false, localPreview=null;
    const say=(text,isError=false)=>{status.textContent=text;status.style.color=isError?'#b85a50':'';};
    function buttons(){upload.disabled=busy||!file.files?.length;savePosition.disabled=busy||!exists;remove.disabled=busy||!exists;}
    function show(url){
      if(!url){preview.hidden=true;empty.hidden=false;return;}
      preview.hidden=false;empty.hidden=true;preview.src=url;
      preview.style.objectPosition='center '+slider.value+'%';
    }
    function clearLocal(){if(localPreview){URL.revokeObjectURL(localPreview);localPreview=null;}}
    async function load(){
      try{
        const data=await info();exists=!!data.exists;
        slider.value=String(safeY(data.position));positionLabel.value=slider.value+'%';
        if(exists){
          const url=PUBLIC+'?v='+encodeURIComponent(data.version||Date.now());
          preview.onerror=()=>{show('');say('横幅图片读取失败，请重新上传。',true);};
          show(url);
        } else show('');
        buttons();
      }catch(e){say(e.message,true);buttons();}
    }
    function lock(value){busy=value;buttons();}
    file.addEventListener('change',()=>{
      clearLocal();
      const item=file.files?.[0];
      if(item){localPreview=URL.createObjectURL(item);preview.onerror=null;show(localPreview);}
      else void load();
      buttons();
    });
    slider.addEventListener('input',()=>{
      preview.style.objectPosition='center '+slider.value+'%';
      positionLabel.value=slider.value+'%';
    });

    async function compress(file){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('图片格式只支持 JPG、PNG、WebP');
      // Keep original bytes when already under the safe D1 limit.
      if(file.size<=950000)return file;
      const objectUrl=URL.createObjectURL(file);
      let img;
      try {
        img=await new Promise((resolve,reject)=>{
          const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(Error('无法读取所选图片'));el.src=objectUrl;
        });
      }finally{URL.revokeObjectURL(objectUrl);}
      const ratio=Math.min(1,2000/img.naturalWidth,900/img.naturalHeight);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器无法压缩图片');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      for(const quality of [0.86,0.72,0.58,0.44,0.30]){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(blob && blob.size<950000)return new File([blob],'panda-banner.jpg',{type:'image/jpeg'});
      }
      throw Error('图片太大，压缩后仍超过1 MB，请先缩小尺寸');
    }
    async function adminReq(options){
      const res=await fetch(ADMIN,{credentials:'same-origin',cache:'no-store',...options});
      const result=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(result.error||('请求失败：'+res.status));
      return result;
    }
    upload.addEventListener('click',async()=>{
      const item=file.files?.[0];if(!item||busy)return;
      lock(true);say('正在处理和上传图片…');
      try{
        const smaller=await compress(item);
        const data=new FormData();data.set('file',smaller,smaller.name);data.set('position',slider.value);
        await adminReq({method:'POST',body:data});
        exists=true;file.value='';clearLocal();say('横幅已更新！刷新首页查看效果。');await load();
      }catch(e){say('上传失败：'+e.message,true);}finally{lock(false);}
    });
    savePosition.addEventListener('click',async()=>{
      if(!exists||busy)return;lock(true);
      try{
        await adminReq({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({position:Number(slider.value)})});
        say('显示位置已保存！刷新首页查看。');
      }catch(e){say('保存失败：'+e.message,true);}finally{lock(false);}
    });
    remove.addEventListener('click',async()=>{
      if(!exists||busy||!confirm('确定移除首页横幅图片吗？作者资料和小说不会受到影响。'))return;
      lock(true);
      try{
        await adminReq({method:'DELETE',headers:{'Content-Type':'application/json'}});
        exists=false;file.value='';clearLocal();show('');say('横幅已移除，首页会恢复原布局。');
      }catch(e){say('移除失败：'+e.message,true);}finally{lock(false);}
    });
    buttons();void load();
    window.addEventListener('beforeunload',clearLocal);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(document.body.dataset.page==='home')homepage();
    else if($('#profile-form'))editor();
  });
})();
