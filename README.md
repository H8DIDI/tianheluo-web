# 天河落 tianheluo.com

Revit 插件宿主 + 应用商店。纯静态站，无构建步骤，部署到 Cloudflare Pages。

- `index.html` 首页 · `store.html` 商店 · `plugin.html?id=` 详情 · `install.html` 安装指南
- **插件数据只在 `plugins.json`**：新增/上架插件只改这个文件，页面自动更新。
- 插件文件放 R2 桶 `tianheluo-public`，下载域 `https://dl.tianheluo.com/plugins/`。

## 上架一个插件
1. 编译 DLL，上传：`wrangler r2 object put tianheluo-public/plugins/Xxx_v0.1.0.dll --file Xxx.dll --remote`
2. 在 `plugins.json` 里加/改一条：`status` 设 `beta`/`stable`，`download` 填下载链接，`size` 填大小。
3. 提交并推送 `main`，Pages 自动部署。

## 本地预览
```bash
python -m http.server 8000
```
