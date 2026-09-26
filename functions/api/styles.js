/* ============================================================
 * Cloudflare Pages Function - 实时接口（路由：/api/styles）
 * 服务端并行代理多个公开 AI 作品接口，解决浏览器跨域，并把返回
 * 规范化为前端需要的 { id, image, title, prompt, tags, author, source }。
 * 每次请求都实时拉取，画廊自动更新、无需手动维护。
 *
 * 已接入的外部接口：
 *   1) Civitai   - 公开图片 API（最新 AI 作品 + 提示词）
 *   2) Lexica    - SD/AI 提示词检索（按细分风格词定向抓取，更具体）
 *   3) Reddit    - r/AIArt 热门（真实 AI 作品流）
 * 任一接口失败都不影响其他接口，最终前端会自动回退到本地 sample.json。
 * ============================================================ */

// 细分风格词表：用这些具体画风去 Lexica 定向检索，拿到更细致的风格，
// 而不是笼统的随机图。刷新时按时间错开，保证每次都有新风格。
const STYLE_QUERIES = [
  "cinematic film still", "watercolor illustration", "ink wash chinese painting",
  "low poly 3d render", "isometric diorama", "pixel art sprite",
  "art nouveau poster", "ukiyo-e woodblock", "cyberpunk neon city",
  "claymation stop motion", "studio ghibli style scene", "concept art matte painting",
  "vaporwave aesthetic", "surreal dreamcore", "oil painting portrait",
  "anime key visual", "stained glass art", "steampunk airship"
];

// 风格关键词 → 中文细分标签 + 大类（把长英文提示词归纳成更细致的画风名）
const STYLES = [
  { re: /cinematic|film still|movie scene|dramatic lighting|anamorphic/, zh: "电影感 / 胶片大片", cat: "写实" },
  { re: /film noir|noir/, zh: "黑色电影 / 暗调", cat: "写实" },
  { re: /anime|manga|japanese animation/, zh: "日式动画", cat: "动画" },
  { re: /studio ghibli|ghibli/, zh: "吉卜力风", cat: "动画" },
  { re: /watercolor|水彩/, zh: "水彩", cat: "插画" },
  { re: /oil painting|oil on canvas/, zh: "油画", cat: "插画" },
  { re: /ink wash|sumi-e|chinese painting|水墨/, zh: "水墨 / 国画", cat: "插画" },
  { re: /ukiyo-e|woodblock/, zh: "浮世绘", cat: "插画" },
  { re: /art nouveau/, zh: "新艺术运动", cat: "插画" },
  { re: /art deco/, zh: "装饰艺术", cat: "插画" },
  { re: /pop art/, zh: "波普艺术", cat: "插画" },
  { re: /comic book|comic style|graphic novel/, zh: "美漫", cat: "插画" },
  { re: /low poly/, zh: "低多边形", cat: "3D" },
  { re: /isometric/, zh: "等距视角", cat: "3D" },
  { re: /pixel art|16-bit|8-bit/, zh: "像素风", cat: "3D" },
  { re: /voxel/, zh: "体素", cat: "3D" },
  { re: /claymation|clay render|stop motion/, zh: "黏土 / 定格", cat: "3D" },
  { re: /cyberpunk/, zh: "赛博朋克", cat: "科幻" },
  { re: /vaporwave/, zh: "蒸汽波", cat: "科幻" },
  { re: /surreal|dreamcore|liminal/, zh: "超现实 / 梦核", cat: "抽象" },
  { re: /glitch/, zh: "故障艺术", cat: "抽象" },
  { re: /line art|ink drawing|pen drawing/, zh: "线稿", cat: "插画" },
  { re: /stained glass/, zh: "彩绘玻璃", cat: "插画" },
  { re: /paper cut|papercraft|kirigami/, zh: "纸艺 / 剪纸", cat: "3D" },
  { re: /blueprint|technical drawing/, zh: "蓝图 / 工程图", cat: "插画" },
  { re: /concept art|matte painting|environment design/, zh: "概念设定 / 场景", cat: "插画" },
  { re: /fantasy/, zh: "奇幻", cat: "科幻" },
  { re: /sci-?fi|science fiction|futuristic/, zh: "科幻", cat: "科幻" },
  { re: /horror|creepy|eerie/, zh: "恐怖", cat: "抽象" },
  { re: /gothic/, zh: "哥特", cat: "抽象" },
  { re: /kawaii|chibi|cute/, zh: "可爱 / Q版", cat: "动画" },
  { re: /disney|pixar|3d character/, zh: "迪士尼 / 皮克斯 3D", cat: "3D" },
  { re: /wuxia|xianxia|chinese martial/, zh: "武侠 / 仙侠", cat: "写实" },
  { re: /mecha|gundam|robot fight/, zh: "机甲", cat: "科幻" },
  { re: /steampunk/, zh: "蒸汽朋克", cat: "科幻" },
  { re: /retro|80s|synthwave/, zh: "复古 / 80年代", cat: "抽象" },
  { re: /neon/, zh: "霓虹", cat: "科幻" },
  { re: /pastel/, zh: "柔和粉彩", cat: "插画" },
  { re: /monochrome|black and white/, zh: "黑白", cat: "抽象" },
  { re: /double exposure/, zh: "双重曝光", cat: "抽象" },
  { re: /minimalist|minimal/, zh: "极简", cat: "抽象" },
  { re: /3d render|octane render|blender|c4d/, zh: "3D 渲染", cat: "3D" },
  { re: /photorealistic|photoreal|hyperreal/, zh: "超写实", cat: "写实" },
  { re: /impressionist/, zh: "印象派", cat: "插画" },
  { re: /psychedelic/, zh: "迷幻", cat: "抽象" }
];

