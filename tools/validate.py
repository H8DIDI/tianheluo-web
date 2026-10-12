#!/usr/bin/env python3
"""天河落插件自查脚本 validate.py —— 单文件，只需要 Python 3.8+，不需要安装任何库。

用法：
    python validate.py <插件目录>        # 例如 python validate.py my-plugin
    python validate.py <插件.zip>
    python validate.py <插件目录> --offline   # 不联网检查 id 是否重复

规范见 https://tianheluo.com/ai.md 。通过只是投稿的必要条件，最终以维护者人工审核为准。
本脚本只读取文件，不会修改任何内容。
"""
import ast
import json
import os
import re
import sys
import tempfile
import zipfile

CATEGORIES = ["市政管线", "出图打印", "数据处理", "建模辅助", "视图管理", "导出", "其他"]
LICENSES = {
    "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unlicense", "CC0-1.0", "0BSD",
    "GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0-only", "GPL-3.0-or-later",
    "LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0-only", "LGPL-3.0-or-later", "MPL-2.0", "AGPL-3.0-only",
}
ALLOWED_EXT = {".py", ".json", ".md", ".txt", ".xaml", ".png", ".csv", ".xml", ".yaml", ".yml", ""}
MAX_PLUGIN = 500 * 1024
MAX_FILE = 200 * 1024
STORE_URL = "https://tianheluo.com/plugins.json"

BANNED_IMPORTS = {
    "subprocess": "执行外部程序", "socket": "网络", "urllib": "网络", "urllib2": "网络", "urllib3": "网络",
    "http": "网络", "httplib": "网络", "ftplib": "网络", "smtplib": "网络", "telnetlib": "网络",
    "requests": "网络", "ctypes": "调用原生代码", "winreg": "注册表", "_winreg": "注册表",
    "pickle": "反序列化可执行代码", "marshal": "反序列化可执行代码", "multiprocessing": "启动子进程",
    "importlib": "动态加载代码",
}
NETWORK_MODULES = {"socket", "urllib", "urllib2", "urllib3", "http", "httplib", "ftplib", "smtplib", "telnetlib", "requests"}
BANNED_CALLS = {
    "eval": "动态执行代码", "exec": "动态执行代码", "compile": "动态编译代码", "__import__": "动态加载代码",
    "os.system": "执行外部命令", "os.popen": "执行外部命令", "os.startfile": "启动外部程序",
    "os.remove": "删除文件", "os.unlink": "删除文件", "os.rmdir": "删除目录", "os.removedirs": "删除目录",
    "shutil.rmtree": "删除目录树", "shutil.move": "移动/覆盖文件",
}
# 对源码文本的模式扫描（覆盖 .NET 互操作等 AST 看不出来的写法）。(正则, 说明, 是否算“联网”)
TEXT_PATTERNS = [
    (r"System\.Diagnostics\.Process|Process\.Start", "启动外部程序", False),
    (r"\bpowershell\b|\bcmd\.exe\b|\bwscript\b|\bcscript\b|\bmshta\b", "调用系统脚本程序", False),
    (r"System\.Net\b|WebClient|HttpClient|WebRequest|Socket\b", "网络访问", True),
    (r"Assembly\.Load|LoadFrom\b|AddReferenceToFile|AddReferenceByPartialName", "加载外部程序集", False),
    (r"Marshal\.|DllImport|kernel32|user32\.dll", "调用原生代码", False),
    (r"Directory\.Delete|File\.Delete|Registry\.|RegistryKey", "删除文件或访问注册表", False),
]

SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,40}$")
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

errors, warnings = [], []


def err(msg):
    errors.append(msg)
    print("  ✗ " + msg)


def warn(msg):
    warnings.append(msg)
    print("  ! " + msg)


def ok(msg):
    print("  ✓ " + msg)


def find_root(path):
    """返回 (插件根目录, 临时目录或 None, 目录名)。"""
    if os.path.isfile(path) and path.lower().endswith(".zip"):
        tmp = tempfile.mkdtemp(prefix="thl-validate-")
        with zipfile.ZipFile(path) as z:
            base = os.path.realpath(tmp)
            for n in z.namelist():
                dest = os.path.realpath(os.path.join(tmp, n))
                if not dest.startswith(base + os.sep) and dest != base:
                    print("  ✗ zip 里含有非法路径：" + n)
                    sys.exit(1)
            z.extractall(tmp)
        entries = [e for e in os.listdir(tmp) if not e.startswith("__MACOSX")]
        if os.path.exists(os.path.join(tmp, "plugin.json")):
            return tmp, tmp, None
        if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])):
            return os.path.join(tmp, entries[0]), tmp, entries[0]
        return tmp, tmp, None
    if os.path.isdir(path):
        return path, None, os.path.basename(os.path.abspath(path))
    print("找不到：" + path)
    sys.exit(2)


def list_files(root):
    out = []
    for d, _, fs in os.walk(root):
        for f in fs:
            full = os.path.join(d, f)
            out.append((os.path.relpath(full, root).replace("\\", "/"), full))
    return out


