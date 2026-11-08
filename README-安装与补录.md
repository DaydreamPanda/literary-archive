# 熊猫头文学档案馆：封面缩略图 + EPUB Tag + 章节独立 Tag

## 安装

1. 解压 ZIP。
2. 使用 **DaydreamPanda** GitHub 账号打开仓库 `DaydreamPanda/literary-archive`，进入 `main` 分支。
3. **保留解压后的文件目录结构**，将 ZIP 中的 9 个网页/脚本/API 文件上传到仓库根目录，覆盖同名文件。注意 `functions/api/` 下的两个新文件需要位于对应文件夹，不能放在仓库根目录。
4. 提交更改。Cloudflare Pages 自动部署成功后，按 `⌘ + Shift + R` 强制刷新网站。
5. 不需要修改数据库，不需要开通 R2，也不需要再次上传小说正文。

## 这次修改了什么

- `book.html` + `archive-enhancements.js` + `functions/api/archive-book-extras.js`：章节目录缩略封面优先使用独立章节封面，找不到时回退至系列封面；同一回有多节时使用其中第一张存在的独立封面。
- `read.html` + `archive-enhancements.js`：章节阅读页显示从全书继承的 Tag，以及本章另外添加的 Tag。
- `chapter-editor.html` + `chapter-tags-editor.js` + `functions/api/archive-chapter-tags.js`：作者编辑器右侧新增「本节标签」，支持单独勾选、新建和保存 Tag。新增章节需先发布正文，然后保存独立 Tag。
- `pixiv-import.html` + `pixiv-import.js`：读取 EPUB 里的 `dc:subject` 标签，可以修改或移除，导入新书时自动关联；已有书支持只补录标签。
- 章节独立 Tag 以 JSON 数组保存在现有 D1 的 `site_settings`，不增加新表，最大每章 20 个，继承全书 Tag 后在阅读页去重显示。

## 已经导入《洪清秘史》，怎样补上 Tag

1. 部署新版后，打开 https://literary-archive.pages.dev/pixiv-import.html。
2. 再选择之前下载的《洪清秘史》 EPUB 文件。
3. 在预览页查看/调整「EPUB 作品标签」。本次样本 EPUB 的 `dc:subject` 一共有 **10 项**。
4. 在第三步的「导入位置」选择 **导入到已有书籍**，选择《洪清秘史》。
5. 点击 **只补录 EPUB Tag 到这本书**，不要点击「开始导入这本书」。
6. 成功后刷新系列页，书名下面会显示已关联的作品标签。已有正文、章节封面、评论不会改变。

## 给某个章节单独增加 Tag

1. 作者后台 → 章节管理 → 编辑目标章节。
2. 在独立写作页面右侧找到「本节标签」，勾选额外标签或创建新标签。
3. 点击 **保存章节 Tag**；该操作与「保存正文」是两项独立操作。
4. 刷新章节阅读页，可以看到继承的作品 Tag 和额外的本节 Tag。

## 注意

- 标签仅从 EPUB 元数据读取，**不会猜测**作品或章节应有哪些标签。
- 这是叠加补丁，不改已有 `archive.js` 及 D1 正文存储；无需重新导入已发布小说。
- 目前只完成了本地浏览器模拟测试。正式 Cloudflare 环境请先用《洪清秘史》补录 Tag 并刷新确认。
- 当前 GitHub 插件对 DaydreamPanda 只有读取权限，安装须由你通过 DaydreamPanda 账号提交。
