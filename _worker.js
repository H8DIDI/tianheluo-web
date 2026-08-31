// tianheluo-web: Cloudflare Pages Worker
// 1) /_next/image 透明代理(伪装 Next.js 图片优化器): 解码 url 参数 → 站内 ASSETS / 外域 fetch
// 2) /frontend_api/session 返回空 JSON, 避免 404 噪音
// 3) 其余请求原样走静态资源
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---- Next.js 图片优化器兼容层 ----
    if (pathname === "/_next/image") {
      const target = url.searchParams.get("url");
      if (target) {
        const dec = decodeURIComponent(target);
        // 站内资源: 从 Pages 静态资源读取
        if (dec.startsWith("/")) {
          const res = await env.ASSETS.fetch(new URL(dec, url.origin));
          if (res.ok) {
            const headers = new Headers(res.headers);
            headers.set("Cache-Control", "public, max-age=31536000, immutable");
            return new Response(res.body, { status: 200, headers });
          }
        }
        // 外域原图(如 misc-assets.raycast.com / files.raycast.com): 直取
        if (/^https?:\/\//i.test(dec)) {
          try {
            const res = await fetch(dec, { headers: { "User-Agent": "Mozilla/5.0 (tianheluo-worker)" } });
            if (res.ok) {
              const headers = new Headers(res.headers);
              headers.set("Cache-Control", "public, max-age=31536000, immutable");
              return new Response(res.body, { status: 200, headers });
            }
          } catch (e) { /* fallthrough */ }
        }
      }
      return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
    }

    // ---- 前端会话 API 占位(避免 404) ----
    if (pathname === "/frontend_api/session") {
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ---- 常规静态资源 ----
    const res = await env.ASSETS.fetch(request);
    // HTML 禁止缓存/bfcache: 保证每次导航都是最新版本
    const ct = res.headers.get("Content-Type") || "";
    if (ct.includes("text/html")) {
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      return new Response(res.body, { status: res.status, headers });
    }
    return res;
  },
};