def check_manifest(root, dirname, offline):
    print("\n[1] plugin.json")
    mf_path = os.path.join(root, "plugin.json")
    if not os.path.exists(mf_path):
        err("缺少 plugin.json（必须在插件目录/压缩包根目录）")
        return None
    try:
        with open(mf_path, encoding="utf-8-sig") as f:
            m = json.load(f)
    except Exception as e:
        err("plugin.json 不是合法的 JSON：" + str(e))
        return None
    if not isinstance(m, dict):
        err("plugin.json 顶层必须是对象")
        return None

    required = ["id", "name", "version", "description", "category", "revit", "type", "script", "author", "license"]
    miss = [k for k in required if k not in m or m[k] in ("", None)]
    if miss:
        err("缺少必填字段：" + "、".join(miss))
    pid = m.get("id", "")
    if pid:
        if not isinstance(pid, str) or not ID_RE.match(pid):
            err("id 只能用小写字母、数字、连字符，3~41 个字符，且以字母或数字开头：" + str(pid))
        else:
            ok("id = " + pid)
            if dirname and dirname != pid and not dirname.endswith(".zip"):
                warn("目录名（%s）与 id（%s）不一致，投稿时请改成一致" % (dirname, pid))
    if m.get("name") and (not isinstance(m["name"], str) or len(m["name"]) > 20):
        err("name 必须是不超过 20 个字符的字符串")
    if m.get("version") and (not isinstance(m["version"], str) or not SEMVER.match(m["version"])):
        err("version 必须是 x.y.z 形式（如 0.1.0）：" + str(m.get("version")))
    d = m.get("description")
    if d and (not isinstance(d, str) or len(d) > 400):
        err("description 必须是不超过 400 字符的字符串")
    if m.get("category") and m["category"] not in CATEGORIES:
        err("category 必须是下列之一：" + "、".join(CATEGORIES))
    if m.get("revit") and str(m["revit"]) != "2026":
        err('revit 目前只能是 "2026"')
    if m.get("type") and m["type"] != "python":
        err('社区插件 type 必须是 "python"（不接受 dll）')
    sc = m.get("script")
    if sc and (not isinstance(sc, str) or "/" in sc or "\\" in sc or ".." in sc or not sc.endswith(".py")):
        err("script 必须是插件目录下的 .py 文件名（不含路径）")
    lic = m.get("license")
    if lic and lic not in LICENSES:
        err("license 必须是常见的开源许可证 SPDX 标识，例如 MIT / Apache-2.0 / BSD-3-Clause / GPL-3.0-only；当前：" + str(lic))
    if "glyph" in m and (not isinstance(m["glyph"], str) or not 1 <= len(m["glyph"]) <= 3):
        err("glyph 必须是 1~3 个字符")
    if "color" in m and (not isinstance(m["color"], str) or not COLOR_RE.match(m["color"])):
        err("color 必须是 #RRGGBB")
    if "network" in m and not isinstance(m["network"], bool):
        err("network 必须是 true 或 false")
    if "homepage" in m and not (isinstance(m["homepage"], str) and m["homepage"].startswith(("http://", "https://"))):
        err("homepage 必须是 http(s) 链接")
    if not errors:
        ok("字段齐全，格式正确")

    if pid and not offline:
        try:
            import urllib.request
            req = urllib.request.Request(STORE_URL, headers={"User-Agent": "THL-validate/1.0"})
            store = json.load(urllib.request.urlopen(req, timeout=6))
            hit = [p for p in store.get("plugins", []) if p.get("id") == pid]
            if hit:
                warn("商店里已经有 id=%s（版本 %s）。如果是更新，请确认你的 version 更高；如果是新插件，请换一个 id" % (pid, hit[0].get("version")))
            else:
                ok("id 在官方商店中未被占用")
        except Exception:
            print("  - 无法联网检查 id 是否重复（可忽略；维护者会再核对）")
    return m


