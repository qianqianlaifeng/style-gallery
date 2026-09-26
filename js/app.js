/* ============================================================
 * 风格参考 · 实时 AI 灵感画廊 - 交互逻辑（原生 JS，无依赖）
 * 流程：优先请求 Cloudflare Pages Function /api/styles（实时），
 *       失败则回退到本地 sample.json（双击即可看效果）。
 * 顶部「焦点风格」为精选大图，可用 ← → / 滚轮 / 按钮切换，
 * 点图进入详情；下方为完整风格参考网格。不显示任何来源/模式信息。
 * ============================================================ */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const LIVE = "/api/styles";
  const FALLBACK = "./sample.json";
  const LIBRARY = "./library.json";   // 海量真图库（离线可用，优先展示）

  const state = { all: [], filtered: [], current: -1, focus: 0, cat: "", shown: 0 };

  // 仅用于真正出错时给一句提示，平时不显示任何模式/来源文字
  function setStatus(t) { const el = $("#status"); el.textContent = t || ""; el.hidden = !t; }

  // 读取内嵌/本地数据（不产生"先显示一批再被替换"的闪动）
  async function readLocal() {
    if (window.__LIBRARY__ && window.__LIBRARY__.styles && window.__LIBRARY__.styles.length) return window.__LIBRARY__;
    if (window.__SAMPLE__ && window.__SAMPLE__.styles && window.__SAMPLE__.styles.length) return window.__SAMPLE__;
    try { const r = await fetch(LIBRARY, { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) {}
    try { const r = await fetch(FALLBACK, { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) {}
    return null;
  }

  // 先一次性把本地/接口数据都准备好，再渲染一次 —— 彻底避免"刷一下图没了"的闪动
  async function loadStyles() {
    let list = [];
    // 1) 优先尝试实时接口
    try {
      const res = await fetch(LIVE, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.styles) && data.styles.length) list = data.styles;
      }
    } catch (e) { /* 静默，走本地 */ }

    // 2) 接口不可用则用本地（内嵌优先，零延迟、不闪）
    if (!list.length) {
      const local = await readLocal();
      if (local && Array.isArray(local.styles)) list = local.styles;
    }

    if (!list.length) { setStatus("加载失败：请检查网络后重试。"); return; }
    state.all = list;
    applyFilter();
  }

  function applyFilter() {
    const kw = ($("#search").value || "").trim().toLowerCase();
    const cat = state.cat || "";
    state.filtered = state.all.filter(s => {
      if (cat && !(s.tags || []).includes(cat)) return false;
      if (!kw) return true;
      const hay = [s.title, s.prompt, s.author, (s.tags || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(kw);
    });
    state.focus = 0;
    state.shown = 0;             // 重置分页
    renderCategories();
    renderSpotlight();
    renderGallery();
  }

  // 分类配色条（按标签聚合，点一下只看该类）
  function renderCategories() {
    const bar = $("#cats");
    if (!bar) return;
    const counts = new Map();
    state.all.forEach(s => (s.tags || []).slice(1).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    bar.innerHTML = `<button class="cat-chip${!state.cat ? " active" : ""}" data-cat="">全部 (${state.all.length})</button>` +
      cats.map(([c, n]) => `<button class="cat-chip${state.cat === c ? " active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)} (${n})</button>`).join("");
  }

  const PAGE = 60;   // 每次渲染多少张，滚到底自动追加
  function renderGallery(append) {
    const g = $("#gallery");
    $("#empty").hidden = state.filtered.length > 0;
    const start = append ? state.shown : 0;
    const slice = state.filtered.slice(start, start + PAGE);
    let html = slice.map((s, k) => {
      const i = start + k;
      return `
      <article class="card" data-index="${i}">
        <div class="card-img"><img src="${s.image}" alt="${escapeHtml(s.title)}" loading="lazy" /></div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(s.title)}</div>
          <div class="card-tags">${(s.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
        </div>
      </article>`;
    }).join("");
    if (append) g.insertAdjacentHTML("beforeend", html);
    else g.innerHTML = html;
    state.shown = Math.min(state.filtered.length, start + slice.length);

    // 绑定新卡片点击（只绑未绑定的）
    $$(".card", g).forEach(c => {
      if (c.dataset.bound) return;
      c.dataset.bound = "1";
      c.addEventListener("click", () => {
        const i = parseInt(c.dataset.index, 10);
        state.focus = i;
        renderSpotlight();
        openModal(i);
      });
    });
    $("#loadmore").hidden = state.shown >= state.filtered.length;
    $("#count").textContent = state.filtered.length ? `共 ${state.filtered.length} 个风格` : "";
  }

  function renderSpotlight() {
    const s = state.filtered[state.focus];
    const sec = $("#spotlight");
    if (!s) { sec.hidden = true; return; }
    sec.hidden = false;
    $("#spotImg").src = s.image;
    $("#spotImg").alt = s.title;
    $("#spotTitle").textContent = s.title;
    $("#spotTags").innerHTML = (s.tags || []).slice(0, 6).map(t => `<span class="chip static">${escapeHtml(t)}</span>`).join("");
    const p = (s.prompt || "").replace(/\s+/g, " ").trim();
    $("#spotPrompt").textContent = p ? p.slice(0, 200) + (p.length > 200 ? "…" : "") : "（无提示词）";
  }

  function renderGallery() {
    const g = $("#gallery");
    $("#empty").hidden = state.filtered.length > 0;
    g.innerHTML = state.filtered.map((s, i) => `
      <article class="card" data-index="${i}">
        <div class="card-img"><img src="${s.image}" alt="${escapeHtml(s.title)}" loading="lazy" /></div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(s.title)}</div>
          <div class="card-tags">${(s.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
        </div>
      </article>`).join("");
    $$(".card", g).forEach(c => c.addEventListener("click", () => {
      const i = parseInt(c.dataset.index, 10);
      state.focus = i;
      renderSpotlight();
      openModal(i);
    }));
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
    $("#modalImg").src = s.image;
    $("#modalImg").alt = s.title;
    $("#modalTitle").textContent = s.title;
    $("#modalTags").innerHTML = (s.tags || []).map(t => `<span class="chip static">${escapeHtml(t)}</span>`).join("");
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
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#search").addEventListener("input", applyFilter);
    $("#refresh").addEventListener("click", () => {
      const b = $("#refresh"); b.disabled = true; b.textContent = "↻ 更新中…";
      loadStyles().finally(() => { b.disabled = false; b.textContent = "↻ 刷新"; });
    });
    $("#copyBtn").addEventListener("click", copyPrompt);
    $("#navPrev").addEventListener("click", () => navModal(-1));
    $("#navNext").addEventListener("click", () => navModal(1));
    $("#spotPrev").addEventListener("click", () => moveFocus(-1));
    $("#spotNext").addEventListener("click", () => moveFocus(1));
    $("#spotEnter").addEventListener("click", () => openModal(state.focus));
    $("#spotImg").addEventListener("click", () => openModal(state.focus));
    // 分类筛选
    $("#cats").addEventListener("click", (e) => {
      const chip = e.target.closest(".cat-chip");
      if (!chip) return;
      state.cat = chip.dataset.cat || "";
      applyFilter();
      $("#cats").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    // 加载更多
    $("#loadmore").addEventListener("click", () => renderGallery(true));
    let wheelLock = false;
    $("#spotlight").addEventListener("wheel", (e) => {
      if (wheelLock) return;
      wheelLock = true;
      moveFocus(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { wheelLock = false; }, 420);
    }, { passive: true });
    // 滚到接近底部自动加载更多
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
