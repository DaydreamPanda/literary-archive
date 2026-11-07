熊猫头 Vditor 加载修复补丁（2026-11）

原因：上一版从 jsDelivr npm 的 v4.0.1 地址加载 Vditor，可能找不到该资源或被网络拦截。
修复：主脚本和样式改为 Cloudflare cdnjs v4.0.1；Vditor 的按需加载组件使用 unpkg v4.0.1 的 /dist 路径。主脚本加载失败时也会尝试 unpkg v4.0.1。
双 CDN 均不可用时，自动显示内置 Markdown 备用编辑区，可继续编辑并保存。

安装方法：
1. 解压 ZIP。
2. GitHub 仓库 main 分支 → Add file → Upload files。
3. 上传文件（chapter-editor.html / chapter-editor.js / chapter-editor.css），覆盖同名文件，提交。
4. Cloudflare 自动部署成功后，强制刷新 https://literary-archive.pages.dev/chapter-editor.html?id=你的章节ID
5. 编辑并保存测试正文，检查阅读页是否更新。

无需 SQL、R2 或密码变更，不触碰已有 D1 数据。
如果页面进入备用编辑模式，文字可直接输入，格式栏会插入 Markdown 标记；后台仍可保存。
