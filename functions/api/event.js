// POST /api/event  —— 匿名使用统计：只接收白名单里的事件，写入 D1 表 events。
// 设计原则（与 privacy.html 的承诺一致）：
//   - 不设 Cookie，不存 IP，不记录用户标识；只记录事件名、页面路径、数值、一小段文字。
//   - 文字里的疑似电话号码、邮箱会先被遮盖再写入。
//   - 记录只保留约 180 天。统计失败不影响页面，接口对前端一律返回 204。

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
    await env.DB.prepare(
      "INSERT INTO events (ts, day, name, path, value, prop) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(now, day, name, path, value, prop).run();
    if (Math.random() < 0.01) // 顺手清理超过保留期的记录
      await env.DB.prepare("DELETE FROM events WHERE ts < ?").bind(now - KEEP_SECONDS).run();
  } catch (err) { /* 统计失败不影响页面 */ }
  return new Response(null, { status: 204 });
}
