/* ============================================================
 * 风格参考 · AI 视频风格参考库 - 前端逻辑（原生 JS，无依赖）
 *
 * 数据：styles-data.js 内嵌的 __STYLES__（视频成片风格词典，每条带
 *      详细可直接复制到可灵/即梦/海螺的成片风格提示词 + Civitai 搜索词 q）。
 * 交互：画廊网格 / 焦点大图 / 分类筛选 / 搜索 / 详情弹窗（复制提示词）。
 *
 * 图片策略：先用本地参考图秒开、不白屏；随后后台按每个风格的 q 去 Civitai
 * 拉真实风格参考图，按图就地替换（保留手写视频提示词）。某风格拉取被限流时，
 * 自动回退到同大类已拉到的真实图；再不行才留本地参考图。永不破图。
 * ============================================================ */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // 视频风格大类展示顺序
  const CAT_ORDER = ["国漫国风", "日系动画", "美式西式", "写实电影感", "赛博科幻",
    "萌系可爱", "像素复古", "广告产品", "MV音乐", "抽象艺术"];

  const state = { all: [], filtered: [], current: -1, focus: 0, cat: "", shown: 0, off: 0 };
  let byId = {};                 // id -> style 对象（与 state.all/filtered 同一引用）
  const catPool = {};            // cat -> 该大类已拉到的真实图 URL 池（兜底用）
  let liveRunning = false;

  const CIVITAI_API = "https://civitai.com/api/v1/models";
  const FETCH_TIMEOUT = 8000;

  function setStatus(t) { const el = $("#status"); if (!el) return; el.textContent = t || ""; el.hidden = !t; }
  function setLive(t, ok) {
    const el = $("#liveStatus"); if (!el) return;
    el.textContent = t; el.hidden = !t;
    el.classList.toggle("ok", !!ok); el.classList.toggle("busy", !ok && !!t);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function isCivitai(u) { return typeof u === "string" && u.indexOf("civitai.com") >= 0; }
  function thumbUrl(u) { return u ? u.replace("original=true", "width=420") : ""; }

  // ============ 图片加速：本地静态图走 jsDelivr CDN（国内快） ============
  // 相对路径(assets/...) -> jsDelivr；失败时 onImgError 自动回退 github.io 原站
  const CDN = "https://cdn.jsdelivr.net/gh/qianqianlaifeng/style-gallery@main/";
  function cdnUrl(u) {
    return (typeof u === "string" && u && u.indexOf("http") !== 0 && u.indexOf("data:") !== 0) ? CDN + u : u;
  }

  // ============ 数据加载 ============
  function getStyles() {
    return (window.__STYLES__ && Array.isArray(window.__STYLES__)) ? window.__STYLES__ : [];
  }

  function loadStyles() {
    const lib = getStyles();
    if (!lib.length) { setStatus("加载失败：请刷新页面重试。"); return; }
    // 复制出可写对象：fallback=本地参考图，_imgs=真实图池，image=当前显示
    state.all = lib.map(s => ({ ...s, fallback: s.image || "", _imgs: [], image: s.image || "" }));
    state.off = 0;
    byId = {};
    state.all.forEach(s => { byId[s.id] = s; });
    applyFilter();
    backgroundLive();   // 后台拉真实图，不阻塞首屏
  }

  // ============ 图片容错 ============
  function onImgError(e) {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || !img.src) return;
    if (!(img.closest(".card-img") || img.closest(".spotlight-img") || img.closest(".modal-img"))) return;
    const step = parseInt(img.dataset.retry || "0", 10);
    const rel = (img.dataset.fallback || "");
    const hasRel = rel && rel.indexOf("http") !== 0; // 本地参考图的相对路径兜底

    if (step === 0) {
      img.dataset.retry = "1";
      if (img.src.indexOf(CDN) === 0) { img.src = img.src.slice(CDN.length); return; } // CDN -> 原站
      if (isCivitai(img.src)) { img.src = img.src.replace("width=420", "width=256").replace("width=512", "width=256"); return; }
      if (hasRel) { img.src = cdnUrl(rel); return; }                                   // 原站 -> CDN
    } else if (step === 1) {
      img.dataset.retry = "2";
      if (img.dataset.civitai === "1" && hasRel) { img.dataset.civitai = "0"; img.src = cdnUrl(rel); return; } // 真实图 -> 本地图
      if (hasRel && img.src !== cdnUrl(rel)) { img.src = cdnUrl(rel); return; }        // 原站 -> CDN
      if (hasRel && img.src !== rel) { img.src = rel; return; }                        // CDN -> 原站
    }
    // 重试链用尽：画廊卡片换占位色块（焦点/弹窗大图保留原位，避免破坏元素引用）
    const box = img.closest(".card-img");
    if (box && !box.querySelector(".img-ph")) {
      const ph = document.createElement("div");
      ph.className = "img-ph";
      ph.textContent = img.alt || "风格参考";
      img.replaceWith(ph);
    }
  }
  document.addEventListener("load", (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG" && t.closest && t.closest(".card-img")) t.classList.add("loaded");
  }, true);
  document.addEventListener("error", onImgError, true);

  // ============ 真实图：按 q 后台拉取 + 就地替换 ============
  async function fetchCivitai(q, n) {
    const url = CIVITAI_API + "?limit=" + n + "&query=" + encodeURIComponent(q) +
      "&types=Checkpoint&types=LORA&sort=Highest+Rated&nsfw=false";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return [];
      const data = await res.json();
      const out = [];
      for (const m of (data.items || [])) {
        for (const v of (m.modelVersions || [])) {
          for (const im of (v.images || [])) {
            if (im && im.url) { const tu = thumbUrl(im.url); if (tu) out.push(tu); }
          }
        }
      }
      return out;
    } catch (e) { return []; }
    finally { clearTimeout(t); }
  }

  // 第二图源：Wikimedia Commons（keyless、CORS 开放 origin=*）。返回 420 宽缩略图。
  const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
  async function fetchCommons(qw, n) {
    const url = COMMONS_API + "?action=query&generator=search&gsrsearch=" +
      encodeURIComponent(qw + " art") + "&gsrnamespace=6&gsrlimit=" + n +
      "&prop=imageinfo&iiprop=url%7Cmime&iiurlwidth=420&format=json&origin=*";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return [];
      const data = await res.json();
      const pages = (data.query && data.query.pages) || {};
      const out = [];
      for (const pid in pages) {
        const ii = (pages[pid].imageinfo || [])[0];
        if (!ii) continue;
        const mime = ii.mime || "";
        if (mime.indexOf("image/") !== 0) continue;       // 只要图片，过滤 PDF/Office
        const u = ii.thumburl || ii.url;
        if (u) out.push(u);
      }
      return out;
    } catch (e) { return []; }
    finally { clearTimeout(t); }
  }

  // 选出某风格当前应显示的图（real 优先，按 off 轮换；否则本地兜底）
  function pickImage(s) {
    if (s._imgs && s._imgs.length) return s._imgs[state.off % s._imgs.length];
    return s.fallback || "";
  }
  function reassignImages() {
    state.all.forEach(s => { s.image = pickImage(s); });
    refreshImagesInDom();
  }
  // 把 state 里最新的 image 同步到已在 DOM 中的 img（按 data-key 定位）
  function refreshImagesInDom() {
    $$("img[data-key]").forEach(im => {
      const s = byId[im.dataset.key];
      if (!s || !s.image) return;
      if (im.dataset.cur === s.image) return;
      im.dataset.cur = s.image;
      im.dataset.civitai = isCivitai(s.image) ? "1" : "0";
      im.dataset.retry = "0";
      im.classList.remove("loaded");
      im.src = cdnUrl(s.image);
    });
    $$("[data-src]").forEach(tag => {
      const s = byId[tag.dataset.src];
      if (!s) return;
      const live = !!(s._imgs && s._imgs.length);
      tag.textContent = live ? "实时参考图" : "参考图";
      tag.classList.toggle("live", live);
    });
  }

  // 并发拉取一组（按查询去重）并将结果写入 style._key
  async function runGroups(entries, fetcher, key, n) {
    const CONC = 4;
    async function worker() {
      while (entries.length) {
        const [q, styles] = entries.shift();
        const imgs = await fetcher(q, n);
        styles.forEach(s => { s["_" + key] = imgs; });
        reassignImages();
      }
    }
    const ws = [];
    for (let i = 0; i < Math.min(CONC, entries.length); i++) ws.push(worker());
    await Promise.all(ws);
  }

  async function backgroundLive() {
    if (liveRunning) return;
    liveRunning = true;
    setLive("正在从 Civitai + Wikimedia 拉取真实风格图…", false);

    // 按查询去重分组（两个图源分别分组）
    const cGroups = {}, wGroups = {};
    state.all.forEach(s => {
      if (s.q) (cGroups[s.q] = cGroups[s.q] || []).push(s);
      if (s.qw) (wGroups[s.qw] = wGroups[s.qw] || []).push(s);
    });

    // 图源1：Civitai（动漫/插画/3D 强）
    await runGroups(Object.entries(cGroups).map(e => [e[0], e[1]]), fetchCivitai, "civ", 16);
    // 图源2：Wikimedia Commons（摄影/电影/实拍强）
    await runGroups(Object.entries(wGroups).map(e => [e[0], e[1]]), fetchCommons, "cm", 12);

    // 合并两源 -> _imgs，并汇入同大类兜底池
    state.all.forEach(s => {
      const merged = [];
      if (s._civ) merged.push(...s._civ);
      if (s._cm) merged.push(...s._cm);
      s._imgs = merged;
      if (merged.length) (catPool[s.cat] = catPool[s.cat] || []).push(...merged);
    });
    reassignImages();

    // 两源都失败的风格，用同大类已拉到的真实图兜底
    state.all.forEach(s => {
      if (!s._imgs.length && catPool[s.cat] && catPool[s.cat].length) s._imgs = catPool[s.cat];
    });
    reassignImages();

    const ok = state.all.filter(s => s._imgs && s._imgs.length).length;
    setLive("已加载真实风格图 · " + ok + "/" + state.all.length + " 种（Civitai + Wikimedia）", true);
    liveRunning = false;
  }

  // ============ 筛选 / 分类 / 分页 ============
  function applyFilter() {
    const kw = ($("#search").value || "").trim().toLowerCase();
    const cat = state.cat || "";
    state.filtered = state.all.filter(s => {
      if (cat && s.cat !== cat) return false;
      if (!kw) return true;
      const hay = [s.name, s.desc, s.prompt, s.cat].join(" ").toLowerCase();
      return hay.includes(kw);
    });
    state.focus = 0;
    state.shown = 0;
    renderCategories();
    renderSpotlight();
    renderGallery();
  }

  function renderCategories() {
    const bar = $("#cats");
    if (!bar) return;
    const counts = new Map();
    state.all.forEach(s => { if (s.cat) counts.set(s.cat, (counts.get(s.cat) || 0) + 1); });
    const cats = CAT_ORDER.filter(c => counts.has(c)).concat([...counts.keys()].filter(c => !CAT_ORDER.includes(c)));
    bar.innerHTML = `<button class="cat-chip${!state.cat ? " active" : ""}" data-cat="">全部 (${state.all.length})</button>` +
      cats.map(c => `<button class="cat-chip${state.cat === c ? " active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)} (${counts.get(c)})</button>`).join("");
  }

  const PAGE = 36;
  function renderGallery(append) {
    const g = $("#gallery");
    $("#empty").hidden = state.filtered.length > 0;
    const start = append ? state.shown : 0;
    const slice = state.filtered.slice(start, start + PAGE);
    const html = slice.map((s, k) => {
      const i = start + k;
      return `
      <article class="card" data-index="${i}">
        <div class="card-img">
          <img src="${cdnUrl(s.image)}" alt="${escapeHtml(s.name)}" data-key="${escapeHtml(s.id)}" data-fallback="${escapeHtml(s.fallback)}" loading="lazy" decoding="async" />
          <span class="card-src" data-src="${escapeHtml(s.id)}"></span>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(s.name)}</div>
          <div class="card-desc">${escapeHtml(s.desc)}</div>
          <div class="card-tags"><span class="tag">${escapeHtml(s.cat)}</span></div>
        </div>
      </article>`;
    }).join("");
    if (append) g.insertAdjacentHTML("beforeend", html); else g.innerHTML = html;
    state.shown = Math.min(state.filtered.length, start + slice.length);

    $$(".card-img img", g).forEach(im => { if (im.complete && im.naturalWidth) im.classList.add("loaded"); });
    refreshImagesInDom();
    $$(".card", g).forEach(c => {
      if (c.dataset.bound) return;
      c.dataset.bound = "1";
      c.addEventListener("click", () => {
        const i = parseInt(c.dataset.index, 10);
        state.focus = i; renderSpotlight(); openModal(i);
      });
    });
    $("#loadmore").hidden = state.shown >= state.filtered.length;
    $("#count").textContent = state.filtered.length ? `共 ${state.filtered.length} 种风格 · ${state.cat || "全部"}` : "";
  }

  function renderSpotlight() {
    const s = state.filtered[state.focus];
    const sec = $("#spotlight");
    if (!s) { sec.hidden = true; return; }
    sec.hidden = false;
    const img = $("#spotImg");
    img.src = cdnUrl(s.image); img.alt = s.name;
    img.dataset.key = s.id; img.dataset.fallback = s.fallback; img.dataset.cur = s.image;
    img.dataset.civitai = isCivitai(s.image) ? "1" : "0"; img.dataset.retry = "0";
    $("#spotTitle").textContent = s.name;
    $("#spotTags").innerHTML = `<span class="chip static">${escapeHtml(s.cat)}</span><span class="chip static ${s._imgs && s._imgs.length ? "live" : ""}">${s._imgs && s._imgs.length ? "实时参考图" : "参考图"}</span>`;
    const p = (s.prompt || "").replace(/\s+/g, " ").trim();
    $("#spotPrompt").textContent = p;
  }

  function moveFocus(d) {
    if (!state.filtered.length) return;
    state.focus = (state.focus + d + state.filtered.length) % state.filtered.length;
    renderSpotlight();
    const sec = $("#spotlight");
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function openModal(i) {
    const s = state.filtered[i];
    if (!s) return;
    state.current = i;
    const img = $("#modalImg");
    img.src = cdnUrl(s.image); img.alt = s.name;
    img.dataset.key = s.id; img.dataset.fallback = s.fallback; img.dataset.cur = s.image;
    img.dataset.civitai = isCivitai(s.image) ? "1" : "0"; img.dataset.retry = "0";
    $("#modalTitle").textContent = s.name;
    $("#modalTags").innerHTML = `<span class="chip static">${escapeHtml(s.cat)}</span><span class="chip static">${escapeHtml(s.desc)}</span><span class="chip static ${s._imgs && s._imgs.length ? "live" : ""}">${s._imgs && s._imgs.length ? "实时参考图" : "参考图"}</span>`;
    $("#modalPrompt").textContent = s.prompt || "（无提示词）";
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() { $("#modal").hidden = true; document.body.style.overflow = ""; }
  function navModal(d) {
    let n = state.current + d;
    if (n < 0) n = state.filtered.length - 1;
    if (n >= state.filtered.length) n = 0;
    openModal(n);
  }

  function copyPrompt() {
    const text = $("#modalPrompt").textContent;
    const btn = $("#copyBtn");
    const done = () => { btn.textContent = "已复制"; btn.classList.add("done"); setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("done"); }, 1400); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
    else fallback(text, done);
  }
  function fallback(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ============ 事件绑定 ============
  document.addEventListener("DOMContentLoaded", () => {
    $("#search").addEventListener("input", applyFilter);
    $("#refresh").addEventListener("click", () => {
      // 本地随机换序（秒开）+ 轮换真实图批次（不重新请求，直接用已缓存图池）
      state.all = state.all.slice().sort(() => Math.random() - 0.5);
      byId = {}; state.all.forEach(s => { byId[s.id] = s; });
      state.off = (state.off + 3) % 97;
      reassignImages();
      applyFilter();
    });
    $("#copyBtn").addEventListener("click", copyPrompt);
    $("#navPrev").addEventListener("click", () => navModal(-1));
    $("#navNext").addEventListener("click", () => navModal(1));
    $("#spotPrev").addEventListener("click", () => moveFocus(-1));
    $("#spotNext").addEventListener("click", () => moveFocus(1));
    $("#spotEnter").addEventListener("click", () => openModal(state.focus));
    $("#spotImg").addEventListener("click", () => openModal(state.focus));
    $("#cats").addEventListener("click", (e) => {
      const chip = e.target.closest(".cat-chip");
      if (!chip) return;
      state.cat = chip.dataset.cat || "";
      applyFilter();
      $("#cats").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    $("#loadmore").addEventListener("click", () => renderGallery(true));
    let wheelLock = false;
    $("#spotlight").addEventListener("wheel", (e) => {
      if (wheelLock) return;
      wheelLock = true; moveFocus(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { wheelLock = false; }, 420);
    }, { passive: true });
    window.addEventListener("scroll", () => {
      if (!state.filtered.length || state.shown >= state.filtered.length) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 900) renderGallery(true);
    }, { passive: true });
    $$("[data-close]").forEach(el => el.addEventListener("click", closeModal));
    document.addEventListener("keydown", e => {
      if ($("#modal").hidden) {
        if (e.key === "ArrowLeft") moveFocus(-1);
        else if (e.key === "ArrowRight") moveFocus(1);
      } else {
        if (e.key === "Escape") closeModal();
        else if (e.key === "ArrowLeft") navModal(-1);
        else if (e.key === "ArrowRight") navModal(1);
      }
    });
    loadStyles();
  });
})();
