# 熊猫头文学档案馆 · 统一章节工作台

适配仓库：DaydreamPanda/literary-archive（Cloudflare Pages + D1）

## 为什么制作这版

此前「节标题」只保存到 `archive_structure_<bookId>`，而公开阅读页仍使用 `chapters.title`，所以改完小节名后正文页仍显示旧名字。此前的章节管理和排序页面也分离，且排序表单拥挤。

## 安装

1. 导出一次全站 JSON 备份，保留旧文件的 GitHub 提交历史。
2. 将本压缩包的 **6 个网站文件** 按原路径上传到仓库 `main`，覆盖同名文件：
   - `archive-structure.html`（新的统一工作台页面）
   - `archive-structure-admin.js`（手动树形目录与管理功能）
   - `archive-structure-studio.css`（新页面样式）
   - `admin-editor-link.js`（后台入口指向统一工作台，隐藏旧章节列表）
   - `pixiv-import.html`（关闭 Pixiv 上中下自动合并，保留兼容的隐藏复选框）
   - `functions/api/admin/archive-structure.js`（保存目录时真正更新章节标题及排序）
3. 等 Cloudflare Pages 最新部署变绿。
4. 打开 `https://literary-archive.pages.dev/archive-structure.html` 并登录管理员。
5. 挑选一部测试书，在右侧改节标题并保存，刷新正文阅读页验证。

注意：GitHub 网页如果把 `functions/api/admin/archive-structure.js` 扔到了仓库根目录，请进入 GitHub 上对应的 `functions/api/admin/` 文件夹，**只替换这个路径里的文件**。根目录不能放同名 API 文件。

## 使用方式

- 左侧是目录树，右侧是所选章/节的详情。点击小节，改「节标题」，顶端保存后，目录、阅读页正文标题、旧后台及上下章导航都显示新名称。
- 拖动小节手柄可排序。同一大章内调整位置，或拖到另一大章。两个独立章互拖只调整顺序，不会擅自合并。
- 点击「多选整理」，勾选两个或多个章节，填写大章名称并点「合并所选」。分组也可以随时拆分；删除放在详情区或多选整理区，必须确认。
- 改动在「保存目录与标题」前都只存在于当前页面。删除章节是立即执行的破坏性操作，需先保存修改。
- 「导出 TXT」在右侧所选小节详情中；「导出全书 TXT」在顶部。
- Pixiv EPUB 导入不再自动识别「上、中、下」并合并；导入后用本页面手动整理。

## 数据与安全

- 直接更新已有 D1 `chapters.title`, `chapters.sort_order` 和 `site_settings` 的目录配置，不需要新建表。
- 标题变化同步增加章节 `version`，避免其他打开的编辑器悄悄覆盖新标题。
- 在 D1 事务式 batch 中保存新目录、标题和顺序。正文、封面、评论、Tag 和点赞数据不在这次正常保存范围内。
- 本功能限定已登录的超级管理员。删除功能沿用原项目的已有受保护 API，执行时会提醒可能删除相关评论等数据。

## 验证

- JavaScript `node --check` 通过。
- Playwright 模拟数据通过：读取章节、编辑标题、保存、手动合并、移动到其他组、再次保存、移动端无横向溢出。
- SQLite 本地模拟通过：章节顺序更新、标题更新和版本递增。
- 尚未使用真实 Cloudflare D1 做线上写入测试。请先使用测试书，并保留备份。

本升级没有添加新的第三方依赖。章节树结构和交互参考了成熟的菜单/目录编辑模式，沿用网站原有视觉设计。继续遵守仓库原有的许可证及署名要求。
