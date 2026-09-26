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

  const state = { all: [], filtered: [], current: -1, focus: 0 };

  // 仅用于真正出错时给一句提示，平时不显示任何模式/来源文字
  function setStatus(t) { const el = $("#status"); el.textContent = t || ""; el.hidden = !t; }

  async function loadStyles() {
    try {
      const res = await fetch(LIVE, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const list = (data && Array.isArray(data.styles)) ? data.styles : [];
      if (!list.length) throw new Error("empty");
      state.all = list;
      applyFilter();
    } catch (e) {
      try {
        // 优先用内嵌的离线数据（双击打开即可用，无需本地服务器）；
        // 若没有内嵌数据，再尝试 fetch 本地 sample.json。
        let d2 = window.__SAMPLE__;
        if (!d2) {
          const r2 = await fetch(FALLBACK);
          d2 = await r2.json();
        }
        state.all = (d2 && Array.isArray(d2.styles)) ? d2.styles : [];
        applyFilter();
      } catch (e2) {
        setStatus("加载失败：请检查网络，或部署到 Cloudflare Pages 后访问。");
      }
    }
  }

  function applyFilter() {
    const kw = ($("#search").value || "").trim().toLowerCase();
    state.filtered = state.all.filter(s => {
      if (!kw) return true;
      const hay = [s.title, s.prompt, s.author, (s.tags || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(kw);
    });
    state.focus = 0;
    renderSpotlight();
    renderGallery();
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
    $("#refresh").addEventListener("click", loadStyles);
    $("#copyBtn").addEventListener("click", copyPrompt);
    $("#navPrev").addEventListener("click", () => navModal(-1));
    $("#navNext").addEventListener("click", () => navModal(1));
    $("#spotPrev").addEventListener("click", () => moveFocus(-1));
    $("#spotNext").addEventListener("click", () => moveFocus(1));
    $("#spotEnter").addEventListener("click", () => openModal(state.focus));
    $("#spotImg").addEventListener("click", () => openModal(state.focus));
    let wheelLock = false;
    $("#spotlight").addEventListener("wheel", (e) => {
      if (wheelLock) return;
      wheelLock = true;
      moveFocus(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { wheelLock = false; }, 420);
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
