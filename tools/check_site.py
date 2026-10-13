"""仓库静态检查（CI 里每次提交都会跑，本地也可以：python tools/check_site.py）。只用标准库。
  - 所有 JSON（plugins.json、host.json、content/、schema/）都能解析
  - content/plugins/<id>.json 对应的插件存在、引用的图片文件存在
  - 页面里所有站内链接（href/src 以 / 开头）都能落到真实文件、跳转规则或函数上
  - 每个页面都有标题、描述、canonical，并且引用的样式/脚本带版本号
  - sitemap.xml 覆盖了全部页面
"""
import json
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent
errors = []


def err(msg):
    errors.append(msg)
    print("✗", msg)


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        err(f"{path.relative_to(SITE)} 不是合法 JSON：{e}")


def redirect_sources():
    out = []
    for line in (SITE / "_redirects").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(line.split()[0])
    return out


def route_exists(path, redirects, plugin_ids):
    path = path.split("#")[0].split("?")[0]
    if path in ("", "/"):
        return True
    p = path.rstrip("/")
    if (SITE / p.lstrip("/")).is_file() or (SITE / (p.lstrip("/") + ".html")).is_file():
        return True
    if p.startswith("/api/") or p == "/plugin":  # Pages Functions
        fn = SITE / "functions" / (p.lstrip("/") + ".js")
        return fn.exists() or (SITE / "functions" / "api" / "dl" / "[id].js").exists() or p == "/api/stats"
    for src in redirects:
        if src == path or src == p or (src.endswith("/*") and p.startswith(src[:-2])):
            return True
    return False


def main():
    for f in [SITE / "plugins.json", SITE / "host.json", *sorted((SITE / "content" / "plugins").glob("*.json")), *sorted((SITE / "schema").glob("*.json"))]:
        load(f)
    catalog = load(SITE / "plugins.json") or {"plugins": []}
    ids = {p["id"] for p in catalog["plugins"]}
    for f in sorted((SITE / "content" / "plugins").glob("*.json")):
        c = load(f) or {}
        if f.stem not in ids:
            err(f"content/plugins/{f.name}：商店里没有 id 为 {f.stem} 的插件")
        img = c.get("image")
        if img and not (SITE / img["src"].lstrip("/")).is_file():
            err(f"content/plugins/{f.name}：图片 {img['src']} 不存在")
        for k in ("summary", "problem", "steps", "notes"):
            if not c.get(k):
                err(f"content/plugins/{f.name}：缺少 {k}")

    redirects = redirect_sources()
    pages = sorted(SITE.glob("*.html")) + sorted((SITE / "plugins").glob("*.html"))
    for f in pages:
        rel = f.relative_to(SITE)
        t = f.read_text(encoding="utf-8")
        if rel.name != "404.html":
            for need, label in (("<title>", "标题"), ('name="description"', "description"), ('rel="canonical"', "canonical")):
                if need not in t:
                    err(f"{rel}：缺少{label}")
        if not re.search(r'href="/style\.css\?v=[0-9a-f]{8}"', t):
            err(f"{rel}：样式没带版本号，请运行 python tools/build_seo.py")
        for m in re.finditer(r'(?:href|src)="(/[^"]*)"', t):
            target = m.group(1)
            if target.startswith("//") or not route_exists(re.sub(r"\?v=[0-9a-f]+$", "", target), redirects, ids):
                err(f"{rel}：站内链接 {target} 找不到对应的文件或路由")

    sm = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    for f in SITE.glob("*.html"):
        if f.stem in ("404",):
            continue
        loc = "https://tianheluo.com/" if f.stem == "index" else f"https://tianheluo.com/{f.stem}"
        if f"<loc>{loc}</loc>" not in sm:
            err(f"sitemap.xml 里缺少 {loc}")
    for pid in ids:
        if f"/plugins/{pid}</loc>" not in sm:
            err(f"sitemap.xml 里缺少插件页 /plugins/{pid}")

    print(f"\n检查完成：{len(pages)} 个页面，{len(errors)} 个问题")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
