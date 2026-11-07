熊猫头文学档案馆 | Vditor 开源编辑器替换补丁

用途：用 Vditor 4.0.1 的成熟所见即所得 Markdown 编辑器，替换原有章节编辑页的手写输入框。

上传：解压后，把 chapter-editor.html、chapter-editor.js、chapter-editor.css、archive-markdown.js、archive.css 一起拖入 GitHub 仓库根目录的 Add file → Upload files。覆盖相同文件，不要删除其他文件。Cloudflare Pages 会自动部署。

保留：D1 正文存储、章节新建和修改、章节简介与封面、全书封面与简介、Tags、管理员登录、点赞和评论。

编辑体验：选中文字后点击 Vditor 的 B、Italic、标题、引用；所见即所得。正文仍保存 Markdown，因此现有 read.html 和 archive-markdown.js 可继续读取原有文档。

限制：目前读者页面只支持加粗、斜体、二三级标题和引用。Vditor 本身还提供其他格式，但本次刻意精简工具栏，避免出现保存后阅读页不支持的内容。写正文的图片插入目前没有开通，章节和书籍封面继续使用既有 D1 接口。

安全：此版本通过固定地址 https://cdn.jsdelivr.net/npm/vditor@4.0.1/ 加载 Vditor。Vditor 使用 MIT 许可，项目自有源码也应保留原 Novel Site 的 AGPL-3.0 要求。避免传输明文密码或将任何 ADMIN_PASSWORD、ARCHIVE_COMMENT_SECRET 放进代码仓库。第三方 CDN 不可用时编辑器会提示错误，不会删除 D1 中的原正文。

测试：适配原项目当前接口; 请上线后用测试章节测试编辑、加粗、标题、引用、保存刷新、手机布局。

源码与许可：https://github.com/Vanessa219/vditor
