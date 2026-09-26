/* ============================================================
 * 风格参考 · AI 视频灵感画廊 - 前端逻辑（原生 JS，无依赖）
 *
 * 数据流（三级兜底，永不白屏）：
 *   1) 实时流：浏览器直接调 Civitai 公开接口（models 按风格词取
 *      高赞模型示例图），每次刷新随机抽词，图常新；
 *   2) 本地图库：library-data.js 内嵌的 254 张风格图（离线可用）；
 *   3) 初始示例：sample-data.js 内嵌的 36 张 AI 风格图。
 * 点击分类可实时拉取该风格的更多图；详情弹窗提供该风格的可复制提示词。
 * ============================================================ */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ============ 细分风格词表（en=检索词 zh=中文 cat=分类 tpl=提示词模板） ============
  const WORDS = [
    { en: "cinematic lighting", zh: "电影感 / 胶片大片", cat: "影视感", tpl: "cinematic film still, dramatic lighting, shallow depth of field, film grain, anamorphic lens, 35mm, photorealistic" },
    { en: "film noir", zh: "黑色电影 / 暗调", cat: "影视感", tpl: "film noir style, high contrast black and white, dramatic shadows, venetian blind lighting, moody atmosphere, 1940s" },
    { en: "golden hour", zh: "黄金时刻光", cat: "影视感", tpl: "golden hour lighting, warm sunset glow, soft backlight, lens flare, warm color grade, cinematic" },
    { en: "volumetric lighting", zh: "体积光 / 丁达尔", cat: "影视感", tpl: "volumetric lighting, god rays, light shafts through fog, atmospheric haze, cinematic lighting, ultra detailed" },
    { en: "neon lighting", zh: "霓虹光效", cat: "影视感", tpl: "neon lighting, vibrant neon glow, colorful reflections, night scene, high contrast, cyberpunk aesthetic" },
    { en: "silhouette backlight", zh: "逆光剪影", cat: "影视感", tpl: "silhouette against bright backlight, rim light, dramatic contrast, minimalist composition, sunset background" },
    { en: "cyberpunk", zh: "赛博朋克", cat: "科幻", tpl: "cyberpunk city at night, neon signs, rain reflections, holographic ads, futuristic dystopia, cinematic, ultra detailed" },
    { en: "sci-fi city", zh: "科幻都市", cat: "科幻", tpl: "futuristic sci-fi megacity, flying vehicles, skyscrapers, holographic interface, clean design, concept art" },
    { en: "mecha robot", zh: "机甲", cat: "科幻", tpl: "giant mecha robot, detailed mechanical design, battle damage, epic scale, industrial design, anime style" },
    { en: "space nebula", zh: "星际星云", cat: "科幻", tpl: "deep space nebula, vibrant cosmic colors, stars, galaxy, epic scale, astrophotography style, ultra detailed" },
    { en: "steampunk", zh: "蒸汽朋克", cat: "科幻", tpl: "steampunk machinery, brass gears, victorian aesthetic, steam pipes, retro-futuristic, intricate details" },
    { en: "post apocalyptic", zh: "末世废土", cat: "科幻", tpl: "post apocalyptic wasteland, ruined city, overgrown vegetation, abandoned vehicles, dusty atmosphere, desaturated" },
    { en: "anime scenery", zh: "动画风景", cat: "动漫", tpl: "anime scenery, beautiful landscape, makoto shinkai style, vivid sky, detailed clouds, anime background art" },
    { en: "studio ghibli", zh: "吉卜力风", cat: "动漫", tpl: "studio ghibli style, pastoral countryside, soft watercolor palette, whimsical, hand drawn animation aesthetic" },
    { en: "anime portrait", zh: "动漫人像", cat: "动漫", tpl: "anime portrait, detailed eyes, cel shading, beautiful lighting, high quality anime illustration" },
    { en: "chibi cute", zh: "Q版可爱", cat: "动漫", tpl: "chibi character, cute, big eyes, pastel colors, kawaii style, simple background, adorable" },
    { en: "manga ink", zh: "漫画黑白", cat: "动漫", tpl: "manga style, black and white ink, screentone, dynamic linework, dramatic panel composition" },
    { en: "watercolor", zh: "水彩", cat: "绘画", tpl: "watercolor painting, soft washes, paper texture, delicate brush strokes, airy composition, artistic" },
    { en: "oil painting", zh: "油画", cat: "绘画", tpl: "oil painting, thick impasto brush strokes, classical composition, rich colors, canvas texture, masterpiece" },
    { en: "ink wash painting", zh: "水墨 / 国画", cat: "绘画", tpl: "chinese ink wash painting, sumi-e, minimalist, flowing brush strokes, negative space, misty mountains" },
    { en: "chinese guofeng", zh: "国风古韵", cat: "绘画", tpl: "chinese traditional art, guofeng, elegant, ancient architecture, hanfu, delicate details, oriental aesthetic" },
    { en: "ukiyo-e", zh: "浮世绘", cat: "绘画", tpl: "ukiyo-e woodblock print, edo period, flat colors, wave patterns, traditional japanese art, hokusai style" },
    { en: "art nouveau", zh: "新艺术运动", cat: "绘画", tpl: "art nouveau poster, mucha style, ornate floral borders, elegant curves, muted gold palette, decorative" },
    { en: "art deco", zh: "装饰艺术", cat: "绘画", tpl: "art deco design, geometric patterns, gold and black, symmetrical, 1920s gatsby luxury, elegant" },
    { en: "impressionist", zh: "印象派", cat: "绘画", tpl: "impressionist painting, monet style, loose brushwork, dappled light, plein air, soft pastel colors" },
    { en: "surrealism", zh: "超现实", cat: "绘画", tpl: "surrealism, dali inspired, dreamlike scene, impossible geometry, melting objects, imaginative, fine art" },
    { en: "pop art", zh: "波普艺术", cat: "绘画", tpl: "pop art style, andy warhol, bold primary colors, halftone dots, comic style, high contrast" },
    { en: "pixel art", zh: "像素风", cat: "设计感", tpl: "pixel art, 16-bit retro game style, crisp pixels, limited palette, isometric sprite, nostalgic" },
    { en: "low poly", zh: "低多边形", cat: "设计感", tpl: "low poly 3d render, geometric shapes, flat shading, minimalist color palette, clean design" },
    { en: "isometric", zh: "等距视角", cat: "设计感", tpl: "isometric illustration, 45 degree view, diorama, cute miniature world, clean vector style, detailed" },
    { en: "claymation", zh: "黏土定格", cat: "设计感", tpl: "claymation style, clay render, stop motion aesthetic, handmade texture, soft studio lighting, charming" },
    { en: "papercut layered", zh: "剪纸层叠", cat: "设计感", tpl: "layered paper cut art, papercraft diorama, depth of layers, soft shadows, craft aesthetic" },
    { en: "stained glass", zh: "彩绘玻璃", cat: "设计感", tpl: "stained glass window, leaded glass, vibrant translucent colors, gothic pattern, light shining through" },
    { en: "line art", zh: "线稿", cat: "设计感", tpl: "clean line art, minimal linework, single weight lines, elegant simplicity, white background, illustration" },
    { en: "flat illustration", zh: "扁平插画", cat: "设计感", tpl: "flat design illustration, simple shapes, limited color palette, modern vector art, minimal shading" },
    { en: "double exposure", zh: "双重曝光", cat: "摄影感", tpl: "double exposure, portrait blended with landscape, artistic overlay, ethereal, creative photography" },
    { en: "long exposure", zh: "长曝光", cat: "摄影感", tpl: "long exposure photography, light trails, silky water, motion blur, night scene, tripod shot" },
    { en: "macro photography", zh: "微距", cat: "摄影感", tpl: "macro photography, extreme close up, shallow depth of field, dew drops, intricate detail, bokeh" },
    { en: "aerial drone", zh: "航拍", cat: "摄影感", tpl: "aerial drone photography, top down view, geometric landscape patterns, vast scale, golden light" },
    { en: "street photography", zh: "街头摄影", cat: "摄影感", tpl: "street photography, candid moment, urban life, natural light, decisive moment, documentary style" },
    { en: "portrait photography", zh: "人像摄影", cat: "摄影感", tpl: "studio portrait photography, softbox lighting, sharp eyes, skin texture, professional headshot, bokeh background" },
    { en: "black and white photo", zh: "黑白摄影", cat: "摄影感", tpl: "black and white photography, high contrast, fine art, dramatic light, timeless composition" },
    { en: "tilt shift", zh: "移轴微缩", cat: "摄影感", tpl: "tilt shift photography, miniature effect, selective focus, toy town aesthetic, aerial view" },
    { en: "foggy forest", zh: "雾气森林", cat: "自然", tpl: "misty forest, dense fog, moody atmosphere, tall trees, ethereal light, mystical woodland" },
    { en: "desert dunes", zh: "沙漠戈壁", cat: "自然", tpl: "desert sand dunes, rippled sand texture, harsh sunlight, minimalist landscape, warm tones" },
    { en: "ocean waves", zh: "海浪", cat: "自然", tpl: "dramatic ocean waves, crashing surf, spray and foam, powerful sea, dynamic motion, seascape" },
    { en: "starry night sky", zh: "星空银河", cat: "自然", tpl: "starry night sky, milky way galaxy, astrophotography, long exposure, silhouetted landscape, cosmic" },
    { en: "aurora borealis", zh: "极光", cat: "自然", tpl: "aurora borealis, northern lights, vibrant green and purple, snowy landscape, night photography" },
    { en: "autumn foliage", zh: "秋色", cat: "自然", tpl: "autumn foliage, golden leaves, warm fall colors, forest path, soft light, seasonal landscape" },
    { en: "snow winter", zh: "冬日雪景", cat: "自然", tpl: "winter snow landscape, pristine snow, blue hour, quiet atmosphere, frosty trees, serene" },
    { en: "tropical beach", zh: "热带海滩", cat: "自然", tpl: "tropical beach paradise, turquoise water, palm trees, white sand, bright sunlight, vacation vibe" },
    { en: "mountain sunrise", zh: "山峦日出", cat: "自然", tpl: "mountain peak at sunrise, alpenglow, layered ridges, dramatic sky, epic landscape, crisp air" },
    { en: "underwater", zh: "水下世界", cat: "自然", tpl: "underwater photography, sun rays through water, marine life, blue depths, ethereal, light caustics" },
    { en: "fantasy castle", zh: "奇幻城堡", cat: "奇幻", tpl: "fantasy castle, epic architecture, dramatic clouds, magical atmosphere, concept art, highly detailed" },
    { en: "dragon fantasy", zh: "龙与传说", cat: "奇幻", tpl: "epic dragon, scales detail, flying over mountains, fire breath, fantasy art, dramatic lighting" },
    { en: "fairy forest", zh: "精灵森林", cat: "奇幻", tpl: "enchanted fairy forest, glowing mushrooms, magical particles, bioluminescence, mystical atmosphere" },
    { en: "dark gothic", zh: "哥特暗黑", cat: "奇幻", tpl: "gothic architecture, dark cathedral, moody fog, candlelight, ornate details, dark fantasy" },
    { en: "wuxia sword", zh: "武侠刀剑", cat: "奇幻", tpl: "wuxia martial arts, swordsman on rooftop, flowing robes, bamboo forest, ink tinged, cinematic" },
    { en: "xianxia immortal", zh: "仙侠修仙", cat: "奇幻", tpl: "xianxia immortal cultivator, floating mountains, flowing silk, celestial palace, ethereal glow, guofeng" },
    { en: "vaporwave", zh: "蒸汽波", cat: "潮流", tpl: "vaporwave aesthetic, pink and cyan gradient, greek statue, retro computer, grid horizon, glitch" },
    { en: "retro 80s synthwave", zh: "复古80年代", cat: "潮流", tpl: "synthwave retrowave, 80s neon, sunset grid, chrome text, laser lines, nostalgic futurism" },
    { en: "y2k aesthetic", zh: "Y2K 千禧", cat: "潮流", tpl: "y2k aesthetic, metallic chrome, bubble shapes, millennium futurism, glossy plastic, iridescent" },
    { en: "brutalist architecture", zh: "粗野建筑", cat: "城市", tpl: "brutalist architecture, raw concrete, geometric mass, dramatic shadows, overcast sky, monolithic" },
    { en: "japanese garden", zh: "日式庭院", cat: "城市", tpl: "japanese zen garden, cherry blossoms, stone path, tea house, tranquil, soft morning light" },
    { en: "night city street", zh: "都市夜街", cat: "城市", tpl: "night city street, wet asphalt reflections, neon shop signs, urban solitude, cinematic street photography" },
    { en: "abandoned building", zh: "废弃建筑", cat: "城市", tpl: "abandoned building, urban decay, peeling paint, shafts of light, haunting atmosphere, lost places" }
  ];
  const WORD_BY_ZH = new Map(WORDS.map(w => [w.zh, w]));

  const state = { all: [], filtered: [], current: -1, focus: 0, cat: "", shown: 0, liveTried: new Set() };

  // 仅用于真正出错时给一句提示，平时不显示任何模式/来源文字
  function setStatus(t) { const el = $("#status"); if (!el) return; el.textContent = t || ""; el.hidden = !t; }

  // ============ 实时流：Civitai models 接口 ============
  const LIVE_WORDS = 6;      // 每轮拉取的风格词数
  const LIVE_PER_WORD = 3;   // 每个词取几张图
  const FETCH_TIMEOUT = 8000; // 接口 8 秒无响应直接放弃（避免卡住页面）

  function thumbUrl(u) { return u ? u.replace("original=true", "width=420") : u; }

  async function fetchWord(w, imgsPerModel) {
    const api = "https://civitai.com/api/v1/models?limit=2&query=" + encodeURIComponent(w.en) +
      "&types=Checkpoint&types=LORA&sort=Highest+Rated&nsfw=false";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    let res;
    try {
      res = await fetch(api, { cache: "no-store", signal: ctrl.signal });
    } catch (e) {
      throw new Error("timeout/network");
    } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    const items = (d && Array.isArray(d.items)) ? d.items : [];
    const out = [];
    for (const m of items) {
      const ver = (m.modelVersions || [{}])[0];
      for (const im of (ver.images || [])) {
        if (out.length >= imgsPerModel) break;
        const u = im.url || "";
        if (!u) continue;
        if (im.nsfwLevel != null && im.nsfwLevel > 1) continue; // 只留安全图
        out.push({
          id: "L" + im.id,
          image: thumbUrl(u),
          title: w.zh,
          prompt: w.tpl,
          tags: [w.zh, w.cat],
          author: (m.name || "").slice(0, 60) || "AI 模型"
        });
      }
      if (out.length >= imgsPerModel * 2) break;
    }
    return out;
  }

  async function fetchLiveWords(words, imgsPerModel) {
    const results = await Promise.allSettled(words.map(w => fetchWord(w, imgsPerModel)));
    const merged = [];
    results.forEach(r => { if (r.status === "fulfilled") merged.push(...r.value); });
    return merged;
  }

  // ============ 三级数据加载 ============
  function dedupeById(list) {
    const seen = new Set();
    return list.filter(s => {
      if (!s.image || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }

  function readLocalStyles() {
    if (window.__LIBRARY__ && Array.isArray(window.__LIBRARY__.styles)) return window.__LIBRARY__.styles;
    return [];
  }

  // 首屏策略：本地 254 张同域静态图先渲染（秒开），
  // 实时接口后台静默拉，拉到后自动插到最前面再刷新一次视图。
  async function loadStyles() {
    const lib = readLocalStyles();
    if (lib.length) {
      state.all = dedupeById(lib);
      applyFilter();
    } else if (window.__SAMPLE__ && Array.isArray(window.__SAMPLE__.styles) && window.__SAMPLE__.styles.length) {
      state.all = window.__SAMPLE__.styles.slice();
      applyFilter();
    } else {
      setStatus("加载失败：请检查网络后点「刷新」重试。");
      return;
    }
    backgroundLive();
  }

  function backgroundLive() {
    const shuffled = WORDS.slice().sort(() => Math.random() - 0.5);
    const pick = shuffled.slice(0, LIVE_WORDS);
    fetchLiveWords(pick, LIVE_PER_WORD).then(live => {
      if (!live.length) return; // 接口不通就保持本地图，不打扰用户
      pick.forEach(w => state.liveTried.add(w.zh));
      state.all = dedupeById(live.concat(state.all));
      applyFilter();
    }).catch(() => { /* 静默降级 */ });
  }

  // ============ 筛选 / 分类 / 分页渲染 ============
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
    state.shown = 0;
    renderCategories();
    renderSpotlight();
    renderGallery();
  }

  function renderCategories() {
    const bar = $("#cats");
    if (!bar) return;
    const counts = new Map();
    state.all.forEach(s => { const c = (s.tags || [])[1]; if (c) counts.set(c, (counts.get(c) || 0) + 1); });
    const order = ["影视感", "科幻", "动漫", "绘画", "设计感", "摄影感", "自然", "奇幻", "潮流", "城市"];
    const cats = order.filter(c => counts.has(c)).concat([...counts.keys()].filter(c => !order.includes(c)));
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

    $$(".card-img img", g).forEach(im => { if (im.complete && im.naturalWidth) im.classList.add("loaded"); });
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
    $("#count").textContent = state.filtered.length ? `共 ${state.filtered.length} 张 · ${state.cat || "全部风格"}` : "";
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

  // ============ 图片容错：失败自动重试一次，再失败换占位色块（不裂图） ============
  function onImgError(e) {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || !img.src) return;
    if (!(img.closest(".card-img") || img.closest(".spotlight-img") || img.closest(".modal-img"))) return;
    const step = parseInt(img.dataset.retry || "0", 10);
    if (step === 0) {
      img.dataset.retry = "1";
      // 换个更小的尺寸参数重试（绕开 CDN 单次失败）
      img.src = img.src.replace("width=420", "width=256");
      return;
    }
    // 最终失败：画廊卡片换成占位色块；焦点/弹窗大图保留原位（避免破坏元素引用）
    const box = img.closest(".card-img");
    if (box) {
      const ph = document.createElement("div");
      ph.className = "img-ph";
      ph.textContent = img.alt || "风格图";
      img.replaceWith(ph);
    }
  }

  // ============ 事件绑定 ============
  // 图片加载完成后淡入（load 不冒泡，捕获委托）；缓存的图渲染时已 complete，同步补上
  document.addEventListener("load", (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG" && t.closest && t.closest(".card-img")) t.classList.add("loaded");
  }, true);
  document.addEventListener("error", onImgError, true); // error 不冒泡，用捕获委托
  document.addEventListener("DOMContentLoaded", () => {
    $("#search").addEventListener("input", applyFilter);
    $("#refresh").addEventListener("click", async () => {
      const b = $("#refresh"); b.disabled = true; b.textContent = "↻ 更新中…";
      try {
        const untried = WORDS.filter(w => !state.liveTried.has(w.zh));
        const pool = untried.length >= LIVE_WORDS ? untried : WORDS.slice();
        const pick = pool.sort(() => Math.random() - 0.5).slice(0, LIVE_WORDS);
        const live = await fetchLiveWords(pick, LIVE_PER_WORD);
        if (live.length) {
          pick.forEach(w => state.liveTried.add(w.zh));
          state.all = dedupeById(live.concat(state.all));
          applyFilter();
        }
      } finally { b.disabled = false; b.textContent = "↻ 刷新"; }
    });
    $("#copyBtn").addEventListener("click", copyPrompt);
    $("#navPrev").addEventListener("click", () => navModal(-1));
    $("#navNext").addEventListener("click", () => navModal(1));
    $("#spotPrev").addEventListener("click", () => moveFocus(-1));
    $("#spotNext").addEventListener("click", () => moveFocus(1));
    $("#spotEnter").addEventListener("click", () => openModal(state.focus));
    $("#spotImg").addEventListener("click", () => openModal(state.focus));
    // 分类点击：优先实时拉该风格，失败用本地兜底
    $("#cats").addEventListener("click", async (e) => {
      const chip = e.target.closest(".cat-chip");
      if (!chip) return;
      state.cat = chip.dataset.cat || "";
      const w = WORD_BY_ZH.get(state.cat);
      if (w && !state.liveTried.has(w.zh)) {
        state.liveTried.add(w.zh);
        chip.textContent = w.zh + " (加载中…)";
        try {
          const live = await fetchWord(w, 6);
          if (live.length) { state.all = dedupeById(live.concat(state.all)); }
        } catch (err) { /* 本地兜底 */ }
      }
      applyFilter();
      $("#cats").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    $("#loadmore").addEventListener("click", () => renderGallery(true));
    let wheelLock = false;
    $("#spotlight").addEventListener("wheel", (e) => {
      if (wheelLock) return;
      wheelLock = true;
      moveFocus(e.deltaY > 0 ? 1 : -1);
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
