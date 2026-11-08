熊猫头文学档案馆：多节章节快捷跳转

功能：只对手动章节管理中包含 2 个及以上小节的大章显示导航。
显示「大章标题 2/4节」和一排可点击的长条。
当前节使用深色，鼠标悬停会轻微放大，点击任何长条立即跳到对应小节。
单节章节不显示。没有上一节/下一节按钮。

安装：
1. 打开 GitHub 仓库 DaydreamPanda/literary-archive。
2. 把 panda-section-nav.js 和 read.html 上传到仓库根目录（read.html 需要覆盖同名文件）。
3. Commit changes。Cloudflare 绿了后打开多节章节的阅读页测试。

这两个文件不会修改 D1 数据、正文、封面、评论或标签。
如果你已经自己改过 read.html，请不要直接覆盖自己的定制：
只需在 </head> 之前增加：
<script src="./panda-section-nav.js" defer></script>
就可以保留你自己 read.html 的其他改动。
