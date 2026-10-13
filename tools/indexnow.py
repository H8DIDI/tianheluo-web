"""发布后主动通知搜索引擎：这些网址有更新。只用标准库。
  python tools/indexnow.py            通知 sitemap 里的全部网址
  python tools/indexnow.py --dry-run  只显示会发什么
- IndexNow（必应、Yandex、Naver、Seznam 等共享）：密钥文件在站点根目录 <KEY>.txt，用来证明网址确实是你的。
- 百度：设置环境变量 BAIDU_PUSH_TOKEN（百度搜索资源平台 → 普通收录 → 接口调用地址里的 token）后会同时推送；没设就跳过。
- 谷歌不支持这两种方式，请在 Search Console 里提交 sitemap。
"""
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

SITE = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://tianheluo.com"
KEY = "638dd36175b0c5c3b09ebbc63d9b8abc"
UA = "THL-IndexNow/1.0 (+https://tianheluo.com)"


def urls():
    return re.findall(r"<loc>(.*?)</loc>", (SITE / "sitemap.xml").read_text(encoding="utf-8"))


def post(url, body, content_type):
    r = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": content_type, "User-Agent": UA})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:200]
    except Exception as e:
        return 0, str(e)


def main():
    dry = "--dry-run" in sys.argv
    lst = urls()
    print(f"{len(lst)} 个网址")
    payload = {"host": "tianheluo.com", "key": KEY, "keyLocation": f"{BASE}/{KEY}.txt", "urlList": lst}
    if dry:
        print(json.dumps(payload, ensure_ascii=False, indent=1))
    else:
        st, msg = post("https://api.indexnow.org/IndexNow", json.dumps(payload).encode("utf-8"), "application/json; charset=utf-8")
        print(f"IndexNow → HTTP {st} {msg}".strip())
        if st not in (200, 202):
            print("  （200/202 才算成功；403 多半是密钥文件还没上线或内容不对，422 是网址不属于该域名）")
    token = os.environ.get("BAIDU_PUSH_TOKEN")
    if token and not dry:
        st, msg = post(f"http://data.zz.baidu.com/urls?site={BASE}&token={token}", "\n".join(lst).encode("utf-8"), "text/plain")
        print(f"百度推送 → HTTP {st} {msg}")
    elif not token:
        print("百度推送：未设置 BAIDU_PUSH_TOKEN，已跳过")


if __name__ == "__main__":
    main()
