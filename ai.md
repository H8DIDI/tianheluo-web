# 天河落 THL —— Revit 插件开发说明书（专门给 AI 阅读）

> 版本 1.1（2026-10）· 官网 https://tianheluo.com · 投稿与联系邮箱 jiajiabimer@gmail.com
> 宿主与工具源码（公开，MIT）：https://github.com/H8DIDI/tianheluo-core · 网站源码：https://github.com/H8DIDI/tianheluo-web
> 本说明书是**自包含**的：规则、接口、完整示例代码都在里面，不需要访问任何链接。

## 0. 先读这个（30 秒版）

**你要做什么**：用户想为「天河落」平台开发一个 Revit 2026 插件。你要写出一个**文件夹**，里面是 4 个文件：`plugin.json`、`script.py`、`README.md`、`LICENSE`。用户把它压缩成 zip 发给平台维护者，审核后上架。

**插件长什么样**：一个 Python 脚本（运行在 Revit 里，用 Revit API 读写模型），点一下按钮就运行一次。不需要安装任何东西，也不需要编译。

**你必须遵守的 8 条硬规则**（后面有详细说明）：
1. 语言是 **Python（IronPython 3.4）**，不是 CPython：没有 numpy/pandas；**不能用 `:=`、`async/await`、`match`**；f-string 可以用。
2. 脚本结构固定：`main()` 函数 + 末尾 `if __name__ == "__main__": main()`。
3. 只能用说明书「第 4 节」列出的接口：`from pyrevit import revit, DB, UI, forms, script`。**不要使用没列出的 pyRevit 功能**（比如 `script.get_output()`、`script.exit()`）。
4. **修改模型必须**：先弹窗预览并让用户确认 → **只开一个** `with revit.Transaction("名称"):` → 统计成功/失败。这样用户按一次 `Ctrl+Z` 就能撤销全部。
5. 所有给用户看的信息用 `forms.alert(...)`，**不要用 `print` 给用户看**（`print` 只写日志文件）。
6. **禁止**：执行外部程序/命令、`eval/exec`、未声明的联网、删除文件、加载外部 DLL、读取密钥/注册表。
7. 长度单位：Revit API 里是**英尺**。毫米请 `mm / 304.8`。
8. 你**无法运行**用户的 Revit，不要声称「已测试通过」。要提醒用户在**空白测试项目**里先试，把报错发回来继续改。

**交付格式**：见「第 14 节」。**不确定时的做法**：见「第 13 节」。

---

## 1. 这是什么

**天河落（Tianheluo，缩写 THL）** 是一个 **Revit 2026** 的「插件宿主 + 开放插件商店」：

- 用户安装一次**宿主**（一个 Revit 外接程序），之后在宿主的「插件中心」里搜索、安装、运行、更新、停用、卸载插件。
- 每个**插件**是一个很小的包（`.thlp`，本质是 zip），可以**单独下载、热更新、互不影响**。
- 本平台是**开源、公开、非商用的共享平台**：任何人都可以（用自己的 AI）开发插件，按本文规范做好后**发送到维护者邮箱**；维护者审核源码、上传后，插件出现在官方商店，所有用户都能一键安装。（账号 + 上传密钥的自助上传方式正在规划中，见第 8 节。）

当前支持：Revit 2026（2026.0 ~ 2026.5+）。插件语言：**Python（IronPython 3.4）**。

## 2. 宿主架构（Architecture）

```
Revit 2026
 └─ THL.Host（外接程序，.NET 8 / .NET 10 两套编译，安装脚本按 Revit 版本自动选择）
     ├─ 功能区「天河落」选项卡
     │    ├─ 「插件中心」按钮 → 启动器窗口（搜索 / 运行 / 商店 / 安装 / 更新 / 停用 / 卸载）
     │    └─ 「已装插件」面板：每个已启用插件一个按钮（最多 12 个，按安装顺序占槽位）
     ├─ 插件管理器 Store：扫描 %APPDATA%\Tianheluo\plugins\<id>\plugin.json
     ├─ 热加载：每次点击都重新读取磁盘上的脚本/DLL，更新插件无需重启 Revit
     ├─ Python 运行环境：内置 IronPython 3.4.2 + 标准库 + 精简版 pyrevit 兼容层
     └─ 商店客户端：读取 https://tianheluo.com/plugins.json，下载 .thlp 到本地并解压安装
```

关键事实：

