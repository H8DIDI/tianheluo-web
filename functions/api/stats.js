// GET /api/stats  —— 各插件的下载数：{ updated, plugins: { <id>: { total, week } }, host: { total, week } }
// week = 最近 7 天（含今天，UTC）。结果缓存 60 秒。
export async function onRequestGet({ env }) {
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
    return new Response(JSON.stringify({ updated: new Date().toISOString(), plugins: {}, host: { total: 0, week: 0 }, error: "stats unavailable" }), { headers });
  }
}
