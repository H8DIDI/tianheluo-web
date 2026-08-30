# 扩展详情页通用模板说明

本目录 `mommertf/slack/` 是一个完整的扩展详情页模板（克隆自原站 Slack 扩展页）。
**新增任意扩展详情页 = 复制本目录 + 改目录名 + 替换下述数据点。**

## 新增步骤

```bash
# 1. 复制模板目录(目录名 = 作者/扩展slug, 决定了 URL)
cp -r mommertf/slack your-author/your-slug

# 2. 编辑 your-author/your-slug/index.html，替换以下数据点:
```

## 数据点清单（在 index.html 中搜索替换）

| 位置 | 原始值 | 替换为 |
|---|---|---|
| `<title>` 与 og:title | `tianheluo Store: Slack` | 你的扩展名 |
| meta description | Slack 扩展描述 | 你的描述 |
| 页面主标题 (h1 区域) | `Slack` | 你的扩展名 |
| 作者名 | `mommertf` | 你的作者名 |
| 描述段落 | "is the perfect companion..." 等 | 你的简介 |
| 特性列表 | "Quickly open Slack channels" 等 | 你的功能点 |
| 扩展图标 img src | `/_ext/files.raycast.com/...` | 你的图标文件(放入 _ext/) |
| 截图 img src | `/_ext/files.raycast.com/...` | 你的截图 |
| 命令列表 | Slack 的 set-status 等命令 | 你的命令 |
| 内联 JSON (window.__NEXT_DATA__) | 扩展 manifest 数据 | 同步更新(名称/图标/命令) |
| 详情页 URL 引用 | `https://www.raycast.com/mommertf/slack` | 你的线上 URL |

## 与商店页的联动

- Store 页 (`store.html`) 扩展卡片 href 形如 `/author/slug` → 部署后即跳转到该目录的 index.html
- 卡片缩略图在 `/_ext/misc-assets.raycast.com/extension-cards/*.png`，新增扩展时复制一份改图

## 部署

```bash
git add -A && git commit -m "add extension: your-slug" && git push
# Cloudflare Pages 自动构建, 1 分钟内生效
```

## 注意

- 资源必须用**根绝对路径** `/_next/...` `/_ext/...`（深路径 URL 下相对路径会错乱）
- 不要引入 `/_vercel/` 引用（会导致水合失败、动画失效）
- 品牌名已全局替换为 `tianheluo`，不要再手动改回