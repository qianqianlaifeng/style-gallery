# -*- coding: utf-8 -*-
"""
风格参考图库 · 批量抓取脚本
==========================
从多个公开图库接口按「细分风格词」抓取真实图片，下载到 assets/library/，
并生成 styles.json（供前端读取）。目标是 500+ 张。

数据源（按优先级，任一失败自动跳过）：
  1) Pixabay     —— 需要免费 key（放到环境变量 PIXABAY_KEY，或脚本下方 PIXABAY_KEY）
  2) Art Institute of Chicago —— 免 key，艺术画作，风格参考极佳
  3) Wikimedia Commons        —— 免 key，公共领域图片
  4) Picsum                   —— 免 key，真实摄影（兜底补量）

用法：
  python fetch_library.py                # 抓默认目标数量
  python fetch_library.py --target 600
  set PIXABAY_KEY=xxxxx && python fetch_library.py
"""
import os, sys, json, time, ssl, hashlib, argparse, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_IMG = os.path.join(ROOT, "assets", "library")
OUT_JSON = os.path.join(ROOT, "library.json")
os.makedirs(OUT_IMG, exist_ok=True)

PIXABAY_KEY = os.environ.get("PIXABAY_KEY", "").strip()

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) style-gallery/1.0"}
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# ---- 细分风格词表（中英对照：英文用于检索，中文用于展示/分类） ----
QUERIES = [
    ("cinematic film still", "电影感 / 胶片大片"), ("film noir dark", "黑色电影 / 暗调"),
    ("golden hour portrait", "黄金时刻人像"), ("studio portrait", "棚拍人像"),
    ("watercolor painting", "水彩"), ("oil painting portrait", "油画"),
    ("ink wash painting", "水墨 / 国画"), ("ukiyo-e woodblock", "浮世绘"),
    ("art nouveau poster", "新艺术运动"), ("art deco pattern", "装饰艺术"),
    ("pop art colorful", "波普艺术"), ("abstract expressionism", "抽象表现"),
    ("impressionist painting", "印象派"), ("surreal dream", "超现实 / 梦核"),
    ("minimalist composition", "极简"), ("black and white photography", "黑白摄影"),
    ("neon cyberpunk", "赛博朋克"), ("synthwave retro", "复古 / 80年代"),
    ("vaporwave aesthetic", "蒸汽波"), ("steampunk machine", "蒸汽朋克"),
    ("science fiction concept", "科幻"), ("fantasy landscape", "奇幻风景"),
    ("gothic architecture", "哥特"), ("stained glass window", "彩绘玻璃"),
    ("low poly 3d", "低多边形"), ("isometric illustration", "等距视角"),
    ("claymation sculpture", "黏土 / 定格"), ("paper cut art", "纸艺 / 剪纸"),
    ("stained glass pattern", "彩绘玻璃图案"), ("line art drawing", "线稿"),
    ("comic book style", "美漫"), ("pixel art game", "像素风"),
    ("concept art environment", "概念设定 / 场景"), ("matte painting", "数字绘景"),
    ("macro nature photography", "微距自然"), ("aerial landscape", "航拍风景"),
    ("architecture modern", "现代建筑"), ("street photography", "街头摄影"),
    ("double exposure", "双重曝光"), ("light painting long exposure", "光绘 / 长曝"),
    ("macro flower", "微距花卉"), ("foggy forest moody", "雾气森林"),
    ("desert dunes", "沙漠"), ("ocean waves dramatic", "海浪"),
    ("starry night sky", "星空"), ("northern lights", "极光"),
    ("autumn forest", "秋日森林"), ("snow winter landscape", "冬日雪景"),
    ("tropical beach", "热带海滩"), ("mountain peak sunrise", "山峰日出"),
    ("chinese traditional art", "中式传统"), ("japanese garden", "日式庭院"),
    ("bauhaus design", "包豪斯"), ("brutalist architecture", "粗野主义"),
    ("neon sign night", "霓虹招牌"), ("reflection water", "水面倒影"),
    ("smoke abstract", "烟雾抽象"), ("texture grunge", "做旧质感"),
    ("geometric pattern", "几何图案"), ("gradient color abstract", "渐变抽象"),
    ("vintage film photo", "复古胶片"), ("polaroid style", "宝丽来"),
    ("tilt shift miniature", "移轴微缩"), ("infrared photography", "红外摄影"),
]

def fetch(url, timeout=30, data=None, method="GET"):
    req = urllib.request.Request(url, data=data, headers=UA, method=method)
    return urllib.request.urlopen(req, timeout=timeout, context=CTX)

def download(img_url, dest):
    """下载图片到 dest，成功返回 True。"""
    if os.path.exists(dest) and os.path.getsize(dest) > 4096:
        return True
    try:
        r = fetch(img_url, timeout=45)
        blob = r.read()
        if len(blob) < 4096:
            return False
        with open(dest, "wb") as f:
            f.write(blob)
        return True
    except Exception:
        return False

