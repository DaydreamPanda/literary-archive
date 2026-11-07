# 白日做梦熊猫头 · 文学档案馆 D1 存储修复补丁

## 这次为什么要上传这些文件

当前网站已经上线、能用 `admin` 登录，作者资料也已保存在 D1。
当前数据库 `novel-db` 已创建 `chapters.content`、`archive_comments.content`、`archive_likes` 等列/表。

这份补丁直接使用**你目前已经建好的表**。不会修改数据库中现有的账户、小说或作者资料；也不会改变已完成的 `wrangler.toml` 配置。

## 上传步骤

1. GitHub 仓库 `DaydreamPanda/literary-archive` → **Add file → Upload files**。
2. 将解压文件夹内的 **functions 整个文件夹**拖入上传区，保持目录结构。
3. **不要**删除原项目的其他文件，上传后检查路径，然后点击 **Commit changes**，直接提交到 `main`。
4. Cloudflare Pages 将自动重新部署。
5. 新版本上线后，先在后台创建一本**测试书**，再添加一小段**测试章节**，打开阅读页，核对正文，尝试修改，再测试删除。

当前已有的 D1 数据库 ID 和 Cloudflare 密钥不需要重填。

## 对现有功能的修改

* 小说正文直接写入已有的 `chapters.content` TEXT 列；包括新建、修改、删除、阅读、TXT/EPUB 导入和后台导出。
* 小说封面和自定义字体写入新的 D1 `archive_assets` 表，第一次使用时自动建表。最大 **1 MB / 文件**；封面支持 JPEG、PNG、WebP；字体支持 WOFF2。
* 匿名评论 API 适配你已经创建的 `archive_comments.content` 字段，前端仍然拿到 `body` 字段，便于不改页面。
* 匿名点赞 API 使用你已经创建的 `archive_likes` 表，各章节独立计数，浏览器能够取消点赞。
* 删除章节和书籍时清理相关的评论、点赞和封面，不再调用 R2。
* 保留原有管理员登录、作者资料、章节分组、前端样式和 AGPL-3.0 许可证。

## 还需要一个 Secret

为匿名评论和点赞服务，在 Cloudflare Pages → `literary-archive` → Settings → Variables and Secrets → Production 设置一个 **Secret**：

`ARCHIVE_COMMENT_SECRET`：随机构造的至少 24 字符长字符串，**必须与 ADMIN_PASSWORD 不同**，不必发给任何人，也绝不要提交到 GitHub。设置后需让 Pages 产生一次新部署。

后台登录使用的 `ADMIN_PASSWORD` 保持不变。

## 限制与风险

- D1 当前单行/单值约 2 MB，本补丁将单章限制为 1.5 MB UTF-8 文本，最长 50 万字符。封面/字体限制为 1 MB。大文件请压缩或拆分。
- 这些文件基于原项目公开源码和你提供的数据库结构制作；已做 JavaScript 语法/模拟数据库测试，但**尚未在你的 Cloudflare 生产环境进行端到端验证**。正式作品发布前，务必先测试。
- 本补丁默认你的 `chapters.content` 列、`archive_comments.content` 列和 `archive_likes` 表已经按照此前步骤创建。
- 现有前端 `admin.html` 的章节编辑没有提交 `version`，后端在该情况下允许保存；若新客户端提供 `version`，仍会校验并发版本。
- `admin.html` 原有的「自定义字体最大 10 MB」提示仍沿用旧 UI，D1 模式下实际限制 1 MB，超出时接口会告知。
- 使用 GitHub Fork 的仓库需保留原项目的 AGPL-3.0 许可证和原作者版权信息。
- 重要的原稿请在本地保留副本，并定期通过后台导出备份。Cloudflare 免费计划存在使用量上限。
