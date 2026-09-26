# -*- coding: utf-8 -*-
"""
Civitai AI 画风图库抓取器
========================
思路（对齐 Shotdeck）：每个细分风格词 → 搜 Civitai 高赞风格模型 → 抓模型示例图
（示例图 = 该风格的代表作品，自带生成提示词）。图片下载为 512 宽缩略图控体积。

输出：
  assets/library/NNNN-hash.jpg   图片
  library.json                   数据（供前端 fetch）
  library-data.js                同数据内嵌版（供 file:// 双击直读）

用法：
  python fetch_civitai.py --words 6     # 试跑前 6 个词
  python fetch_civitai.py               # 全量
"""
import os, re, sys, json, time, ssl, hashlib, argparse, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_IMG = os.path.join(ROOT, "assets", "library")
os.makedirs(OUT_IMG, exist_ok=True)

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126", "Accept": "application/json"}

def get(url, t=25, binary=False):
    r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t, context=CTX)
    return r.read() if binary else json.loads(r.read())

# ============ 风格词表：英文检索词, 中文标题, 分类, 标准提示词模板 ============
# prompt 模板为本站编写（Civitai 已不公开作者参数），可直接复制到 MJ / SD 使用
WORDS = [
    ("cinematic lighting", "电影感 / 胶片大片", "影视感", "cinematic film still, dramatic lighting, shallow depth of field, film grain, anamorphic lens, 35mm, photorealistic"),
    ("film noir", "黑色电影 / 暗调", "影视感", "film noir style, high contrast black and white, dramatic shadows, venetian blind lighting, moody atmosphere, 1940s"),
    ("golden hour", "黄金时刻光", "影视感", "golden hour lighting, warm sunset glow, soft backlight, lens flare, warm color grade, cinematic"),
    ("volumetric lighting", "体积光 / 丁达尔", "影视感", "volumetric lighting, god rays, light shafts through fog, atmospheric haze, cinematic lighting, ultra detailed"),
    ("neon lighting", "霓虹光效", "影视感", "neon lighting, vibrant neon glow, colorful reflections, night scene, high contrast, cyberpunk aesthetic"),
    ("silhouette backlight", "逆光剪影", "影视感", "silhouette against bright backlight, rim light, dramatic contrast, minimalist composition, sunset background"),
    ("cyberpunk", "赛博朋克", "科幻", "cyberpunk city at night, neon signs, rain reflections, holographic ads, futuristic dystopia, cinematic, ultra detailed"),
    ("sci-fi city", "科幻都市", "科幻", "futuristic sci-fi megacity, flying vehicles, skyscrapers, holographic interface, clean design, concept art"),
    ("mecha robot", "机甲", "科幻", "giant mecha robot, detailed mechanical design, battle damage, epic scale, industrial design, anime style"),
    ("space nebula", "星际星云", "科幻", "deep space nebula, vibrant cosmic colors, stars, galaxy, epic scale, astrophotography style, ultra detailed"),
    ("steampunk", "蒸汽朋克", "科幻", "steampunk machinery, brass gears, victorian aesthetic, steam pipes, retro-futuristic, intricate details"),
    ("post apocalyptic", "末世废土", "科幻", "post apocalyptic wasteland, ruined city, overgrown vegetation, abandoned vehicles, dusty atmosphere, desaturated"),
    ("anime scenery", "动画风景", "动漫", "anime scenery, beautiful landscape, makoto shinkai style, vivid sky, detailed clouds, anime background art"),
    ("studio ghibli", "吉卜力风", "动漫", "studio ghibli style, pastoral countryside, soft watercolor palette, whimsical, hand drawn animation aesthetic"),
    ("anime portrait", "动漫人像", "动漫", "anime portrait, detailed eyes, cel shading, beautiful lighting, high quality anime illustration"),
    ("chibi cute", "Q版可爱", "动漫", "chibi character, cute, big eyes, pastel colors, kawaii style, simple background, adorable"),
    ("manga ink", "漫画黑白", "动漫", "manga style, black and white ink, screentone, dynamic linework, dramatic panel composition"),
    ("watercolor", "水彩", "绘画", "watercolor painting, soft washes, paper texture, delicate brush strokes, airy composition, artistic"),
    ("oil painting", "油画", "绘画", "oil painting, thick impasto brush strokes, classical composition, rich colors, canvas texture, masterpiece"),
    ("ink wash painting", "水墨 / 国画", "绘画", "chinese ink wash painting, sumi-e, minimalist, flowing brush strokes, negative space, misty mountains"),
    ("chinese guofeng", "国风古韵", "绘画", "chinese traditional art, guofeng, elegant, ancient architecture, hanfu, delicate details, oriental aesthetic"),
    ("ukiyo-e", "浮世绘", "绘画", "ukiyo-e woodblock print, edo period, flat colors, wave patterns, traditional japanese art, hokusai style"),
    ("art nouveau", "新艺术运动", "绘画", "art nouveau poster, mucha style, ornate floral borders, elegant curves, muted gold palette, decorative"),
    ("art deco", "装饰艺术", "绘画", "art deco design, geometric patterns, gold and black, symmetrical, 1920s gatsby luxury, elegant"),
    ("impressionist", "印象派", "绘画", "impressionist painting, monet style, loose brushwork, dappled light, plein air, soft pastel colors"),
    ("surrealism", "超现实", "绘画", "surrealism, dali inspired, dreamlike scene, impossible geometry, melting objects, imaginative, fine art"),
    ("pop art", "波普艺术", "绘画", "pop art style, andy warhol, bold primary colors, halftone dots, comic style, high contrast"),
    ("pixel art", "像素风", "设计感", "pixel art, 16-bit retro game style, crisp pixels, limited palette, isometric sprite, nostalgic"),
    ("low poly", "低多边形", "设计感", "low poly 3d render, geometric shapes, flat shading, minimalist color palette, clean design"),
    ("isometric", "等距视角", "设计感", "isometric illustration, 45 degree view, diorama, cute miniature world, clean vector style, detailed"),
    ("claymation", "黏土定格", "设计感", "claymation style, clay render, stop motion aesthetic, handmade texture, soft studio lighting, charming"),
    ("papercut layered", "剪纸层叠", "设计感", "layered paper cut art, papercraft diorama, depth of layers, soft shadows, craft aesthetic"),
    ("stained glass", "彩绘玻璃", "设计感", "stained glass window, leaded glass, vibrant translucent colors, gothic pattern, light shining through"),
    ("line art", "线稿", "设计感", "clean line art, minimal linework, single weight lines, elegant simplicity, white background, illustration"),
    ("flat illustration", "扁平插画", "设计感", "flat design illustration, simple shapes, limited color palette, modern vector art, minimal shading"),
    ("double exposure", "双重曝光", "摄影感", "double exposure, portrait blended with landscape, artistic overlay, ethereal, creative photography"),
    ("long exposure", "长曝光", "摄影感", "long exposure photography, light trails, silky water, motion blur, night scene, tripod shot"),
    ("macro photography", "微距", "摄影感", "macro photography, extreme close up, shallow depth of field, dew drops, intricate detail, bokeh"),
    ("aerial drone", "航拍", "摄影感", "aerial drone photography, top down view, geometric landscape patterns, vast scale, golden light"),
    ("street photography", "街头摄影", "摄影感", "street photography, candid moment, urban life, natural light, decisive moment, documentary style"),
    ("portrait photography", "人像摄影", "摄影感", "studio portrait photography, softbox lighting, sharp eyes, skin texture, professional headshot, bokeh background"),
    ("black and white photo", "黑白摄影", "摄影感", "black and white photography, high contrast, fine art, dramatic light, timeless composition, ansel adams style"),
    ("tilt shift", "移轴微缩", "摄影感", "tilt shift photography, miniature effect, selective focus, toy town aesthetic, aerial view"),
    ("foggy forest", "雾气森林", "自然", "misty forest, dense fog, moody atmosphere, tall trees, ethereal light, mystical woodland"),
    ("desert dunes", "沙漠戈壁", "自然", "desert sand dunes, rippled sand texture, harsh sunlight, minimalist landscape, warm tones"),
    ("ocean waves", "海浪", "自然", "dramatic ocean waves, crashing surf, spray and foam, powerful sea, dynamic motion, seascape"),
    ("starry night sky", "星空银河", "自然", "starry night sky, milky way galaxy, astrophotography, long exposure, silhouetted landscape, cosmic"),
    ("aurora borealis", "极光", "自然", "aurora borealis, northern lights, vibrant green and purple, snowy landscape, night photography"),
    ("autumn foliage", "秋色", "自然", "autumn foliage, golden leaves, warm fall colors, forest path, soft light, seasonal landscape"),
    ("snow winter", "冬日雪景", "自然", "winter snow landscape, pristine snow, blue hour, quiet atmosphere, frosty trees, serene"),
    ("tropical beach", "热带海滩", "自然", "tropical beach paradise, turquoise water, palm trees, white sand, bright sunlight, vacation vibe"),
    ("mountain sunrise", "山峦日出", "自然", "mountain peak at sunrise, alpenglow, layered ridges, dramatic sky, epic landscape, crisp air"),
    ("underwater", "水下世界", "自然", "underwater photography, sun rays through water, marine life, blue depths, ethereal, light caustics"),
    ("fantasy castle", "奇幻城堡", "奇幻", "fantasy castle, epic architecture, dramatic clouds, magical atmosphere, concept art, highly detailed"),
    ("dragon fantasy", "龙与传说", "奇幻", "epic dragon, scales detail, flying over mountains, fire breath, fantasy art, dramatic lighting"),
    ("fairy forest", "精灵森林", "奇幻", "enchanted fairy forest, glowing mushrooms, magical particles, bioluminescence, mystical atmosphere"),
    ("dark gothic", "哥特暗黑", "奇幻", "gothic architecture, dark cathedral, moody fog, candlelight, ornate details, dark fantasy"),
    ("wuxia sword", "武侠刀剑", "奇幻", "wuxia martial arts, swordsman on rooftop, flowing robes, bamboo forest, ink tinged, cinematic"),
    ("xianxia immortal", "仙侠修仙", "奇幻", "xianxia immortal cultivator, floating mountains, flowing silk, celestial palace, ethereal glow, guofeng"),
    ("vaporwave", "蒸汽波", "潮流", "vaporwave aesthetic, pink and cyan gradient, greek statue, retro computer, grid horizon, glitch"),
    ("retro 80s synthwave", "复古80年代", "潮流", "synthwave retrowave, 80s neon, sunset grid, chrome text, laser lines, nostalgic futurism"),
    ("y2k aesthetic", "Y2K 千禧", "潮流", "y2k aesthetic, metallic chrome, bubble shapes, millennium futurism, glossy plastic, iridescent"),
    ("brutalist architecture", "粗野建筑", "城市", "brutalist architecture, raw concrete, geometric mass, dramatic shadows, overcast sky, monolithic"),
    ("japanese garden", "日式庭院", "城市", "japanese zen garden, cherry blossoms, stone path, tea house, tranquil, soft morning light"),
    ("night city street", "都市夜街", "城市", "night city street, wet asphalt reflections, neon shop signs, urban solitude, cinematic street photography"),
    ("abandoned building", "废弃建筑", "城市", "abandoned building, urban decay, peeling paint, shafts of light, haunting atmosphere, lost places"),
]