def check_files(root, m):
    print("\n[2] 文件")
    files = list_files(root)
    total = 0
    for rel, full in files:
        size = os.path.getsize(full)
        total += size
        ext = os.path.splitext(rel)[1].lower()
        if ext not in ALLOWED_EXT:
            err("不允许的文件类型 %s（社区插件只接受可审核的源码/文本/图片）：%s" % (ext or "(无扩展名)", rel))
        if size > MAX_FILE:
            err("单个文件超过 200 KB：%s（%d KB）" % (rel, size // 1024))
    if total > MAX_PLUGIN:
        err("插件总大小超过 500 KB（%d KB）" % (total // 1024))
    names = {rel.lower() for rel, _ in files}
    for need in ("license", "readme.md"):
        if not any(n == need or n.startswith(need + ".") for n in names):
            err("缺少 %s" % ("LICENSE（开源许可证文件）" if need == "license" else "README.md（说明功能、使用步骤、会修改什么）"))
    if m and m.get("script") and m["script"].lower() not in names:
        err("找不到 plugin.json 里指定的脚本：" + m["script"])
    if "icon.png" in names:
        ok("带有自定义图标 icon.png")
    if not any(e for e in errors if "文件" in e or "缺少" in e):
        ok("共 %d 个文件，合计 %d KB" % (len(files), total // 1024 + (1 if total % 1024 else 0)))
    return files


def dotted(node):
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    return ".".join(reversed(parts))


def check_python(root, files, m):
    print("\n[3] Python 源码")
    network_ok = bool(m and m.get("network") is True)
    pys = [(rel, full) for rel, full in files if rel.lower().endswith(".py")]
    if not pys:
        err("没有任何 .py 文件")
        return
    clean = True
    used_network = False
    for rel, full in pys:
        try:
            src = open(full, encoding="utf-8-sig").read()
        except UnicodeDecodeError:
            err("%s 不是 UTF-8 编码" % rel)
            continue
        try:
            tree = ast.parse(src, rel)
        except SyntaxError as e:
            err("%s 第 %s 行语法错误：%s" % (rel, e.lineno, e.msg))
            continue

        for node in ast.walk(tree):
            line = getattr(node, "lineno", "?")
            # 宿主引擎是 IronPython 3.4：不支持下面这些较新的语法
            if isinstance(node, ast.NamedExpr):
                err("%s:%s 使用了海象运算符 :=（宿主的 Python 引擎不支持）" % (rel, line)); clean = False
            if isinstance(node, (ast.AsyncFunctionDef, ast.Await, ast.AsyncFor, ast.AsyncWith)):
                err("%s:%s 使用了 async/await（宿主的 Python 引擎不支持）" % (rel, line)); clean = False
            if hasattr(ast, "Match") and isinstance(node, ast.Match):
                err("%s:%s 使用了 match/case（宿主的 Python 引擎不支持）" % (rel, line)); clean = False
            # 导入
            mods = []
            if isinstance(node, ast.Import):
                mods = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                mods = [node.module]
            for mod in mods:
                top = mod.split(".")[0]
                if top in BANNED_IMPORTS:
                    if top in NETWORK_MODULES and network_ok:
                        used_network = True
                        warn("%s:%s 导入 %s（网络），已声明 network=true，需维护者重点审核" % (rel, line, mod))
                    else:
                        err("%s:%s 禁止导入 %s（%s）%s" % (rel, line, mod, BANNED_IMPORTS[top],
                            "；确需联网请在 plugin.json 设 \"network\": true 并在 README 说明" if top in NETWORK_MODULES else ""))
                        clean = False
            # 调用
            if isinstance(node, ast.Call):
                name = dotted(node.func) if isinstance(node.func, (ast.Attribute, ast.Name)) else ""
                if name in BANNED_CALLS:
                    err("%s:%s 禁止调用 %s（%s）" % (rel, line, name, BANNED_CALLS[name])); clean = False
                if name in ("open", "io.open") and len(node.args) >= 2:
                    mode = node.args[1]
                    if isinstance(mode, ast.Constant) and isinstance(mode.value, str) and any(c in mode.value for c in "wa+x"):
                        warn("%s:%s 以写模式打开文件，请确认只写在 script.get_*_data_file() 返回的路径下，并在 README 说明" % (rel, line))

        # 文本模式（.NET 互操作等）
        for pat, why, is_net in TEXT_PATTERNS:
            for mt in re.finditer(pat, src):
                ln = src.count("\n", 0, mt.start()) + 1
                if is_net and network_ok:
                    used_network = True
                    warn("%s:%s 出现网络访问（%s），已声明 network=true，需维护者重点审核" % (rel, ln, mt.group(0)))
                else:
                    err("%s:%s 出现禁止的写法 %s（%s）" % (rel, ln, mt.group(0), why))
                    clean = False
        if "__name__" not in src:
            warn("%s 末尾建议加 if __name__ == \"__main__\": main()（宿主以 __main__ 运行脚本）" % rel)
    if network_ok and not used_network:
        warn("plugin.json 声明了 network=true，但源码里没有发现联网代码；没有联网就请去掉这个声明")
    if clean:
        ok("%d 个 Python 文件：语法可被宿主引擎接受，未发现禁止的写法" % len(pys))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offline = "--offline" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(2)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    root, tmp, dirname = find_root(args[0])
    print("天河落插件自查：" + args[0])
    m = check_manifest(root, dirname, offline)
    files = check_files(root, m)
    check_python(root, files, m)
    print("\n" + "=" * 50)
    if errors:
        print("未通过：%d 个问题需要修改，%d 个提示。" % (len(errors), len(warnings)))
        sys.exit(1)
    print("通过！%s" % ("（有 %d 个提示，请看上面标 ! 的行）" % len(warnings) if warnings else "没有发现问题。"))
    print("下一步：把插件目录压缩成 zip，发邮件到 jiajiabimer@gmail.com（详见 https://tianheluo.com/ai.md 第 8 节）。")
    print("提醒：自查通过不等于安全，最终以维护者人工审核源码为准。")


if __name__ == "__main__":
    main()
