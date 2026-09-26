/* ============================================================
 * 画风参考库 - 数据文件
 * 想加画风 / 换图片 / 改标签，只改这个文件即可，不用动其它代码。
 * 图片放在 assets/styles/ 下，image 字段填相对路径。
 * ============================================================ */

// 分类法：视频类型 + 场景氛围（用于筛选与反向推荐）
const TAXONOMY = {
  videoTypes: [
    { id: "product", label: "产品展示" },
    { id: "mv",      label: "音乐MV" },
    { id: "story",   label: "故事短片" },
    { id: "scenery", label: "风景空镜" },
    { id: "vlog",    label: "人物Vlog" },
    { id: "ad",      label: "广告宣传" },
    { id: "edu",     label: "知识科普" },
    { id: "game",    label: "游戏CG" }
  ],
  scenes: [
    { id: "scifi",   label: "科幻未来" },
    { id: "ancient", label: "古风历史" },
    { id: "urban",   label: "都市现代" },
    { id: "nature",  label: "自然治愈" },
    { id: "fantasy", label: "梦幻奇幻" },
    { id: "dark",    label: "暗黑悬疑" },
    { id: "cyber",   label: "赛博朋克" },
    { id: "warm",    label: "温馨日常" }
  ]
};

// 12 种画风
const STYLE_DATA = [
  {
    id: "cinematic",
    name: "写实电影感",
    en: "Cinematic Realistic",
    image: "assets/styles/01-cinematic.png",
    summary: "真实摄影质感，电影级光影与浅景深，氛围感强。",
    visualTags: ["真实感", "电影光影", "浅景深", "胶片颗粒"],
    videoTypes: ["product", "ad", "story", "scenery"],
    scenes: ["urban", "nature", "warm", "dark"],
    goodFor: "追求真实质感的产品广告、品牌故事、风景空镜、人物情绪短片。",
    avoidFor: "二次元/卡通角色、强风格化动画。",
    promptCn: "写实电影感，黄金时刻自然光，浅景深，35mm 电影镜头，细腻颗粒，电影级调色，超高细节",
    promptEn: "photorealistic cinematic, golden hour natural light, shallow depth of field, 35mm anamorphic lens, fine film grain, cinematic color grading, ultra detailed"
  },
  {
    id: "anime",
    name: "动漫二次元",
    en: "Anime 2D",
    image: "assets/styles/02-anime.png",
    summary: "日系动画质感，色彩鲜艳，干净赛璐璐上色，角色生动。",
    visualTags: ["二次元", "鲜艳色彩", "赛璐璐", "干净线条"],
    videoTypes: ["mv", "story", "game"],
    scenes: ["fantasy", "warm", "urban"],
    goodFor: "动漫 MV、虚拟角色短片、游戏宣传、青春治愈向内容。",
    avoidFor: "写实产品展示、严肃纪录片。",
    promptCn: "动漫风格，鲜艳饱和色彩，干净赛璐璐上色，日系动画质感，清晰线条，角色生动，细节背景",
    promptEn: "anime style, vibrant saturated colors, clean cel shading, Japanese animation aesthetic, sharp lines, lively character, detailed background"
  },
  {
    id: "cyberpunk",
    name: "赛博朋克",
    en: "Cyberpunk",
    image: "assets/styles/03-cyberpunk.png",
    summary: "霓虹高反差，雨夜都市，未来科技密度感。",
    visualTags: ["霓虹", "高反差", "暗调", "未来感"],
    videoTypes: ["game", "ad", "product"],
    scenes: ["cyber", "scifi", "dark"],
    goodFor: "科技产品发布、游戏 CG、未来城市宣传、暗黑悬疑短片。",
    avoidFor: "温馨日常、古风、自然治愈。",
    promptCn: "赛博朋克，霓虹灯光，雨夜都市，高楼林立，高反差，未来科技感，电影级细节",
    promptEn: "cyberpunk, neon lights, rainy night city, towering skyscrapers, high contrast, futuristic, highly detailed"
  },
  {
    id: "watercolor",
    name: "水彩手绘",
    en: "Watercolor",
    image: "assets/styles/04-watercolor.png",
    summary: "柔和透明笔触，淡彩色调，轻盈治愈。",
    visualTags: ["柔和", "淡彩", "手绘", "纸纹"],
    videoTypes: ["mv", "scenery", "edu"],
    scenes: ["nature", "fantasy", "warm"],
    goodFor: "音乐 MV、风景空镜、知识科普动画、治愈系内容。",
    avoidFor: "硬核科技、暗黑悬疑。",
    promptCn: "水彩手绘，柔和淡彩色调，流动透明笔触，自然森林河流，纸纹质感，轻盈梦幻",
    promptEn: "soft watercolor painting, pastel tones, flowing translucent brush strokes, quiet forest and river, paper texture, dreamy"
  },
  {
    id: "oilpainting",
    name: "油画风",
    en: "Oil Painting",
    image: "assets/styles/05-oilpainting.png",
    summary: "厚重笔触与肌理，浓郁暖调，古典厚重。",
    visualTags: ["厚重笔触", "肌理", "暖调", "古典"],
    videoTypes: ["story", "ad", "edu"],
    scenes: ["ancient", "warm", "nature"],
    goodFor: "历史故事短片、品牌广告、艺术/历史类知识科普、质感宣传。",
    avoidFor: "极简现代、赛博、像素。",
    promptCn: "古典油画，厚重 impasto 笔触，浓郁暖色调，伦勃朗式光影，画布肌理，博物馆级质感",
    promptEn: "classical oil painting, thick impasto brushwork, rich warm tones, chiaroscuro lighting, textured canvas, museum quality"
  },
  {
    id: "pixel",
    name: "像素风",
    en: "Pixel Art",
    image: "assets/styles/06-pixel.png",
    summary: "8-bit 复古游戏像素，限制色板，怀旧。",
    visualTags: ["8-bit", "复古", "像素", "限制色"],
    videoTypes: ["game", "mv", "edu"],
    scenes: ["cyber", "fantasy", "urban"],
    goodFor: "游戏 CG、复古 MV、游戏/科技向知识科普、怀旧内容。",
    avoidFor: "写实产品、电影质感。",
    promptCn: "8-bit 像素艺术，复古游戏质感，方块像素角色，幻想 RPG 村庄，限制色板，怀旧",
    promptEn: "8-bit pixel art, retro game aesthetic, blocky pixelated characters, fantasy RPG village, limited palette, nostalgic"
  },
  {
    id: "render3d",
    name: "3D渲染",
    en: "3D Render",
    image: "assets/styles/07-render3d.png",
    summary: "三维渲染，柔和棚光，干净现代，质感顺滑。",
    visualTags: ["3D", "柔和棚光", "现代", "顺滑质感"],
    videoTypes: ["product", "ad", "game"],
    scenes: ["urban", "scifi", "warm"],
    goodFor: "产品展示（科技/消费品）、广告、游戏 CG、现代品牌。",
    avoidFor: "手绘/油画/水彩等艺术笔触类。",
    promptCn: "3D 渲染，Blender 风格，柔和棚光，平滑次表面散射，干净现代背景，八猴渲染，高细节",
    promptEn: "3D rendered, Blender style, soft studio lighting, smooth subsurface scattering, clean modern background, octane render, high detail"
  },
  {
    id: "guofeng",
    name: "国风古韵",
    en: "Chinese Traditional",
    image: "assets/styles/08-guofeng.png",
    summary: "中国传统水墨/工笔，意境留白，雅致。",
    visualTags: ["水墨", "工笔", "留白", "雅致"],
    videoTypes: ["mv", "story", "ad"],
    scenes: ["ancient", "nature", "fantasy"],
    goodFor: "国风 MV、古风故事短片、文化宣传、文旅广告。",
    avoidFor: "赛博朋克、极简现代、像素。",
    promptCn: "中国传统水墨与工笔，雅致远山楼阁，云雾留白，朱红印章，诗意氛围，古典",
    promptEn: "traditional Chinese painting, elegant misty mountains and pavilions, ink-wash and gongbi style, red seal, poetic atmosphere, classical"
  },
  {
    id: "vaporwave",
    name: "蒸汽波",
    en: "Vaporwave",
    image: "assets/styles/09-vaporwave.png",
    summary: "粉青渐变，80年代网格，故障艺术，梦幻超现实。",
    visualTags: ["粉青渐变", "复古网格", "故障", "超现实"],
    videoTypes: ["mv", "ad", "game"],
    scenes: ["cyber", "fantasy", "scifi"],
    goodFor: "潮流 MV、品牌广告、游戏 CG、复古未来主题。",
    avoidFor: "写实、古风、自然治愈。",
    promptCn: "蒸汽波美学，粉青渐变天空，80年代复古网格，希腊雕像，棕榈树，故障艺术，霓虹日落",
    promptEn: "vaporwave aesthetic, pink and cyan gradient, retro 80s grid, greek statue, palm trees, glitch art, neon sunset"
  },
  {
    id: "filmretro",
    name: "胶片复古",
    en: "Vintage Film",
    image: "assets/styles/10-filmretro.png",
    summary: "35mm 胶片质感，褪色暖调，漏光颗粒，怀旧。",
    visualTags: ["35mm", "褪色暖调", "漏光", "颗粒"],
    videoTypes: ["vlog", "story", "ad"],
    scenes: ["urban", "warm", "ancient"],
    goodFor: "人物 Vlog、怀旧故事短片、复古品牌广告、生活记录。",
    avoidFor: "高对比赛博、极简现代。",
    promptCn: "复古 35mm 胶片照片，褪色暖色调，漏光，明显颗粒，70年代街头，模拟胶片质感",
    promptEn: "vintage 35mm film photograph, faded warm tones, light leaks, visible grain, 1970s street, analog film"
  },
  {
    id: "dreamy",
    name: "梦幻唯美",
    en: "Dreamy Ethereal",
    image: "assets/styles/11-dreamy.png",
    summary: "柔焦光斑，发光逆光，花瓣漂浮，仙气。",
    visualTags: ["柔焦", "光斑", "逆光", "仙气"],
    videoTypes: ["mv", "scenery", "vlog"],
    scenes: ["fantasy", "nature", "warm"],
    goodFor: "音乐 MV、风景空镜、人物 Vlog、婚纱/情感向。",
    avoidFor: "硬核科技、暗黑悬疑、像素。",
    promptCn: "梦幻唯美，柔焦光斑，发光逆光，漂浮花瓣，粉彩虹色，魔法童话氛围",
    promptEn: "ethereal dreamy, soft bokeh, glowing backlight, floating petals, pastel iridescent, magical fairy-tale atmosphere"
  },
  {
    id: "flat",
    name: "极简扁平",
    en: "Flat Minimal",
    image: "assets/styles/12-flat.png",
    summary: "扁平矢量，几何色块，大胆纯色，留白。",
    visualTags: ["扁平", "几何", "纯色", "留白"],
    videoTypes: ["edu", "product", "ad"],
    scenes: ["urban", "warm", "nature"],
    goodFor: "知识科普动画、产品图解、现代品牌广告、信息图风格。",
    avoidFor: "写实、油画、厚重笔触。",
    promptCn: "极简扁平矢量插画，简单几何形状，大胆纯色，干净构图，大量留白，现代扁平设计",
    promptEn: "flat minimal vector illustration, simple geometric shapes, bold solid colors, clean composition, ample negative space"
  }
];
