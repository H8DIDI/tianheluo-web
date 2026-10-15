"""SEO 构建：把原来靠 JS 才能看到的内容，生成成搜索引擎直接能读的静态 HTML。只用标准库，可重复运行。
  1. plugins/<id>.html   每个插件一个独立网址 /plugins/<id>（独立标题、描述、JSON-LD、同类插件内链）
  2. 各页面的导航栏/页脚   原来由 app.js 注入，百度等爬虫看不到；现在直接写进 HTML
  3. 首页/商店的插件列表   写在 <!--seo:xxx-->…<!--/seo:xxx--> 之间；浏览器里 JS 加载后会用实时数据替换
  4. sitemap.xml          含全部页面和插件详情页，不含 .txt/.json 等非网页文件
  5. content/plugins/<id>.json  手写的插件长文案（解决什么问题/怎么用/注意事项/示意图/SEO 标题）。
     不属于插件包，改它不需要升版本；其中的 summary 会同步写回 plugins.json，让商店卡片也用上好摘要。
用法：python tools/build_seo.py        （tools/publish.py 发布时会自动调用）
"""
import datetime
import hashlib
import html
import json
import pathlib
import re

SITE = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://tianheluo.com"
TODAY = datetime.date.today().isoformat()

CONTENT_DIR = SITE / "content" / "plugins"
CONTENT = {}

STATUS = {"stable": "稳定版", "beta": "测试版", "planned": "计划中"}
CAT_COLOR = {"市政管线": "#3FA9FF", "出图打印": "#818CF8", "数据处理": "#10B981", "导出": "#F59E0B", "建模辅助": "#38BDF8", "视图管理": "#06B6D4"}
GH = ('<svg class="ghi" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>')

# 页面文件名 → 导航里高亮哪一项
ACTIVE = {"index": "", "store": "store", "install": "install", "developers": "developers", "ai": "developers", "contact": "contact", "privacy": "", "404": ""}
# 页面文件名 → 面包屑里显示的名字（首页和 404 不需要）
CRUMB = {"store": "插件商店", "install": "安装指南", "developers": "开发者", "contact": "交流群与联系", "privacy": "隐私说明"}
ASSETS = ("style.css", "fx.css", "app.js", "fx.js")   # 带版本号引用，配合 _headers 里的长缓存
LASTMOD_FILE = SITE / "tools" / "lastmod.json"        # 记录每个页面内容的哈希和最后修改日期，保证构建结果可重复


def esc(s):
    return html.escape(str(s), quote=True)


def ld(obj):
    """JSON-LD 放进 <script> 里，要避开 </script>。"""
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


def load_content():
    CONTENT.clear()
    if CONTENT_DIR.is_dir():
        for f in sorted(CONTENT_DIR.glob("*.json")):
            CONTENT[f.stem] = json.loads(f.read_text(encoding="utf-8"))


