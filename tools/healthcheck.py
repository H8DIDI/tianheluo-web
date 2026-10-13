"""线上健康检查：网站是不是还好好的。只用标准库。
  python tools/healthcheck.py            全套检查（会下载宿主安装包做 SHA256 核对，约 15 MB）
  python tools/healthcheck.py --quick    跳过大文件，只做 HEAD 检查
  python tools/healthcheck.py --base http://localhost:8123   检查别的地址（部分项目只对线上有意义，会自动跳过）
有任何一项失败就以退出码 1 结束；GitHub Actions（.github/workflows/health.yml）每天跑一次，失败会给仓库所有者发邮件。

检查内容：
  1. sitemap 里每个网址：200、有标题/描述/canonical（指向自己）/唯一 h1、没有 noindex、样式带版本号、JSON-LD 合法
  2. 不存在的网址返回真 404（不是首页+200）；旧网址 301；www 和 http 都跳到 https://tianheluo.com
  3. 商店清单里每个插件包：能下载且 SHA256 与清单一致；宿主安装包同理；下载入口 HEAD 可用；/api/stats 返回 JSON
  4. robots.txt、security.txt（有效期还剩多久）、HTTPS 证书剩余天数
"""
import argparse
import hashlib
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

UA = "Mozilla/5.0 (compatible; THL-HealthCheck/1.0; +https://tianheluo.com)"
DEFAULT_BASE = "https://tianheluo.com"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)
fails, warns = [], []


def req(url, method="GET", timeout=40):
    """返回 (状态码, 响应头, 正文字节)；不自动跟随跳转，出错的状态码也照常返回。"""
    r = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with OPENER.open(r, timeout=timeout) as resp:
                return resp.status, resp.headers, (resp.read() if method != "HEAD" else b"")
        except urllib.error.HTTPError as e:
            return e.code, e.headers, (e.read() if method != "HEAD" else b"")
        except Exception as e:  # 网络抖动：重试两次
            if attempt == 2:
                return 0, {}, str(e).encode()
            time.sleep(3)


def ok(msg):
    print("  ✓", msg)


def bad(msg):
    fails.append(msg)
    print("  ✗", msg)


def warn(msg):
    warns.append(msg)
    print("  !", msg)


def check_pages(base):
    print("== 1/4 页面")
    st, _, body = req(base + "/sitemap.xml")
    if st != 200:
        return bad(f"sitemap.xml 状态 {st}")
    urls = re.findall(r"<loc>(.*?)</loc>", body.decode("utf-8"))
    if len(urls) < 10:
        bad(f"sitemap 里只有 {len(urls)} 个网址，太少了")
    for u in urls:
        u = u.replace(DEFAULT_BASE, base)
        st, h, b = req(u)
        t = b.decode("utf-8", "replace")
        problems = []
        if st != 200:
            problems.append(f"状态 {st}")
        else:
            if not re.search(r"<title>[^<]{4,}</title>", t):
                problems.append("没有标题")
            if 'name="description"' not in t:
                problems.append("没有 description")
            canon = re.search(r'rel="canonical" href="([^"]+)"', t)
            if not canon or canon.group(1).rstrip("/") != u.replace(base, DEFAULT_BASE).rstrip("/"):
                problems.append(f"canonical 不对：{canon.group(1) if canon else '缺失'}")
            if len(re.findall(r"<h1[ >]", t)) != 1:
                problems.append(f"h1 数量 {len(re.findall(r'<h1[ >]', t))}（应为 1）")
            if re.search(r'name="robots" content="[^"]*noindex', t):
                problems.append("被设成了 noindex")
            if not re.search(r'href="/style\.css\?v=[0-9a-f]{8}"', t):
                problems.append("样式没带版本号（运行 python tools/build_seo.py）")
            for blk in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
                try:
                    json.loads(blk)
                except ValueError:
                    problems.append("JSON-LD 不是合法 JSON")
        (bad if problems else ok)(f"{u.replace(base, '') or '/'}  " + ("；".join(problems) if problems else "正常"))


