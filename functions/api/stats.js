// GET /api/stats  —— 各插件的下载数：{ updated, plugins: { <id>: { total, week } }, host: { total, week } }
// week = 最近 7 天（含今天，UTC）。结果缓存 60 秒。
// 边缘缓存：D1 查询要 1~2 秒，热门榜在首页首屏就要用。同一个数据中心 60 秒内直接返回缓存。
export async function onRequestGet(ctx) {
  const cache = caches.default;
  const key = new Request(new URL("/api/stats", ctx.request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await build(ctx);
  if (res.status === 200 && !res.headers.get("X-Stats-Error")) ctx.waitUntil(cache.put(key, res.clone()));  // 出错的结果不缓存
  return res;
}

async function build({ env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60",
    "Access-Control-Allow-Origin": "*",
  };
  try {
    if (!env.DB) throw new Error("no db");
    const since = new Date(Date.now() - 6 * 86400e3).toISOString().slice(0, 10);
    const rs = await env.DB.prepare(
      "SELECT plugin_id AS id, SUM(count) AS total, SUM(CASE WHEN day >= ? THEN count ELSE 0 END) AS week FROM downloads GROUP BY plugin_id"
    ).bind(since).all();
    const plugins = {};
    for (const r of rs.results || []) plugins[r.id] = { total: r.total, week: r.week };
    const host = plugins.host || { total: 0, week: 0 };
    delete plugins.host;
    return new Response(JSON.stringify({ updated: new Date().toISOString(), plugins, host }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ updated: new Date().toISOString(), plugins: {}, host: { total: 0, week: 0 }, error: "stats unavailable" }), { headers: { ...headers, "Cache-Control": "no-store", "X-Stats-Error": "1" } });
  }
}

// HEAD：和 GET 一样的状态码与响应头，不带正文（只实现 GET 时 Pages 会对 HEAD 返回 404）
export async function onRequestHead(ctx) {
  const res = await onRequestGet(ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