| 项 | 说明 |
|---|---|
| 用户数据目录 | `%APPDATA%\Tianheluo\`：`plugins\<id>\`（已装插件）、`logs\`（日志）、`data\`（插件数据文件）、`config.json`（商店地址、停用列表、功能区槽位） |
| 插件安装 | 把 `.thlp` 解压到 `plugins\<id>\`；同 id 再装即覆盖更新 |
| 运行方式 | 点击按钮 → 宿主读取 `script.py` → 在**新的** IronPython 引擎里以 `__main__` 执行 → 结束后释放。脚本之间互相隔离，没有持久进程状态 |
| 线程 | 脚本在 **Revit 主线程**里同步执行，可以直接读写模型（写模型必须开 Transaction）；执行期间 Revit 界面被阻塞，耗时操作请用进度条并允许取消 |
| 功能区刷新 | 在插件中心里安装/卸载/停用后，关闭插件中心窗口，功能区立刻同步（无需重启） |
| 更新 | 插件中心打开时会自动对比商店清单：已装插件的 `version` 低于商店里的版本，就在「已安装」页显示「更新到 vX」，用户一键更新（无需重启 Revit）。**所以插件要更新，只需递增 `version` 后重新投稿。** 宿主本身的更新信息在 `https://tianheluo.com/host.json`，更新包会先校验 SHA256，Revit 关闭后自动安装，失败自动回滚。 |
| 下载计数 | 商店下载走 `https://tianheluo.com/api/dl/<id>`，每个访客对同一插件 1 小时内只计 1 次，不保存个人信息；官网首页显示热门插件榜，数据来自 `https://tianheluo.com/api/stats`。 |
| 商店清单 | `GET https://tianheluo.com/plugins.json` → `{"revit":"2026","plugins":[...]}`，每项含 `id/name/version/summary/category/download/author/license...` |
| 下载地址 | `https://tianheluo.com/dl/<id>_<version>.thlp` |

## 3. 插件包格式（.thlp）

`.thlp` 是一个 zip，**根目录必须有 `plugin.json`**。社区插件只接受 **Python 插件**（源码可审核）。

```
my-plugin_0.1.0.thlp  (zip)
├─ plugin.json        必需
├─ script.py          必需（plugin.json 的 "script" 指向它）
├─ icon.png           可选，按钮图标，建议 96×96 PNG；没有则宿主按 glyph/color 自动生成
├─ LICENSE            社区插件必需（OSI 开源许可证）
└─ 其它 .py / .xaml / 数据文件（可选；插件目录会加入 sys.path，可 import 同目录模块）
```

### plugin.json 字段

```json
{
  "id": "count-by-category",
  "name": "按类别统计",
  "version": "0.1.0",
  "description": "统计当前视图中各类别构件数量。\n只读，不修改模型。",
  "category": "数据处理",
  "revit": "2026",
  "type": "python",
  "script": "script.py",
  "glyph": "统",
  "author": "your-github-name",
  "license": "MIT",
  "homepage": "https://github.com/your-github-name/your-repo"
}
```

| 字段 | 必需 | 规则 |
|---|---|---|
| `id` | ✅ | 小写字母/数字/连字符，3–41 字符，以字母或数字开头；全平台唯一；**发布后不要改** |
| `name` | ✅ | 显示名，≤ 20 字符，中文或英文皆可 |
| `version` | ✅ | 语义化版本 `x.y.z`；更新插件时必须递增，宿主据此提示更新 |
| `description` | ✅ | ≤ 400 字符。**第一行是一句话摘要**（商店卡片显示），其后可换行写要点 |
| `category` | ✅ | `市政管线` `出图打印` `数据处理` `建模辅助` `视图管理` `导出` `其他` 之一 |
| `revit` | ✅ | 目前固定 `"2026"` |
| `type` | ✅ | 社区插件固定 `"python"` |
| `script` | ✅ | 入口脚本文件名，通常 `script.py` |
| `author` | ✅ | 你的名字或 GitHub 用户名 |
| `license` | ✅ | SPDX 标识，如 `MIT` `Apache-2.0` `BSD-3-Clause` `GPL-3.0-only` `LGPL-3.0-only` `MPL-2.0` |
| `glyph` | 建议 | 图标上显示的 1–3 个字符（如「桩」「DWG」） |
| `color` | 可选 | 图标主色，`#RRGGBB`；默认按分类配色 |
| `homepage` | 可选 | 项目主页 |
| `hostApi` | 可选 | 插件所需的宿主接口版本，整数，默认 `1`（目前宿主支持 `1`）。写 `1` 即可；宿主以后若升级了接口，会在发布说明里写明，旧插件不会被破坏 |
| `network` | 可选 | 默认 `false`。需要联网才填 `true`，并在 README 里说明访问了哪些地址、为什么（见第 9 节） |

JSON Schema：<https://tianheluo.com/schema/plugin.schema.json>

## 4. Python 运行环境契约（非常重要）

