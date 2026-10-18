# tianheluo.com 天河落

Revit 插件宿主 + 共享插件商店的官网。**公开共享、非商业**，代码全部公开，供大家学习使用。

- 纯静态站（无构建步骤）+ Cloudflare Pages Functions，部署到 Cloudflare Pages。
- 宿主与插件源码、构建与发布工具：<https://github.com/H8DIDI/tianheluo-core>

## 目录
| 路径 | 作用 |
|---|---|
| `index.html` `store.html` `install.html` `developers.html` `contact.html` `ai.html` `404.html` | 页面 |
| `plugins/<id>.html` | 每个插件的独立详情页 `/plugins/<id>`（**自动生成**，由 `tools/build_seo.py` 从 `plugins.json` 生成） |
| `app.js` `fx.js` `style.css` `fx.css` | 公共脚本与样式（商店列表/热门榜/下载数；导航与页脚已写进各页 HTML） |
| `tools/build_seo.py` | SEO 构建：生成插件详情页、导航/页脚、首页/商店的静态列表、`sitemap.xml` |
| `privacy.html` | 隐私说明（据实记录：不设 cookie、记录访问 IP 与城市级地区（保留 180 天、不出售不分享）、宿主无遥测）。改动数据收集方式时必须同步更新 |
| `tools/healthcheck.py` `tools/check_site.py` `tools/indexnow.py` | 线上健康检查 / 仓库静态检查 / 通知搜索引擎（见 `.github/workflows/`） |
| `.well-known/security.txt` `<key>.txt` | 安全联系方式（每年续期 Expires）/ IndexNow 密钥文件 |
| `og-image.png` | 社交分享预览图（1200×630） |
| `content/plugins/<id>.json` | **手写**的插件长文案（解决什么问题/怎么用/注意事项/SEO 标题/示意图），`build_seo.py` 渲染进详情页；改它不需要升插件版本 |
| `img/plugins/` | 插件详情页里的示意图（SVG；有真实截图时可替换，并在对应 content json 里改 `image.src`） |
| `plugins.json` | 商店清单（**自动生成**，含每个插件包的 sha256、hostApi） |
| `host.json` | 宿主更新清单（自动生成，含各构建包的 sha256） |
| `dl/` | 插件包 `.thlp`、宿主安装包与更新包（自动生成，打包可复现） |
| `functions/api/dl/[id].js` | 下载入口：计数（D1）并记一条含 IP 与城市级地区的明细（180 天）后返回文件 |
| `migrations/download_geo.sql` | 地区明细表 `download_geo` 的建表语句（在 D1 控制台执行一次；未展示在网站上） |
| `functions/api/stats.js` | 各插件下载数（公开只读） |
| `functions/plugin.js` | 旧网址 `/plugin?id=x` 永久跳转到 `/plugins/x` |
| `ai.md` `ai.html` `tianheluo-ai-spec.txt` `llms.txt` | 给 AI 读的插件开发规范 |
| `schema/plugin.schema.json` `tools/validate.py` | 插件清单 Schema 与投稿自查脚本 |
| `examples/` | 三个可直接跑通的示例插件 |
| `_headers` `_redirects` | 安全响应头（CSP 等）与跳转 |

> 改了页面或插件清单后运行 `python tools/build_seo.py`（发布脚本会自动运行）。
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