def src_pixabay(query, page=1, per=20):
    if not PIXABAY_KEY:
        return []
    url = ("https://pixabay.com/api/?key=%s&q=%s&image_type=photo&orientation=all"
           "&safesearch=true&per_page=%d&page=%d" % (PIXABAY_KEY, urllib.parse.quote(query), per, page))
    out = []
    try:
        d = json.loads(fetch(url).read())
        for h in d.get("hits", []):
            out.append((h.get("largeImageURL") or h.get("webformatURL"), h.get("tags", "")))
    except Exception as e:
        print("   [pixabay] fail:", repr(e)[:80])
    return out

def src_artic(query, page=1, per=20):
    url = ("https://api.artic.edu/api/v1/artworks/search?q=%s&limit=%d&page=%d"
           "&fields=id,title,image_id,artist_display" % (urllib.parse.quote(query), per, page))
    out = []
    try:
        d = json.loads(fetch(url).read())
        for it in d.get("data", []):
            iid = it.get("image_id")
            if iid:
                out.append(("https://www.artic.edu/iiif/2/%s/full/843,/0/default.jpg" % iid, it.get("title", "")))
    except Exception as e:
        print("   [artic] fail:", repr(e)[:80])
    return out

def src_wikimedia(query, page=1, per=20):
    offset = (page - 1) * per
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json"
           "&generator=search&gsrsearch=%s&gsrlimit=%d&gsroffset=%d"
           "&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=1000"
           % (urllib.parse.quote(query), per, offset))
    out = []
    try:
        d = json.loads(fetch(url).read())
        pages = (d.get("query") or {}).get("pages") or {}
        for _, p in pages.items():
            ii = (p.get("imageinfo") or [{}])[0]
            u = ii.get("thumburl") or ii.get("url")
            if u and u.lower().split("?")[0].endswith((".jpg", ".jpeg", ".png")):
                out.append((u, p.get("title", "")))
    except Exception as e:
        print("   [wikimedia] fail:", repr(e)[:80])
    return out

def src_picsum(page=1, per=30):
    """Picsum 免key真实摄影，仅作兜底补量（无风格关键词，按页取）。"""
    url = "https://picsum.photos/v2/list?page=%d&limit=%d" % (page, per)
    out = []
    try:
        d = json.loads(fetch(url).read())
        for it in d:
            out.append(("https://picsum.photos/id/%s/1000/1000" % it["id"], "photo"))
    except Exception as e:
        print("   [picsum] fail:", repr(e)[:80])
    return out

def infer_cat(zh):
    for kw, cat in [("摄影", "摄影"), ("人像", "摄影"), ("风景", "摄影"), ("微距", "摄影"),
                    ("建筑", "建筑"), ("抽象", "抽象"), ("几何", "抽象"), ("烟雾", "抽象"),
                    ("质感", "抽象"), ("渐变", "抽象"), ("霓虹", "城市"), ("街", "城市"),
                    ("科幻", "科幻"), ("赛博", "科幻"), ("蒸汽", "科幻"), ("星", "自然"),
                    ("森林", "自然"), ("海", "自然"), ("山", "自然"), ("雪", "自然"),
                    ("沙漠", "自然"), ("极光", "自然"), ("秋", "自然"), ("花", "自然")]:
        if kw in zh:
            return cat
    return "艺术"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=560, help="目标图片总数")
    ap.add_argument("--per-query", type=int, default=10, help="每个风格词抓多少张")
    args = ap.parse_args()

    styles = []
    seen_hash = set()
    print("Pixabay key:", "已配置" if PIXABAY_KEY else "未配置（将只用免key源）")

    # 记录已有文件，避免重复下载
    existing = set(os.listdir(OUT_IMG))

    idx = 0
    for q, zh in QUERIES:
        if len(styles) >= args.target:
            break
        print(f"[{len(styles):>4}/{args.target}] 抓取风格：{zh}  ({q})")
        got = []
        got += src_pixabay(q, 1, args.per_query)
        got += src_artic(q, 1, 6)
        got += src_wikimedia(q, 1, 6)
        got += src_picsum(len(styles) // 30 + 1, 6)

        for img_url, raw_title in got:
            if len(styles) >= args.target:
                break
            if not img_url:
                continue
            ext = ".jpg"
            low = img_url.lower().split("?")[0]
            if low.endswith(".png"):
                ext = ".png"
            h = hashlib.md5(img_url.encode()).hexdigest()[:10]
            if h in seen_hash:
                continue
            seen_hash.add(h)
            idx += 1
            fname = f"{idx:04d}-{h}{ext}"
            dest = os.path.join(OUT_IMG, fname)
            if not download(img_url, dest):
                idx -= 1
                continue
            cat = infer_cat(zh)
            styles.append({
                "id": f"L{idx:04d}",
                "image": f"assets/library/{fname}",
                "title": zh,
                "prompt": raw_title or "",
                "tags": [zh, cat],
                "author": "图库",
            })
        time.sleep(0.25)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump({"updated": int(time.time() * 1000), "count": len(styles), "styles": styles}, f, ensure_ascii=False, indent=1)
    print(f"\n完成：共 {len(styles)} 张 -> {OUT_JSON}")
    print(f"图片目录：{OUT_IMG}")

if __name__ == "__main__":
    main()
