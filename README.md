# 天河落 tianheluo.com

一级 **Tianheluo**，二级 **THL**，功能用纯粹名词。

v1：静态门面（基于 Raycast 官网骨架魔改：`index.html` 首页 + `store.html` 应用商店）。
后续：迁移 VitePress，内容全部 Markdown。

## 目录

```
tianheluo-web/
├── index.html          # 首页（魔改中）
├── store.html          # 应用商店页
├── _next/              # 静态资源（CSS/JS/图片/字体）
├── _ext/               # 第三方域资源（图标/头像）
├── src/
│   ├── index.md        # 网站首页文案（VitePress 版）
│   ├── store/          # 插件应用商店详情页 md
│   └── changelog/      # 更新日志 md
└── public/assets/      # GIF / 截图
```

## 本地预览

```bash
python -m http.server 8000
# 打开 http://127.0.0.1:8000/index.html
```