// POST /api/event  —— 使用统计：只接收白名单里的事件，写入 D1 表 events。
// 设计原则（与 privacy.html 的承诺一致）：
//   - 不设 Cookie。记录事件名、页面路径、数值、一小段文字，以及访问者 IP 与 Cloudflare 按 IP 估算的国家/省/城市/大致经纬度，
//     仅供站长分析和优化网站，不出售、不分享给第三方（见 privacy.html）。
//   - 文字里的疑似电话号码、邮箱会先被遮盖再写入。
//   - 记录保留 180 天，到期整行（含 IP）删除。统计失败不影响页面，接口对前端一律返回 204。

const EVENTS = new Set([
  "hud_open", "hud_query", "hud_pick",
  "store_filter", "store_search", "plugin_click",
  "download_click", "install_click", "copy_prompt", "contact_click",
  "hit_404", "js_error",
  "vital_lcp", "vital_cls", "vital_ttfb",
]);
const KEEP_SECONDS = 180 * 86400;

/** 遮盖疑似个人信息：7 位以上连续数字（电话、证件）、邮箱。 */
function scrub(s) {
  return String(s)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "#")
    .replace(/\d{7,}/g, "#")
    .slice(0, 80);
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return new Response(null, { status: 204 });
    const text = await request.text();
    if (text.length > 2000) return new Response(null, { status: 204 });
    const e = JSON.parse(text);
    const name = String(e.n || "");
    if (!EVENTS.has(name)) return new Response(null, { status: 204 });
    const path = String(e.p || "/").split("?")[0].slice(0, 120);
    const value = Number.isFinite(Number(e.v)) && e.v !== null ? Number(e.v) : null;
    const prop = e.x == null || e.x === "" ? null : scrub(e.x);
    const now = Math.floor(Date.now() / 1000);
    const day = new Date().toISOString().slice(0, 10);
    const cf = request.cf || {};
    const ip = (request.headers.get("CF-Connecting-IP") || "").slice(0, 45) || null;
    const coord = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
    await env.DB.prepare(
      "INSERT INTO events (ts, day, name, path, value, prop, ip, country, region, city, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(now, day, name, path, value, prop, ip, cf.country || null, cf.region || null, cf.city || null, coord(cf.latitude), coord(cf.longitude)).run();
    if (Math.random() < 0.01) // 顺手清理超过保留期的记录
      await env.DB.prepare("DELETE FROM events WHERE ts < ?").bind(now - KEEP_SECONDS).run();
  } catch (err) { /* 统计失败不影响页面 */ }
  return new Response(null, { status: 204 });
}