function inferStyle(prompt, extra) {
  const p = String(prompt || "").toLowerCase();
  const matched = [];
  const cats = new Set();
  for (const s of STYLES) {
    if (s.re.test(p)) { matched.push(s.zh); cats.add(s.cat); }
  }
  let title, styleTags;
  if (matched.length) {
    title = matched[0];
    styleTags = matched.slice(0, 5).concat([...cats].slice(0, 2));
  } else if (extra && extra.length) {
    const q = String(extra[0]).trim();
    title = q.length > 24 ? q.slice(0, 24) + "…" : q;
    styleTags = [q];
  } else {
    title = "AI 风格作品";
    styleTags = ["AI 风格"];
  }
  return { title, styleTags };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function normalize(image, prompt, author, sourceLabel, i, extra) {
  if (!image || !/^https?:\/\//.test(image)) return null;
  const { title, styleTags } = inferStyle(prompt, extra);
  // 仅当提示词里没识别出具体画风时，才把检索词作为兜底标签，
  // 避免把笼统的英文检索词（如 "cinematic film still"）直接塞进标签。
  const tags = styleTags.length
    ? styleTags
    : (extra && extra[0] ? [extra[0]] : ["AI 风格"]);
  return {
    id: sourceLabel.replace(/\W/g, "") + "-" + i + "-" + hash(image),
    image,
    title,
    prompt: prompt || "",
    tags: tags.slice(0, 8),
    author: author || sourceLabel,
    source: sourceLabel
  };
}

async function fetchCivitai() {
  const url = "https://civitai.com/api/v1/images?limit=60&nsfw=false&sort=Newest";
  const res = await fetch(url, { headers: { "User-Agent": "style-gallery/1.0" } });
  if (!res.ok) throw new Error("civitai " + res.status);
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((it, i) => {
    const img = it.url || (it.assets && it.assets[0] && it.assets[0].url) || "";
    const prompt = it.prompt || (it.meta && it.meta.prompt) || "";
    return normalize(img, prompt, it.username || "Civitai", "Civitai", i, []);
  }).filter(Boolean);
}

async function fetchLexica(queries) {
  const out = [];
  const results = await Promise.allSettled(queries.map(async (q) => {
    const url = "https://lexica.art/api/v1/search?q=" + encodeURIComponent(q) + "&limit=5";
    const res = await fetch(url, { headers: { "User-Agent": "style-gallery/1.0" } });
    if (!res.ok) throw new Error("lexica " + res.status);
    const data = await res.json();
    const imgs = Array.isArray(data.images) ? data.images : [];
    return imgs.map((im, j) => {
      const src = im.src || (im.images && im.images[0]) || "";
      const prompt = im.prompt || "";
      return normalize(src, prompt, "Lexica", "Lexica", j, [q]);
    }).filter(Boolean);
  }));
  results.forEach((r) => { if (r.status === "fulfilled") out.push(...r.value); });
  return out;
}

async function fetchReddit() {
  const url = "https://www.reddit.com/r/AIArt/hot.json?limit=50&raw_json=1";
  const res = await fetch(url, { headers: { "User-Agent": "style-gallery/1.0" } });
  if (!res.ok) throw new Error("reddit " + res.status);
  const data = await res.json();
  const children = (data && data.data && data.data.children) || [];
  return children.map((c, j) => {
    const p = c.data || {};
    const img = p.url_overridden_by_dest || p.thumbnail || "";
    if (!/^https?:\/\/.*\.(jpg|jpeg|png|webp)/i.test(img)) return null;
    const prompt = (p.selftext || p.title || "").slice(0, 2000);
    return normalize(img, prompt, p.author || "reddit", "Reddit", j, []);
  }).filter(Boolean);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function onRequest() {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*"
  };

  // 并行拉取多个外部接口（每个接口独立容错）
  const results = await Promise.allSettled([
    fetchCivitai(),
    fetchLexica(STYLE_QUERIES),
    fetchReddit()
  ]);

  let merged = [];
  results.forEach((r) => { if (r.status === "fulfilled") merged = merged.concat(r.value); });

  // 去重（按图片地址），打乱顺序，限制总量避免前端过载
  const seen = new Set();
  merged = merged.filter((s) => {
    if (seen.has(s.image)) return false;
    seen.add(s.image);
    return true;
  });
  merged = shuffle(merged).slice(0, 140);

  return new Response(JSON.stringify({ updated: Date.now(), count: merged.length, styles: merged }), { headers });
}