- 引擎：**IronPython 3.4.2**（运行在 .NET 上，不是 CPython）。
- 语法级别：支持 f-string、类型标注、`nonlocal`、`yield from`、`print()` 函数、推导式、`with`；
  **不支持**：海象运算符 `:=`、`async/await`、`match/case`、`dataclasses` 之外的新标准库特性。
- 标准库：随宿主提供（`os`、`sys`、`re`、`json`、`csv`、`math`、`traceback`、`datetime`、`collections` 等纯 Python 模块可用；依赖 C 扩展的库如 `numpy`、`pandas` **不可用**）。
- 执行方式：脚本以 `__name__ == "__main__"` 运行，所以**末尾的 `if __name__ == "__main__": main()` 会生效**。
- 预置全局变量：`__revit__`（`UIApplication`）、`__file__`（脚本完整路径）。
- `sys.path` 包含：插件目录、宿主标准库目录、pyrevit 兼容层目录。
- `sys.exit()` 视为正常结束。未捕获的异常会弹出「脚本出错」对话框并显示 traceback。
- `print()` 的输出写入 `%APPDATA%\Tianheluo\logs\<id>.log`（脚本结束后落盘）。

### 4.1 访问 Revit

```python
from pyrevit import revit, DB, UI, forms, script   # 与 pyRevit 同名的兼容层（只实现了下面列出的部分）

doc   = revit.doc        # 当前活动文档  Autodesk.Revit.DB.Document
uidoc = revit.uidoc      # UIDocument（选择集、当前视图）
uiapp = revit.uiapp      # UIApplication
# DB / UI 就是 Autodesk.Revit.DB / Autodesk.Revit.UI 命名空间，可直接用 Revit API：
walls = DB.FilteredElementCollector(doc).OfCategory(DB.BuiltInCategory.OST_Walls).WhereElementIsNotElementType().ToElements()
```

也可以直接 `import clr` + `clr.AddReference(...)` 使用任何已加载的 .NET 程序集（`System.*`、`PresentationFramework` 等）。

### 4.2 兼容层已提供的接口（只有这些，别的不要假设存在）

**`revit`**：`revit.doc` · `revit.uidoc` · `revit.uiapp` · `revit.Transaction(name)`（上下文管理器：`with revit.Transaction("名称"):`，正常退出提交，异常回滚）· `revit.query.get_name(element)` · `revit.DB` · `revit.UI`

**`forms`**（对话框，深色主题）：

| 函数 | 说明 |
|---|---|
| `forms.alert(msg, title=None, sub_msg=None, ok=True, cancel=False, yes=False, no=False, exitscript=False)` | 提示/确认。有 `yes/no/cancel` 时返回 `True/False`（选了「是」才为 True）；普通提示返回 `True` |
| `forms.SelectFromList.show(items, title='选择', button_name='确定', multiselect=False, name_attr=None)` | 列表选择（带搜索框）。单选返回所选项，多选返回列表，取消返回 `None`。`items` 里可放字符串、任意对象（用 `name_attr` 指定显示属性）或 `forms.TemplateListItem` 子类实例（重写 `name` 属性自定义显示文字，`.item` 是原对象） |
| `forms.CommandSwitchWindow.show(options, message='')` | 一排大按钮，返回被点的那个选项字符串；取消返回 `None` |
| `forms.ask_for_string(default='', prompt='', title='')` | 单行输入，取消返回 `None` |
| `forms.pick_folder(title=None)` | 选择文件夹，取消返回 `None` |
| `forms.pick_file(file_ext='', title=None)` | 选择文件，取消返回 `None` |
| `forms.save_file(file_ext='', default_name='', title=None)` | 保存文件对话框，取消返回 `None` |
| `forms.ProgressBar(title, cancellable=False)` | 进度条（可用 `with`）。`pb.update_progress(当前, 总数)`、`pb.cancelled`；标题里的 `{value}` `{max_value}` 会被替换 |
| `forms.WPFWindow` | 自定义 XAML 窗口基类：`class W(forms.WPFWindow): def __init__(self, xaml): forms.WPFWindow.__init__(self, xaml, literal_string=True)`；XAML 里带 `x:Name` 的控件自动成为实例属性；`.show_dialog()` 显示 |

**`script`**：`script.get_logger()`（有 `debug/info/warning/error`，输出到日志）· `script.get_document_data_file(id, ext)`（按文档分开的数据文件路径）· `script.get_universal_data_file(id, ext)`（全局数据文件路径）

**明确不支持**（pyRevit 里有但这里没有）：`script.get_output()` 及输出窗口、`script.exit()`（请用 `sys.exit()`）、`pyrevit.coreutils`、`pyrevit.userconfig`、`pyrevit.framework`、`pyrevit.compat`、`revit.query` 里除 `get_name` 以外的函数、`forms.select_*` 系列。需要这些能力时请直接用 Revit API 和 .NET。