def rich(s):
    """文案里允许的简单标记：[文字](/路径) 内链、**加粗**、`代码`。其余一律转义。"""
    s = esc(s)
    s = re.sub(r"\[([^\]]+)\]\((/[^)\s]*)\)", r'<a href="\2" style="color:var(--blue)">\1</a>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", s)


def brief(s, n):
    """截成不超过 n 字的一句话：优先在句号处断，其次逗号，实在不行加省略号。"""
    s = " ".join(s.split())
    if len(s) <= n:
        return s
    cut = s[:n]
    k = max(cut.rfind(c) for c in "。！？")
    if k >= n * 0.4:
        return cut[: k + 1]
    k = max(cut.rfind(c) for c in "；;，,、")
    if k >= n * 0.4:
        return cut[:k] + "…"
    return cut + "…"


def first_line(p):
    if CONTENT.get(p["id"], {}).get("summary"):
        return CONTENT[p["id"]]["summary"]
    lines = [l.strip() for l in (p.get("description") or p.get("summary") or p["name"]).splitlines() if l.strip()]
    return lines[0] if lines else p["name"]


# ---------- 公共外壳 ----------
def nav_html(active):
    def item(href, label, key):
        return f'<a href="{href}" class="{"on" if key and key == active else ""}">{label}</a>'
    return f"""
<div class="wrap">
  <a class="brand" href="/"><img class="logo" src="/img/logo-nav.svg" width="28" height="28" alt="">天河落</a>
  <nav>
    {item("/store", "插件商店", "store")}
    {item("/install", "安装指南", "install")}
    {item("/developers", "开发者", "developers")}
    {item("/contact", "交流群", "contact")}
    {item("/#how", "工作方式", "")}
    <a class="ghlink" href="https://github.com/H8DIDI/tianheluo-core" target="_blank" rel="noopener" title="宿主与插件源码（GitHub）">{GH}GitHub</a>
  </nav>
  <span class="sp"></span>
  <button class="hud-open" type="button" data-hud aria-label="搜索插件与页面（Ctrl+K）" title="搜索插件与页面（Ctrl K）"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM11.2 11.2 14.5 14.5"/></svg><span>搜索</span><kbd>Ctrl K</kbd></button>
  <a class="btn sm pri" href="/install">下载宿主</a>
</div>"""


FOOT_HTML = f"""
<div class="wrap">
  <div><b>天河落 Tianheluo</b>面向 Revit 的插件宿主与应用商店。<br>先从 Revit 2026 开始。</div>
  <div><b>产品</b><a href="/store">插件商店</a><a href="/install">安装指南</a><a href="https://github.com/H8DIDI/tianheluo-core" target="_blank" rel="noopener">GitHub · 宿主源码</a><a href="https://github.com/H8DIDI/tianheluo-web" target="_blank" rel="noopener">GitHub · 网站源码</a></div>
  <div><b>联系与投稿</b><a href="mailto:jiajiabimer@gmail.com">jiajiabimer@gmail.com</a><a href="/contact">加微信 · 交流群</a><a href="/developers">开发者 · 提交插件</a><a href="/ai">AI 开发规范</a><a href="/privacy">隐私说明</a></div>
  <div class="wx"><b>Revit 插件交流群</b><a href="/contact"><img src="/wechat-didi-sm.png" alt="微信二维码 didi" width="104" height="104" loading="lazy"></a><span>加微信 didi，拉你进群：提建议、反馈体验、投稿插件</span></div>
  <div class="copy">© 2026 天河落 · Revit 是 Autodesk, Inc. 的商标，本站与 Autodesk 无关联。下载计数记录次数与大致地区（城市级，不保存原始 IP），详见<a href="/privacy">隐私说明</a>。</div>
</div>"""


ICON_LINKS = ('<link rel="icon" href="/favicon.ico" sizes="48x48">\n'
              '<link rel="icon" href="/favicon-production.png" type="image/png">\n'
              '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n')
ASSET_VERSIONS = {}


def asset_versions():
    """样式/脚本文件的内容哈希（先统一换行，Windows 和 CI 上算出来才一致）。"""
    ASSET_VERSIONS.clear()
    for n in ASSETS:
        data = (SITE / n).read_bytes().replace(b"\r\n", b"\n")
        ASSET_VERSIONS[n] = hashlib.sha256(data).hexdigest()[:8]


def fill_chrome(text, active):
    text = re.sub(r'(<header class="nav" id="nav">).*?(</header>)', lambda m: m.group(1) + nav_html(active) + m.group(2), text, count=1, flags=re.S)
    text = re.sub(r'(<footer id="foot">).*?(</footer>)', lambda m: m.group(1) + FOOT_HTML + m.group(2), text, count=1, flags=re.S)
    # 图标：favicon.ico + PNG + apple-touch-icon（先清掉旧的再统一放回）
    text = re.sub(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>\n?', "", text)
    text = re.sub(r'(<link rel="stylesheet" href="/style\.css)', lambda m: ICON_LINKS + m.group(1), text, count=1)
    # 样式/脚本带内容哈希：内容一变网址就变，所以可以放心长期缓存
    for n, v in ASSET_VERSIONS.items():
        text = re.sub(r'(["\'])/' + re.escape(n) + r'(\?v=[0-9a-f]+)?\1', lambda m, n=n, v=v: f'{m.group(1)}/{n}?v={v}{m.group(1)}', text)
    return text


# ---------- 插件徽标 / 卡片（与 app.js 里的 badge()/card() 保持同样的标记） ----------
def badge(p, size):
    base = p.get("color") or CAT_COLOR.get(p.get("category")) or "#3FA9FF"
    g = p.get("glyph") or re.sub(r"^(一键|清理重复|清理|强电)", "", p.get("name") or "T")[:1]
    fs = 0.3 if len(g) > 1 else 0.5
    return (f'<span class="pic" style="width:{size}px;height:{size}px;font-size:{round(size * fs)}px;'
            f'background:linear-gradient(135deg,{base},{base}99);border-color:{base}88;color:#fff;font-weight:800">{esc(g)}</span>')


def card(p):
    tags = f'<span class="tag {p["status"]}">{STATUS[p["status"]]}</span><span class="tag">{esc(p["category"])}</span>'
    if p.get("tier") == "community":
        tags += '<span class="tag community">社区</span>'
    return f"""
  <a class="pc" href="/plugins/{p["id"]}">
    <div class="top">{badge(p, 44)}
      <h3>{esc(p["name"])}<small>{esc(p["en"])}</small></h3></div>
    <p>{esc(p["summary"])}</p>
    <div class="meta">{tags}</div>
  </a>"""


def inject_lists(text, plugins):
    live = [p for p in plugins if p["status"] != "planned"]
    lists = {"featured": live, "plist": sorted(plugins, key=lambda p: p.get("date") or "", reverse=True)}

    def sub(m):
        key = m.group(1)
        rows = lists.get(key)
        if rows is None:
            return m.group(0)
        return f"<!--seo:{key}-->" + "".join(card(p) for p in rows) + f"<!--/seo:{key}-->"
    return re.sub(r"<!--seo:(\w+)-->.*?<!--/seo:\1-->", sub, text, flags=re.S)


# ---------- 插件详情页 ----------
def plugin_page(p, plugins):
    pid = p["id"]
    url = f"{BASE}/plugins/{pid}"
    lead = brief(first_line(p), 110)
    c = CONTENT.get(pid, {})
    title = c.get("seoTitle") or f'{p["name"]} — Revit {p["revit"]} 插件免费下载 | 天河落 THL'
    head = brief(first_line(p), 70)
    desc = f'{head}{"" if head[-1] in "。！？…）)" else "。"}Revit {p["revit"]} 免费开源插件，天河落一键安装。'
    ready = p["status"] != "planned" and p.get("download")
    feats = [f for f in p.get("features", []) if f and f != "详见使用指南"]

    app = {
        "@type": "SoftwareApplication", "name": p["name"], "alternateName": p["en"], "description": desc, "url": url,
        "applicationCategory": "DesignApplication", "applicationSubCategory": p["category"], "operatingSystem": "Windows",
        "softwareRequirements": f'Autodesk Revit {p["revit"]}；天河落宿主',
        "softwareVersion": p["version"], "dateModified": p.get("date") or TODAY, "inLanguage": "zh-CN",
        "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "CNY"},
        "publisher": {"@type": "Organization", "name": "天河落 Tianheluo", "url": BASE + "/"},
    }
    if p.get("license"):
        app["license"] = "https://opensource.org/license/mit" if p["license"].lower() == "mit" else p["license"]
    if p.get("source"):
        app["codeRepository"] = p["source"]
    if p.get("author"):
        app["author"] = {"@type": "Person", "name": p["author"]}
    crumbs = {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "天河落", "item": BASE + "/"},
        {"@type": "ListItem", "position": 2, "name": "插件商店", "item": BASE + "/store"},
        {"@type": "ListItem", "position": 3, "name": p["name"], "item": url}]}
    jsonld = ld({"@context": "https://schema.org", "@graph": [app, crumbs]})

    related = [q for q in plugins if q["category"] == p["category"] and q["id"] != pid and q["status"] != "planned"][:5]
    if len(related) < 3:
        related += [q for q in plugins if q["id"] != pid and q not in related and q["status"] != "planned"][: 5 - len(related)]
    related_html = "".join(f'<li><a href="/plugins/{q["id"]}" style="color:var(--blue)">{esc(q["name"])}</a>'
                           f'<span style="color:var(--dim)"> — {esc(brief(first_line(q), 40))}</span></li>' for q in related)

    btn = (f'<a class="btn pri" href="{esc(p["download"])}" download>下载插件</a>' if ready
           else f'<a class="btn" aria-disabled="true">{"开发中" if p["status"] == "planned" else "即将上架"}</a>')
    src = (f'<a class="btn" style="margin-top:10px" href="{esc(p["source"])}" target="_blank" rel="noopener">{GH} 查看源码</a>'
           '<p style="font-size:12.5px;color:var(--dim);margin:8px 0 0">源码公开（GitHub），可阅读、学习、改进。</p>') if p.get("source") else ""
    home = (f'<p style="font-size:13px;color:var(--dim);margin:-6px 0 14px">基于开源项目，<a href="{esc(p["homepage"])}" target="_blank" rel="noopener" style="color:var(--blue)">查看原项目</a>。</p>'
            if p.get("homepage") else "")
    features = f'\n      <div class="panel"><h4>功能</h4><ul>{"".join(f"<li>{esc(f)}</li>" for f in feats)}</ul></div>' if feats else ""
    community = '<span class="tag community">社区</span>' if p.get("tier") == "community" else ""

    problem = "".join(f'<p style="color:var(--mute);margin:0 0 10px">{rich(x)}</p>' for x in c.get("problem", []))
    steps = "".join(f"<li>{rich(x)}</li>" for x in c.get("steps", []))
    notes = "".join(f"<li>{rich(x)}</li>" for x in c.get("notes", []))
    img = c.get("image")
    figure = (f'<figure class="panel" style="margin:0;padding:12px"><img src="{esc(img["src"])}" alt="{esc(img["alt"])}" width="960" height="420" loading="lazy" '
              f'style="width:100%;height:auto;border-radius:10px;display:block"><figcaption style="color:var(--dim);font-size:13px;margin-top:8px">{esc(img.get("caption", ""))}</figcaption></figure>') if img else ""
    rich_panels = ""
    if problem:
        rich_panels += f'\n      <div class="panel"><h4>解决什么问题</h4>{problem}</div>'
    if figure:
        rich_panels += "\n      " + figure
    if steps:
        rich_panels += f'\n      <div class="panel"><h4>怎么用</h4><ol>{steps}</ol></div>'
    if notes:
        rich_panels += f'\n      <div class="panel"><h4>注意事项</h4><ul>{notes}</ul></div>'
    intro = "" if problem else f'\n      <div class="panel"><h4>介绍</h4><p style="color:var(--mute);white-space:pre-line">{esc(p.get("description") or p["summary"])}</p></div>'

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="天河落 Tianheluo">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#06080E">
<link rel="icon" href="/favicon-production.png">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/fx.css">
<script type="application/ld+json">{jsonld}</script>
</head>
<body>
<header class="nav" id="nav"></header>
<main class="wrap" id="detail" style="padding-bottom:40px">
  <div class="crumb"><a href="/store">插件商店</a> / {esc(p["name"])}</div>
  <div class="dh">{badge(p, 72)}
    <div><h1>{esc(p["name"])}</h1><div class="meta" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
      <span class="tag {p["status"]}">{STATUS[p["status"]]}</span><span class="tag">{esc(p["category"])}</span>{community}</div></div></div>
  <p class="lead" style="margin:10px 0 0;text-align:left;max-width:680px">{esc(lead)}</p>
  <div class="dcols">
    <div class="stack">
{intro}{rich_panels}{features}
      <div class="panel"><h4>怎么安装</h4><p style="color:var(--mute)"><b>推荐：</b>在 Revit 里打开「天河落 → 插件中心 → 商店」，找到它点「安装」，立刻能用，不用重启。<br>
        也可以先点右边「下载插件」得到 <code>.thlp</code> 文件，再在插件中心点「安装插件包…」选择它。还没装宿主？先看 <a href="/install" style="color:var(--blue)">安装指南</a>。<br>
        有新版本时，插件中心会提示「更新」，一键即可。</p></div>
      <div class="panel"><h4>同类插件</h4><ul>{related_html}</ul>
        <p style="margin-top:12px"><a href="/store" style="color:var(--blue)">查看全部 Revit 插件 →</a></p></div>
    </div>
    <div class="panel"><dl class="kv">
      <dt>版本</dt><dd>{esc(p["version"])}</dd><dt>适配</dt><dd>Revit {esc(p["revit"])}</dd>
      <dt>大小</dt><dd>{esc(p["size"])}</dd><dt>更新</dt><dd>{esc(p.get("date") or "")}</dd>
      <dt>下载</dt><dd><span data-dl="{pid}">暂无</span></dd>
      {f'<dt>原作者</dt><dd>{esc(p["author"])}</dd>' if p.get("author") else ""}
      {f'<dt>开源许可</dt><dd>{esc(p["license"])}</dd>' if p.get("license") else ""}</dl>
      {home}
      {btn}
      {src}
    </div>
  </div>
