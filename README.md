# 风格参考 · 实时 AI 灵感画廊

一个**实时** AI 视频风格参考站：画廊内容由公开 AI 接口（Civitai）**实时拉取**，打开/刷新就有新图，不用手动维护。版式复刻 zeezhi.pages.dev 的精致画廊风格，点开作品看大图 + 可直接复制的提示词。

## 它怎么做到"实时、不用你自己新增"
- 前端 `js/app.js` 打开时请求 `/api/styles`；
- `functions/api/styles.js` 是 Cloudflare Pages Function（路由即 `/api/styles`），**每次请求都服务端实时去拉 Civitai 最新作品**并规范化为统一格式返回，顺带解决浏览器跨域；
- 所以你什么都不用做，画廊会自动随源站更新。若实时源临时不可用，前端会**自动回退**到本地 `sample.json`，不会开天窗。

## 目录结构
```
style-gallery/
├── index.html              主页（zeezhi 风格画廊）
├── css/style.css           样式
├── js/app.js              交互（实时拉取 + 离线兜底 + 详情/上下张/复制）
├── functions/api/styles.js Cloudflare Pages Function：实时接口（代理 Civitai）
├── sample.json            离线兜底数据（本地 12 张示例图，双击也能看）
└── assets/styles/         示例图
```

## 本地预览（无需部署）
```
cd style-gallery
python -m http.server 8000
```
浏览器打开 http://127.0.0.1:8000 —— 此时没有 `/api/styles`，会自动走 `sample.json` 演示模式。

## 部署到 Cloudflare Pages（变成 xxx.pages.dev）
**方式 A：连 Git 仓库（最省事）**
1. 把本文件夹推到 GitHub 仓库（可直接用仓库里的 `deploy.bat`，先改里面的 `REPO_URL`）。
2. 打开 Cloudflare Pages → Create a project → 连接该 GitHub 仓库。
3. 构建设置：**Build command 留空**，**Output directory 留空**（或填 `/`），Framework 选 `None`。
4. 部署完成后访问 `https://你的项目.pages.dev`，`/api/styles` 会自动由 `functions/` 提供 → 画廊变实时流。

**方式 B：命令行（wrangler）**
```
npx wrangler pages deploy .
```

## 想换成你自己的接口 / 数据源
只改 `functions/api/styles.js` 里的 `CIVITAI` 常量（换成任意返回图片列表的接口地址），并让函数返回 `{ id, image, title, prompt, tags, author, source }` 这几个字段即可。前端不强依赖 Civitai。

## 备注
- Civitai 若在你的网络被墙/限流，画廊会自动回退到本地 `sample.json`；换源见上。
- 示例图由 AI 生成仅作占位演示；实时模式下展示的是 Civitai 实时作品与提示词。