### 4.3 写模型的规则

1. **所有修改必须在一个 Transaction 里**，并且**尽量只开一个**：用户按一次 `Ctrl+Z` 就能撤销整个插件的操作。
2. 先预览/确认再写入：会改很多构件的插件，必须先告诉用户「将修改 N 个构件」并让用户确认。
3. 不要吞异常：失败要 `forms.alert` 说明原因；批量操作要统计成功/失败数。
4. 不要依赖当前视图类型以外的 UI 状态；不要假设文档已保存。
5. 单位：Revit API 内部长度单位是**英尺**。毫米请 `mm / 304.8`。
6. 耗时操作要用 `forms.ProgressBar(..., cancellable=True)` 并检查 `pb.cancelled`。

## 5. 最小示例

目录 `hello-world/`：

`plugin.json`
```json
{
  "id": "hello-world",
  "name": "你好天河落",
  "version": "0.1.0",
  "description": "最小示例：弹出当前项目的名称和选中构件数量。",
  "category": "其他",
  "revit": "2026",
  "type": "python",
  "script": "script.py",
  "glyph": "你",
  "author": "tianheluo",
  "license": "MIT"
}
```

`script.py`
```python
# -*- coding: utf-8 -*-
from pyrevit import revit, forms


def main():
    doc = revit.doc
    n = len(list(revit.uidoc.Selection.GetElementIds()))
    forms.alert("项目：{}\n当前选中构件：{} 个".format(doc.Title, n), title="你好天河落")


if __name__ == "__main__":
    main()
```

更多示例（可直接下载）：
- <https://tianheluo.com/examples/hello-world/script.py>
- <https://tianheluo.com/examples/count-by-category/script.py>（只读统计 + 选择视图范围）
- <https://tianheluo.com/examples/set-comments/script.py>（单事务批量写入 + 预览确认 + 可撤销）

## 6. 本地调试

