# tianheluo.com 天河落

Revit 插件宿主 + 共享插件商店的官网。**公开共享、非商业**，代码全部公开，供大家学习使用。

- 纯静态站（无构建步骤）+ Cloudflare Pages Functions，部署到 Cloudflare Pages。
- 宿主与插件源码、构建与发布工具：<https://github.com/H8DIDI/tianheluo-core>

## 目录
| 路径 | 作用 |
|---|---|
| `index.html` `store.html` `plugin.html` `install.html` `developers.html` `contact.html` `ai.html` | 页面 |
| `app.js` `fx.js` `style.css` `fx.css` | 公共脚本与样式（导航/页脚/商店渲染/热门榜） |
| `plugins.json` | 商店清单（**自动生成**，含每个插件包的 sha256、hostApi） |
| `host.json` | 宿主更新清单（自动生成，含各构建包的 sha256） |
| `dl/` | 插件包 `.thlp`、宿主安装包与更新包（自动生成，打包可复现） |
| `functions/api/dl/[id].js` | 下载入口：计数（D1，不保存 IP）后返回文件 |
| `functions/api/stats.js` | 各插件下载数（公开只读） |
| `ai.md` `ai.html` `tianheluo-ai-spec.txt` `llms.txt` | 给 AI 读的插件开发规范 |
| `schema/plugin.schema.json` `tools/validate.py` | 插件清单 Schema 与投稿自查脚本 |
| `examples/` | 三个可直接跑通的示例插件 |
| `_headers` `_redirects` | 安全响应头（CSP 等）与跳转 |

> `plugins.json` / `host.json` / `dl/` 由源码仓库的 `python tools/build_all.py` 生成，**不要手改**。
> 发布请用源码仓库的 `python tools/publish.py -m "说明"`（含发布前检查与线上核对）。

## 本地预览
```bash
python -m http.server 8000
```
（本地预览不会应用 `_headers`，也没有 `/api/*`。）

## 想参与？
投稿插件、提建议：见 [/developers](https://tianheluo.com/developers)、[/contact](https://tianheluo.com/contact)（微信 didi / jiajiabimer@gmail.com）。
安全问题请发邮件，勿公开贴出。

## 许可
站点代码 MIT（见 LICENSE）；各插件遵循其 `plugin.json` 中声明的许可证。