</main>
<footer id="foot"></footer>
<script src="/app.js"></script>
<script src="/fx.js"></script>
</body>
</html>
"""


# ---------- sitemap ----------
# ---------- 结构化数据（JSON-LD） ----------
def crumbs(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}


def faq_from_install(text):
    """从 install.html 的“常见问题”卡片里取问答，生成 FAQPage（页面上怎么写，结构化数据就怎么写，不会两处不一致）。"""
    part = text.split("常见问题", 1)[-1]
    qa = []
    for q, a in re.findall(r'<div class="card"><h3>(.*?)</h3><p>(.*?)</p></div>', part, flags=re.S):
        clean = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()
        qa.append({"@type": "Question", "name": clean(q), "acceptedAnswer": {"@type": "Answer", "text": clean(a)}})
    return {"@type": "FAQPage", "mainEntity": qa} if qa else None


def page_graph(stem, text, plugins, host):
    if stem == "index":
        org = {"@type": "Organization", "@id": BASE + "/#org", "name": "天河落 Tianheluo", "url": BASE + "/",
               "logo": BASE + "/favicon-production.png",
               "sameAs": ["https://github.com/H8DIDI/tianheluo-core", "https://github.com/H8DIDI/tianheluo-web"]}
        site = {"@type": "WebSite", "@id": BASE + "/#website", "name": "天河落 Tianheluo", "url": BASE + "/",
                "inLanguage": "zh-CN", "publisher": {"@id": BASE + "/#org"}}
        desc = re.search(r'<meta name="description" content="([^"]*)"', text)
        app = {"@type": "SoftwareApplication", "name": "天河落 Tianheluo (THL)", "alternateName": ["THL", "Tianheluo"],
               "applicationCategory": "DesignApplication", "operatingSystem": "Windows",
               "softwareRequirements": "Autodesk Revit 2026", "softwareVersion": host.get("version", ""),
               "dateModified": host.get("released", ""), "inLanguage": "zh-CN",
               "description": html.unescape(desc.group(1)) if desc else "", "url": BASE + "/", "image": BASE + "/og-image.png",
               "downloadUrl": BASE + "/install", "license": "https://opensource.org/license/mit", "isAccessibleForFree": True,
               "offers": {"@type": "Offer", "price": "0", "priceCurrency": "CNY"},
               "codeRepository": "https://github.com/H8DIDI/tianheluo-core", "publisher": {"@id": BASE + "/#org"}}
        app = {k: v for k, v in app.items() if v != ""}
        return [org, site, app]
    if stem == "store":
        live = [p for p in plugins if p["status"] != "planned"]
        return [crumbs([("天河落", BASE + "/"), ("插件商店", BASE + "/store")]),
                {"@type": "CollectionPage", "name": "Revit 插件商店", "url": BASE + "/store", "inLanguage": "zh-CN",
                 "mainEntity": {"@type": "ItemList", "numberOfItems": len(live), "itemListElement": [
                     {"@type": "ListItem", "position": i + 1, "url": f'{BASE}/plugins/{p["id"]}', "name": p["name"]} for i, p in enumerate(live)]}}]
    if stem in CRUMB:
        g = [crumbs([("天河落", BASE + "/"), (CRUMB[stem], f"{BASE}/{stem}")])]
        if stem == "install":
            faq = faq_from_install(text)
            if faq:
                g.append(faq)
        return g
    return None


def set_jsonld(text, graph):
    text = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', "", text, flags=re.S)
    block = f'<script type="application/ld+json">{ld({"@context": "https://schema.org", "@graph": graph})}</script>\n'
    return text.replace("</head>", block + "</head>", 1)


# ---------- 可重复的 lastmod ----------
def lastmod_for(key, final_text, state):
    """页面内容没变，日期就不变；变了才记成今天。不依赖 git 历史，所以本地和 CI 里构建结果一致。"""
    h = hashlib.sha256(final_text.replace("\r\n", "\n").encode("utf-8")).hexdigest()[:16]
    cur = state.get(key)
    if not cur or cur.get("h") != h:
        state[key] = {"h": h, "d": TODAY}
    return state[key]["d"]


def write_if_changed(path, text):
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old != text:
        path.write_text(text, encoding="utf-8", newline="\n")
        return True
    return False


def main():
    raw = (SITE / "plugins.json").read_bytes().decode("utf-8")
    catalog = json.loads(raw)
    plugins = catalog["plugins"]
    host = json.loads((SITE / "host.json").read_text(encoding="utf-8"))
    load_content()
    asset_versions()
    state = json.loads(LASTMOD_FILE.read_text(encoding="utf-8")) if LASTMOD_FILE.exists() else {}
    for p in plugins:
        assert re.fullmatch(r"[a-z0-9-]+", p["id"]), f'插件 id 只能是小写字母、数字、连字符：{p["id"]}'
    changed = []

    # 0) 手写摘要写回 plugins.json（商店卡片、热门榜、宿主里的商店都会用上；不影响插件包与哈希）
    dirty = False
    for p in plugins:
        s = CONTENT.get(p["id"], {}).get("summary")
        if s and p.get("summary") != s:
            p["summary"] = s
            dirty = True
    if dirty:
        out = json.dumps(catalog, ensure_ascii=False, indent=2)
        if "\r\n" in raw:
            out = out.replace("\n", "\r\n")
        (SITE / "plugins.json").write_bytes(out.encode("utf-8"))
        changed.append("plugins.json（摘要）")

    # 1) 插件详情页（并清掉已下架插件遗留的页面）
    pdir = SITE / "plugins"
    pdir.mkdir(exist_ok=True)
    keep = set()
    for p in plugins:
        f = pdir / f'{p["id"]}.html'
        keep.add(f.name)
        if write_if_changed(f, fill_chrome(plugin_page(p, plugins), "store")):
            changed.append(f"plugins/{f.name}")
    for old in pdir.glob("*.html"):
        if old.name not in keep:
            old.unlink()
            changed.append(f"删除 plugins/{old.name}")

    # 2) 顶层页面：导航/页脚 + 列表 + 结构化数据
    pages = []
    final = {}
    for f in sorted(SITE.glob("*.html"), key=lambda f: (f.stem != "index", f.stem)):
        stem = f.stem
        if stem not in ACTIVE:
            continue
        pages.append(f)
        new = inject_lists(fill_chrome(f.read_text(encoding="utf-8"), ACTIVE[stem]), plugins)
        graph = page_graph(stem, new, plugins, host)
        if graph:
            new = set_jsonld(new, graph)
        final[stem] = new
        if write_if_changed(f, new):
            changed.append(f.name)

    # 3) sitemap（404 页不收录）
    latest = max([p.get("date") or "" for p in plugins] + [""]) or TODAY
    urls = []
    for f in pages:
        if f.stem == "404":
            continue
        path = "/" if f.stem == "index" else f"/{f.stem}"
        last = lastmod_for(path, final[f.stem], state)
        if f.stem in ("index", "store"):
            last = max(last, latest)
        urls.append((BASE + path, last))
    urls += [(f'{BASE}/plugins/{p["id"]}', p.get("date") or TODAY) for p in plugins]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + \
         "".join(f"  <url><loc>{u}</loc><lastmod>{d}</lastmod></url>\n" for u, d in urls) + "</urlset>\n"
    if write_if_changed(SITE / "sitemap.xml", sm):
        changed.append("sitemap.xml")
    state = {k: v for k, v in state.items() if k in {u[len(BASE):] or "/" for u, _ in urls}}
    if write_if_changed(LASTMOD_FILE, json.dumps(state, ensure_ascii=False, indent=1, sort_keys=True) + "\n"):
        changed.append("tools/lastmod.json")

    print(f"SEO 构建完成：{len(plugins)} 个插件页，{len(urls)} 个网址写入 sitemap；改动 {len(changed)} 个文件")
    for c in changed:
        print("  ·", c)


if __name__ == "__main__":
    main()