1. 安装宿主（<https://tianheluo.com/install>）。
2. 把你的插件文件夹复制到 `%APPDATA%\Tianheluo\plugins\<id>\`（里面直接有 `plugin.json`）。
3. 在 Revit 里打开「天河落 → 插件中心」，在「已安装」里点「运行」。关闭插件中心后，功能区也会出现按钮。
4. **改了脚本不需要重启 Revit**：再点一次就是最新代码。
5. 出错时：会弹「脚本出错」对话框并给出 traceback；`print()` 输出和 `script.get_logger()` 在 `%APPDATA%\Tianheluo\logs\<id>.log`。
6. 开发时请用**空白测试项目**，不要在真实工程上试写入类插件。

## 7. 打包

提交到社区仓库时**不需要自己打包**（CI 会打包）。如需手动打包用于本地安装：把 `plugin.json` 和脚本放在 zip **根目录**（不是放在子文件夹里），扩展名改成 `.thlp`。在插件中心点「安装插件包…」选择它即可。

## 8. 投稿流程（成为社区贡献者）

目前的方式：**把做好的插件发邮件给维护者，维护者审核后上传到网站。**

1. 按本文规范开发插件，得到一个目录：`<插件id>/`，里面有 `plugin.json`、`script.py`、`README.md`、`LICENSE`（可选 `icon.png`）。
2. **自查**：下载校验脚本 <https://tianheluo.com/tools/validate.py>（单文件，只需 Python 3.8+，无需安装任何库），在插件目录的**上一级**运行：
   `python validate.py <插件id>`
   必须全部通过（显示「通过」）。也可以直接对 zip 运行：`python validate.py my-plugin.zip`。
3. 把插件目录压缩成 zip（**zip 里要有 `<插件id>/` 这一层目录**，或 `plugin.json` 直接在 zip 根目录，两种都接受），文件名建议 `<插件id>_<版本>.zip`。
4. 发邮件到 **jiajiabimer@gmail.com**：
   - 主题：`[天河落插件投稿] <插件名> v<版本>`
   - 正文：一句话说明功能；你的署名（author）；确认「我同意以 plugin.json 中声明的开源许可证发布，并保证代码为本人所写或有权发布」
   - 附件：上面的 zip
5. 维护者**人工审核源码**，通过后上传。上线后插件在商店里带「社区」标记和你的署名。你会收到回复邮件。
6. **更新插件**：修改后**递增 `version`**，按同样方式重新投稿。
7. **下架/删除**：发邮件说明即可。

**规划中：账号与上传密钥。** 注册后获得个人上传密钥，用 `POST` 直接提交到平台的「待审核」队列，维护者在后台审核后发布。上线时会更新本节与 `/plugins.json`；在此之前请使用邮件投稿。

## 9. 规则与安全（社区插件会在用户电脑上以其权限运行，所以审核很严）

**必须**
- 全部源码可读（`.py`）。不接受 `.dll`、`.exe`、压缩/混淆/加密的代码、`.pyc`。
- 带 OSI 认可的开源许可证；作者署名真实可联系。
- 会修改模型的插件：单个 Transaction、预览确认、可 `Ctrl+Z`、统计成功/失败。
- README 如实说明插件做什么、改什么、读写哪些文件。

**禁止**（校验器会扫描，审核时也会人工检查）
- 执行外部程序或命令：`subprocess`、`os.system`、`os.popen`、`System.Diagnostics.Process`、`powershell`、`cmd`。
- 动态执行代码：`eval(`、`exec(`、`compile(` 作用于外部/拼接字符串，`__import__` 动态加载，`importlib` 加载网络内容。
- 未声明的联网：`urllib`、`http.client`、`socket`、`requests`、`System.Net`、`WebClient`、`HttpClient`。确需联网请在 `plugin.json` 设 `"network": true`，并在 README 写明地址与用途；维护者会逐条审核。
- 删除或批量改写用户文件：`os.remove`、`shutil.rmtree`、`os.rmdir`、`Directory.Delete`、`File.Delete`（插件自己的数据文件除外，且只能在 `script.get_*_data_file()` 返回的路径下）。
- 读取/外传凭据、注册表、浏览器数据、环境变量中的密钥；`ctypes`、`System.Reflection.Assembly.Load*`、`Marshal`、`clr.AddReferenceToFile*` 加载外部程序集。
- 修改 Revit/Windows 的安全或系统设置；在启动时自动运行（插件只能在用户点击时运行）。
- 冒用他人名义、侵犯版权、包含恶意或误导性功能。

## 10. 校验规则（`validate.py` 与维护者导入时的检查一致）

- `plugin.json` 符合 JSON Schema；`id` 与目录名一致；`id` 不与官方商店已有插件冲突（脚本会尝试联网读取 `plugins.json` 比对；离线时只提示）。
- `script` 指向的文件存在，且能被 IronPython 3.4 语法接受（不含 `:=`、`async`、`await`、`match`）。
- 有 `LICENSE` 和 `README.md`；单个插件总大小 ≤ 500 KB；单个文件 ≤ 200 KB。
- 目录里没有 `.dll/.exe/.pyc/.so/.zip` 等二进制。
- 未出现第 9 节「禁止」模式（未声明 `network` 时联网模式一律拒绝）。
- 校验通过只是**必要条件**，不代表安全；最终以维护者人工审核为准。

## 11. 机器可读资源

| 资源 | 地址 |
|---|---|
| 本文（Markdown 原文） | <https://tianheluo.com/ai.md> |
| 本文（HTML） | <https://tianheluo.com/ai> |
| llms.txt（索引） | <https://tianheluo.com/llms.txt> |
| 商店清单 | <https://tianheluo.com/plugins.json> |
| plugin.json JSON Schema | <https://tianheluo.com/schema/plugin.schema.json> |
| 自查校验脚本 | <https://tianheluo.com/tools/validate.py> |
| 示例插件 | <https://tianheluo.com/examples/hello-world/script.py> 等 |
| 投稿邮箱 | jiajiabimer@gmail.com |
| 宿主安装包 | <https://tianheluo.com/dl/THL-Host.zip> |

## 12. AI 工作流程（请照此执行）

当用户说「帮我做一个天河落插件，功能是 X」：

1. **澄清**：这个插件读还是写模型？作用对象是选中构件、当前视图还是全模型？需要用户输入什么？（问不超过 3 个问题，其余按合理默认。）
2. **设计**：用第 4 节的接口写 `script.py`。结构固定为 `main()` + `if __name__ == "__main__": main()`；所有对话框用 `forms`；写模型用 `revit.Transaction`。
3. **写 `plugin.json`**：按第 3 节填写，`id` 用小写连字符，`version` 从 `0.1.0` 开始，`author` 问用户，`license` 默认 `MIT`（让用户确认）。
4. **写 `README.md`**：功能、使用步骤、会修改什么、已知限制。
5. **自检**：逐条核对第 9 节禁止项；确认没有 `:=`/`async`；确认没有第 4.2 节「明确不支持」的接口。
6. **交付**：给出完整目录内容（`plugin.json`、`script.py`、`README.md`、`LICENSE`），并告诉用户：本地调试见第 6 节；投稿见第 8 节（运行 `validate.py` 自查 → 打包 zip → 发邮件到 jiajiabimer@gmail.com）。
7. **诚实说明**：你无法在用户的 Revit 里运行代码，请提醒用户先在**空白测试项目**里试，把弹出的错误或日志发回给你继续修。

### 给 AI 的提示词模板（用户可以直接复制给自己的 AI）

```
请先完整阅读 https://tianheluo.com/ai.md ，然后按「第 12 节」的流程，为天河落平台开发一个 Revit 2026 插件。
我的需求：<在这里描述你想要的功能>
我的署名（author）：<你的名字或 GitHub 用户名>
请输出完整文件：plugin.json、script.py、README.md、LICENSE，并告诉我如何自查（validate.py）和如何投稿。
```

## 13. 常见错误与坑（写代码前先看一遍）

**语法与运行环境**
- ❌ `if (n := len(x)) > 3:`（海象运算符）→ ✅ 先 `n = len(x)` 再 `if n > 3:`
- ❌ `async def` / `await` → ✅ 一律写同步代码（脚本本来就在 Revit 主线程同步执行）。
- ❌ `import numpy / pandas / requests` → ✅ 只用标准库和 Revit API / .NET。
- ❌ 在脚本里 `print(...)` 想给用户看 → ✅ 用 `forms.alert(...)`。
- ❌ 忘了 `if __name__ == "__main__": main()` → ✅ 一定要有，否则 `main()` 不会被调用（宿主以 `__main__` 运行脚本）。
- 除法：`/` 是真除法（得到小数），整除用 `//`。字符串默认是 Unicode，文件头写 `# -*- coding: utf-8 -*-`。
- 读写文本文件时指定编码：`io.open(path, "w", encoding="utf-8")`；路径用 `os.path.join`，不要硬编码盘符。

**Revit API**
- ❌ `element.Id.IntegerValue`（在 Revit 2026 里**已不存在**，会报 AttributeError）→ ✅ `element.Id.Value`（64 位整数）。
- ❌ 在已打开的事务里再开事务（嵌套）→ ✅ 全脚本只开一个 `with revit.Transaction(...)`；需要多步就在同一个 `with` 里做。
- ❌ 在事务**外**修改参数/删除/创建元素 → 会抛异常。读取不需要事务。
- ❌ `LookupParameter("中文名")` 当作唯一可靠的方式 → 参数名随 Revit 语言/项目而变，优先 `element.get_Parameter(DB.BuiltInParameter.XXX)`；`LookupParameter` 只取第一个同名参数，可能为 `None`，使用前必须判空。
- 参数赋值要先判断：`p is not None and not p.IsReadOnly`；数值/带单位的参数用 `p.SetValueString("1500")`（按项目单位解析），文本用 `p.Set("文字")`，整数/双精度用 `p.Set(数值)`（双精度单位是英尺等内部单位）。
- `uidoc.Selection.GetElementIds()` 返回 .NET 集合 → 用 `list(...)` 包一层再 `len()`。
- `doc.GetElement(eid)` 可能返回 `None`（已删除），要判空。
- 过滤构件要用 `FilteredElementCollector` + `OfCategory` / `OfClass` / `WhereElementIsNotElementType()`，**不要**遍历全部元素再用 Python 判断类别——大模型会非常慢。
- 大批量操作：用 `forms.ProgressBar("正在处理... ({value}/{max_value})", cancellable=True)`，循环里 `pb.update_progress(i + 1, total)` 并检查 `pb.cancelled`。
- 长时间运行会冻结 Revit 界面（脚本在主线程）。不要写死循环，不要 `time.sleep` 很久。
- 不要创建线程；不要使用 `ExternalEvent` 或无模态窗口——脚本结束后运行环境会被释放，无法保证之后的回调。所有交互都用模态对话框，在脚本里同步完成。
- 当前文档可能是族文档/没有项目：需要项目时先判断 `doc.IsFamilyDocument`。
- `doc.ActiveView` 可能是图纸、明细表等非模型视图；统计模型构件前可判断 `isinstance(doc.ActiveView, DB.ViewPlan)` 等，或提示用户切换到合适的视图。

**对话框**
- `forms.alert(msg, title="...")` 普通提示；要确认写 `forms.alert(msg, title="...", yes=True, no=True)`，返回 `True` 表示用户点了「是」。
- `forms.SelectFromList.show(items, title="...", button_name="确定", multiselect=True)`：取消返回 `None`，**一定要判空**。
- `forms.ask_for_string(...)` 取消返回 `None`；留空返回 `""`，两者不同。
- 所有对话框取消后要 `return`，不要继续往下执行。

**需求超出能力时**：如果用户要的功能需要这里没有的东西（例如自定义功能区面板、持续监听事件、调用外部程序、联网服务），请**如实告诉用户做不到或需要简化**，并给出一个能做的替代方案；不要编造不存在的接口。

## 14. 给 AI 的交付格式（请严格按这个格式回答用户）

当用户描述完需求后，你的回答按以下顺序：

1. **一两句话复述你理解的需求**，以及你做的关键决定（比如：只读还是会改模型、作用范围是选中构件/当前视图/全项目）。如果有会影响实现的不确定点，**最多问 3 个问题**再动手；其余用合理默认并说明。
2. **完整文件**——每个文件一个代码块，代码块前一行写文件名，例如：

   **`my-plugin/plugin.json`**
   ```json
   { ... }
   ```
   **`my-plugin/script.py`**
   ```python
   ...
   ```
   **`my-plugin/README.md`** 和 **`my-plugin/LICENSE`** 同理。文件内容必须**完整**，不要省略、不要写「其余同上」。
3. **使用与测试说明**（用普通话写给不会编程的用户）：
   - 本地试用：把整个文件夹 `my-plugin` 复制到 `%APPDATA%\Tianheluo\plugins\`，在 Revit 里打开「天河落 → 插件中心」，在「已安装」里点「运行」。
   - 先用空白测试项目试；有错误弹窗或日志（`%APPDATA%\Tianheluo\logs\my-plugin.log`）把内容发回来继续改。
   - 自查：下载 `validate.py`（https://tianheluo.com/tools/validate.py），运行 `python validate.py my-plugin`。
   - 投稿：压缩成 zip，发邮件到 jiajiabimer@gmail.com，主题 `[天河落插件投稿] 插件名 v版本`。
4. **诚实声明**：「我无法在你的 Revit 里运行这段代码，上面没有经过实际测试」。

**plugin.json 的填写规则**（再强调一遍）：`id` 小写连字符；`version` 从 `0.1.0` 开始；`author` 问用户；`license` 默认 `MIT`（请让用户确认）；`type` 固定 `python`；`script` 固定 `script.py`；`glyph` 取名字里最有辨识度的 1 个字；`category` 只能是 市政管线 / 出图打印 / 数据处理 / 建模辅助 / 视图管理 / 导出 / 其他。

**README.md 要写**：一句话功能、使用步骤、**会修改什么（只读则写「不修改模型」）**、已知限制、作者。

**LICENSE**：用户选的开源许可证全文（默认 MIT，署名处填用户的名字和年份 2026）。


---

## 附录：三个完整示例插件（全文）
下面是三个已通过校验的完整插件，可以直接照着写。每个插件都是一个文件夹，含 `plugin.json`、`script.py`、`README.md`、`LICENSE`（LICENSE 为 MIT 全文，此处省略，使用时把年份和署名改成你自己的）。

### 示例 A：hello-world（最小插件，只读）

**`hello-world/plugin.json`**

```json
{
  "id": "hello-world",
  "name": "你好天河落",
  "version": "0.1.0",
  "description": "最小示例：弹出当前项目名称和选中构件数量。\n只读，不修改模型。",
  "category": "其他",
  "revit": "2026",
  "type": "python",
  "script": "script.py",
  "glyph": "你",
  "author": "tianheluo",
  "license": "MIT",
  "homepage": "https://tianheluo.com/ai"
}
```

**`hello-world/script.py`**

```python
# -*- coding: utf-8 -*-
"""最小示例：弹出当前项目名称和选中构件数量。只读。"""
from pyrevit import revit, forms


def main():
    doc = revit.doc
    n = len(list(revit.uidoc.Selection.GetElementIds()))
    forms.alert("项目：{}\n当前选中构件：{} 个".format(doc.Title, n), title="你好天河落")


if __name__ == "__main__":
    main()
```

**`hello-world/README.md`**

```markdown
# 你好天河落

最小示例，演示插件的基本结构：`main()` + `if __name__ == "__main__"`，用 `forms.alert` 弹窗，只读不改模型。

**使用**：选中任意构件（可不选），点击按钮，弹出项目名和选中数量。
```

### 示例 B：count-by-category（只读统计：选择范围 + 收集器 + 结果弹窗）

**`count-by-category/plugin.json`**

```json
{
  "id": "count-by-category",
  "name": "按类别统计",
  "version": "0.1.0",
  "description": "统计当前视图或整个项目中各类别构件的数量（前 30 类）。\n只读，不修改模型。",
  "category": "数据处理",
  "revit": "2026",
  "type": "python",
  "script": "script.py",
  "glyph": "统",
  "author": "tianheluo",
  "license": "MIT",
  "homepage": "https://tianheluo.com/ai"
}
```

**`count-by-category/script.py`**

```python
# -*- coding: utf-8 -*-
"""统计各类别构件数量。只读。演示：选择范围、FilteredElementCollector、结果弹窗。"""
from pyrevit import revit, DB, forms


def main():
    doc = revit.doc
    scope = forms.CommandSwitchWindow.show(["当前视图", "整个项目"], message="统计范围：")
    if not scope:
        return  # 用户取消

    if scope == "当前视图":
        collector = DB.FilteredElementCollector(doc, doc.ActiveView.Id)
    else:
        collector = DB.FilteredElementCollector(doc)

    counts = {}
    for e in collector.WhereElementIsNotElementType().ToElements():
        cat = e.Category
        if cat is None:
            continue
        counts[cat.Name] = counts.get(cat.Name, 0) + 1

    if not counts:
        forms.alert("没有找到任何构件。", title="按类别统计")
        return

    rows = sorted(counts.items(), key=lambda kv: -kv[1])
    lines = ["{}：{}".format(name, n) for name, n in rows[:30]]
    more = "\n……（还有 {} 个类别）".format(len(rows) - 30) if len(rows) > 30 else ""
    forms.alert(
        "范围：{}\n共 {} 个类别，{} 个构件\n\n{}{}".format(
            scope, len(rows), sum(counts.values()), "\n".join(lines), more),
        title="按类别统计")


if __name__ == "__main__":
    main()
```

**`count-by-category/README.md`**

```markdown
# 按类别统计

选择统计范围（当前视图 / 整个项目），按类别统计构件数量并弹窗显示前 30 类。**只读，不修改模型。**

演示：`forms.CommandSwitchWindow`、`DB.FilteredElementCollector`、结果弹窗。
```

### 示例 C：set-comments（写模型的标准流程：选择 → 输入 → 预览确认 → 单事务写入 → 统计 → 可撤销）

**`set-comments/plugin.json`**

```json
{
  "id": "set-comments",
  "name": "批量写注释",
  "version": "0.1.0",
  "description": "给选中的构件批量写入「注释」参数（先预览确认，可一步撤销）。",
  "category": "数据处理",
  "revit": "2026",
  "type": "python",
  "script": "script.py",
  "glyph": "注",
  "author": "tianheluo",
  "license": "MIT",
  "homepage": "https://tianheluo.com/ai"
}
```

**`set-comments/script.py`**

```python
# -*- coding: utf-8 -*-
"""给选中构件的「注释」参数批量写入文字。演示：写模型的标准流程——
选择对象 → 输入 → 预览确认 → 单个事务写入 → 统计成功/失败 → 一步 Ctrl+Z 可撤销。"""
from pyrevit import revit, DB, forms


def main():
    doc = revit.doc
    ids = list(revit.uidoc.Selection.GetElementIds())
    if not ids:
        forms.alert("请先在 Revit 里选中要写入注释的构件，再运行。", title="批量写注释")
        return

    text = forms.ask_for_string(default="", prompt="要写入「注释」的内容（留空表示清空）：", title="批量写注释")
    if text is None:
        return  # 取消

    targets, skipped = [], 0
    for eid in ids:
        elem = doc.GetElement(eid)
        p = elem.get_Parameter(DB.BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS) if elem is not None else None
        if p is None or p.IsReadOnly:
            skipped += 1
        else:
            targets.append(p)

    if not targets:
        forms.alert("选中的构件都没有可写的「注释」参数。", title="批量写注释")
        return

    # 预览确认：会改多少个，让用户决定
    msg = "将把 {} 个构件的「注释」设为：\n「{}」\n\n（有 {} 个构件没有可写的注释参数，会跳过。写入后可按 Ctrl+Z 撤销。）".format(
        len(targets), text, skipped)
    if not forms.alert(msg, title="确认写入", yes=True, no=True):
        return

    ok, failed = 0, 0
    with revit.Transaction("批量写注释"):  # 只开一个事务：一次 Ctrl+Z 撤销全部
        for p in targets:
            try:
                p.Set(text)
                ok += 1
            except Exception:
                failed += 1
    forms.alert("完成：成功 {}，失败 {}，跳过 {}。".format(ok, failed, skipped), title="批量写注释")


if __name__ == "__main__":
    main()
```

**`set-comments/README.md`**

```markdown
# 批量写注释

给选中构件的「注释」参数批量写入文字。**会修改模型**，所以按规范做了：

1. 先选中构件，再运行
2. 输入内容 → **预览确认**（会改几个）
3. **单个事务**写入，成功/失败/跳过都统计
4. 一次 `Ctrl+Z` 即可撤销全部

演示：`forms.ask_for_string`、`forms.alert(yes=True, no=True)`、`revit.Transaction`。
```