NSFW_SAFE = {0, 1}  # Civitai nsfwLevel: 0/1 安全

def dl_image(url, dest):
    """下载 512 宽缩略图（Civitai CDN 支持变换参数）"""
    if "original=true" in url:
        url = url.replace("original=true", "width=512")
    try:
        blob = get(url, t=30, binary=True)
        if len(blob) < 4096:
            return False
        head = blob[:4]
        if head[:2] != b"\xff\xd8" and head[:4] != b"\x89PNG":  # 只留 jpeg/png
            return False
        ext = ".png" if head[:4] == b"\x89PNG" else ".jpg"
        dest = dest.rsplit(".", 1)[0] + ext
        with open(dest, "wb") as f:
            f.write(blob)
        return os.path.basename(dest)
    except Exception:
        return False

def clean_prompt(p):
    p = re.sub(r"[<>|\[\]{}]", " ", p or "")
    p = re.sub(r"\s+", " ", p).strip()
    # 去掉权重括号残留 (xxx:1.2)
    p = re.sub(r"\(\s*[\w\s-]+:?\s*\d*\.?\d*\s*\)", " ", p)
    return re.sub(r"\s+", " ", p).strip()[:500]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", type=int, default=len(WORDS))
    ap.add_argument("--models-per-word", type=int, default=2)
    ap.add_argument("--imgs-per-model", type=int, default=4)
    ap.add_argument("--target", type=int, default=520)
    args = ap.parse_args()

    # 已有记录（断点续抓）
    lib_path = os.path.join(ROOT, "library.json")
    styles, seen_urls = [], set()
    template_of = {zh: tpl for _, zh, _, tpl in WORDS}
    if os.path.exists(lib_path):
        try:
            old = json.load(open(lib_path, encoding="utf-8"))
            styles = old.get("styles", [])
            seen_urls = {s.get("_src") for s in styles}
            # 旧记录 prompt 为空的补上风格模板
            for s in styles:
                if not s.get("prompt") and s.get("title") in template_of:
                    s["prompt"] = template_of[s["title"]]
        except Exception:
            pass
    # 已有文件名（避免覆盖序号）
    used_idx = set()
    for s in styles:
        m = re.match(r"(\d+)-", os.path.basename(s.get("image", "")))
        if m:
            used_idx.add(int(m.group(1)))
    idx = max(used_idx) if used_idx else 0

    print(f"已有 {len(styles)} 条，目标 {args.target}，本轮处理 {args.words} 个风格词")
    t0 = time.time()

    for q, zh, cat, tpl in WORDS[:args.words]:
        if len(styles) >= args.target:
            break
        # 跳过该词已抓足量的
        have = sum(1 for s in styles if s["title"] == zh)
        if have >= args.imgs_per_model:
            print(f"[skip] {zh} 已有 {have} 张")
            continue
        try:
            api = ("https://civitai.com/api/v1/models?limit={}&query={}"
                   "&types=Checkpoint&types=LORA&sort=Highest+Rated&nsfw=false").format(
                   args.models_per_word, urllib.parse.quote(q))
            d = get(api)
            items = d.get("items", [])
        except Exception as e:
            print(f"[{zh}] 搜索失败 {repr(e)[:60]}")
            time.sleep(2)
            continue

        added = 0
        for m in items:
            if len(styles) >= args.target or added >= args.imgs_per_model * 2:
                break
            ver = (m.get("modelVersions") or [{}])[0]
            model_name = m.get("name", "")[:60]
            for im in (ver.get("images") or []):
                if added >= args.imgs_per_model or len(styles) >= args.target:
                    break
                u = im.get("url", "")
                if not u or u in seen_urls:
                    continue
                if im.get("nsfwLevel") not in NSFW_SAFE:
                    continue
                seen_urls.add(u)
                idx += 1
                fname = dl_image(u, os.path.join(OUT_IMG, f"{idx:04d}-x.jpg"))
                if not fname:
                    idx -= 1
                    continue
                styles.append({
                    "id": f"C{idx:04d}",
                    "image": f"assets/library/{fname}",
                    "title": zh,
                    "prompt": tpl,
                    "tags": [zh, cat],
                    "author": model_name,
                    "_src": u,
                })
                added += 1
        print(f"[{len(styles):>4}/{args.target}] {zh}  +{added}  ({int(time.time()-t0)}s)")
        time.sleep(0.6)

    # 保存
    data = {"updated": int(time.time() * 1000), "count": len(styles), "styles": styles}
    json.dump(data, open(lib_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "library-data.js"), "w", encoding="utf-8") as f:
        f.write("window.__LIBRARY__ = " + json.dumps(data, ensure_ascii=False) + ";\n")
    print(f"\n完成：{len(styles)} 张  library.json + library-data.js 已生成")

if __name__ == "__main__":
    main()
