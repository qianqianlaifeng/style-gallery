# 风格参考 · AI 视频灵感画廊

做 AI 视频没灵感时来逛的风格参考站：精选大量画风参考图 + 可直接复制的提示词，版式参考 zeezhi.pages.dev 的精致画廊风格（焦点大图 + 网格浏览 + 详情弹窗）。

## 打开方式
- **直接双击 `index.html`** 就能看（内置 36 张风格参考图，离线可用）。
- 或本地起服务预览：`python -m http.server 8000` → 打开 http://127.0.0.1:8000

## 已部署
- **GitHub Pages**：https://qianqianlaifeng.github.io/style-gallery/
  （GitHub Pages 只跑静态文件，`functions/` 不生效，所以线上走的是内置的 36 张离线图 + 全部交互。）

## 目录结构
```
style-gallery/
├── index.html              主页（焦点风格 + 网格画廊 + 详情弹窗）
├── css/style.css           样式
├── js/app.js               交互（搜索 / 焦点切换 / 详情 / 上下张 / 复制提示词）
├── sample.json             36 条风格数据（离线兜底）
├── sample-data.js          同一份数据的内嵌版，供双击 file:// 直接读取
├── functions/api/styles.js Cloudflare Pages Function：多接口实时聚合（可选）
└── assets/styles/          36 张风格参考图
```

## 交互
- 顶部「焦点风格」大图：**← →** 方向键 / **鼠标滚轮** / 图上左右按钮切换，点大图或按钮进详情。
- 下方「全部风格参考」网格：点任意卡片进详情，看完整提示词并可一键复制。
- 搜索框：按风格名 / 提示词 / 标签实时筛选。

## 可选：开通实时流（Cloudflare Pages）
GitHub Pages 是纯静态的，跑不了 `functions/`。若想让画廊自动拉最新作品（无需手动维护），把本项目另外部署到 **Cloudflare Pages**：
1. Cloudflare Pages → Create a project → 连接本 GitHub 仓库；
2. 构建设置：Build command 留空、Output directory 留空、Framework 选 `None`；
3. 部署后访问 `https://xxx.pages.dev`，`/api/styles` 会自动由 `functions/api/styles.js` 提供，前端检测到就会切到实时流。

`functions/api/styles.js` 目前已并行聚合 3 个公开接口（Civitai / Lexica / Reddit r/AIArt），任一失败不影响其他；实时源全部不可用时前端自动回退到内置 36 张图，不会白屏。

## 备注
- 风格图由 AI 生成，仅作风格参考占位。