def check_routes(base):
    print("== 2/4 跳转与 404")
    st, _, _ = req(base + "/this-page-does-not-exist-xyz")
    (ok if st == 404 else bad)(f"不存在的网址返回 {st}（应为 404）")
    if base != DEFAULT_BASE:
        return print("  （本地地址：跳过 301 / www / http 检查）")
    for src, dst in (("/plugin?id=well-depth", "/plugins/well-depth"), ("/download", "/install")):
        st, h, _ = req(base + src)
        (ok if st == 301 and h.get("Location", "").endswith(dst) else bad)(f"{src} → {st} {h.get('Location', '')}（应 301 到 {dst}）")
    for src in ("https://www.tianheluo.com/store", "http://www.tianheluo.com/store", "http://tianheluo.com/store"):
        st, h, _ = req(src)
        loc = h.get("Location", "")
        (ok if st in (301, 308) and loc == "https://tianheluo.com/store" else bad)(f"{src} → {st} {loc}（应跳到 https://tianheluo.com/store）")


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def check_files(base, quick):
    print("== 3/4 下载文件与接口")
    st, _, b = req(base + "/plugins.json")
    if st != 200:
        return bad(f"plugins.json 状态 {st}")
    plugins = json.loads(b)["plugins"]
    for p in plugins:
        st, _, data = req(base + p["file"])
        good = st == 200 and sha256(data) == p["sha256"]
        (ok if good else bad)(f'{p["id"]} {p["version"]}：' + ("包可下载且 SHA256 一致" if good else f"状态 {st}，SHA256 与清单不一致"))
        st, _, _ = req(base + p["download"], "HEAD")
        if st != 200:
            bad(f'{p["id"]} 下载入口 {p["download"]} HEAD 状态 {st}')
    st, _, b = req(base + "/host.json")
    if st != 200:
        return bad(f"host.json 状态 {st}")
    host = json.loads(b)
    for name, a in host["assets"].items():
        if quick:
            st, _, _ = req(base + a["file"], "HEAD")
            (ok if st == 200 else bad)(f"宿主 {name} {host['version']}：HEAD {st}")
        else:
            st, _, data = req(base + a["file"], timeout=120)
            good = st == 200 and sha256(data) == a["sha256"] and len(data) == a["size"]
            (ok if good else bad)(f"宿主 {name} {host['version']}：" + ("SHA256 与大小一致" if good else f"状态 {st}，校验不一致"))
    st, _, _ = req(base + host["installer"]["file"], "HEAD")
    (ok if st == 200 else bad)(f"宿主安装包 HEAD {st}")
    st, _, b = req(base + "/api/stats")
    try:
        good = st == 200 and "plugins" in json.loads(b)
    except ValueError:
        good = False
    (ok if good else bad)(f"/api/stats {'正常' if good else f'异常（状态 {st}）'}")


def check_misc(base):
    print("== 4/4 robots / security.txt / 证书")
    st, _, b = req(base + "/robots.txt")
    (ok if st == 200 and b"Sitemap:" in b else bad)("robots.txt 可访问且声明了 Sitemap")
    st, _, b = req(base + "/.well-known/security.txt")
    m = re.search(rb"Expires:\s*(\S+)", b)
    if st != 200 or not m:
        bad("security.txt 缺失或没有 Expires")
    else:
        exp = datetime.fromisoformat(m.group(1).decode().replace("Z", "+00:00"))
        days = (exp - datetime.now(timezone.utc)).days
        (warn if days < 45 else ok)(f"security.txt 还有 {days} 天到期" + ("，请续期（改 Expires 一行）" if days < 45 else ""))
        if days < 0:
            bad("security.txt 已过期")
    if base == DEFAULT_BASE:
        host = "tianheluo.com"
        try:
            with socket.create_connection((host, 443), timeout=15) as s, ssl.create_default_context().wrap_socket(s, server_hostname=host) as t:
                days = int((ssl.cert_time_to_seconds(t.getpeercert()["notAfter"]) - time.time()) // 86400)
            (ok if days >= 14 else bad)(f"HTTPS 证书还有 {days} 天到期")
        except Exception as e:
            bad(f"证书检查失败：{e}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--quick", action="store_true", help="不下载大文件")
    a = ap.parse_args()
    base = a.base.rstrip("/")
    check_pages(base)
    check_routes(base)
    check_files(base, a.quick)
    check_misc(base)
    print(f"\n结果：{len(fails)} 项失败，{len(warns)} 项提醒")
    for f in fails:
        print("  ✗", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
