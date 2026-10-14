// GET /api/dl/<id>  —— 下载插件（或宿主更新包），同时给这个 id 计一次数，然后把文件直接返回。
// 设计原则：计数绝不能影响下载——数据库出任何问题都照常下载。
//   - id 必须是商店清单(plugins.json)里的插件，或宿主(host.json)里的资源；其它一律 404（防止乱写数据库）。
//   - 同一个访问者（按 IP 网段）对同一个 id，1 小时内只算 1 次（用加盐哈希做去重键，不保存任何原始 IP）。
//   - 每次计数同时写一条地区明细 download_geo（国家/城市/大致经纬度，由 Cloudflare 按 IP 估算，不含 IP）。
//     目前只留在数据库里给站长看，不对外展示；保留 365 天。见 migrations/download_geo.sql。
//   - 只统计 GET；HEAD/探测不计数。

const DEDUPE_SECONDS = 3600;
const GEO_KEEP_SECONDS = 365 * 86400;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 地区：Cloudflare 按 IP 估算的城市级位置（request.cf）。经纬度保留两位小数（约 1 公里），不是住址。 */
function geoOf(request) {
  const cf = request.cf || {};
  const coord = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  return { country: cf.country || null, region: cf.region || null, city: cf.city || null, lat: coord(cf.latitude), lon: coord(cf.longitude) };
}

/** 访问者标识：IPv4 取前 3 段（/24），IPv6 取前 3 个十六进制段（/48）。
 *  很多运营商/代理会在一个地址池里轮换出口 IP，用完整 IP 去重会把同一个人算成多次。 */
function ipPrefix(ip) {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":");
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : ip;
}

async function loadJson(env, request, path) {
  const res = await env.ASSETS.fetch(new URL(path, request.url));
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

/** 把 id 解析成 { file, countId }。plugin id → /plugins.json；host-net8 / host-net10 / host-installer → /host.json */
async function resolve(env, request, id) {
  if (id.startsWith("host-")) {
    const host = await loadJson(env, request, "/host.json");
    if (!host) return null;
    const key = id.slice(5);
    if (key === "installer") return host.installer ? { file: host.installer.file, countId: "host" } : null;
    const a = host.assets && host.assets[key];
    return a ? { file: a.file, countId: "host" } : null;
  }
  const cat = await loadJson(env, request, "/plugins.json");
  const p = cat && (cat.plugins || []).find((x) => x.id === id);
  return p && p.file ? { file: p.file, countId: p.id } : null;
}

async function count(env, request, countId) {
  try {
    if (!env.DB) return;
    const ip = ipPrefix(request.headers.get("CF-Connecting-IP") || "unknown");
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / DEDUPE_SECONDS);
    const key = await sha256Hex(`${env.HASH_SALT || "salt"}|${ip}|${countId}|${bucket}`);
    const ins = await env.DB.prepare("INSERT OR IGNORE INTO dedupe (k, ts) VALUES (?, ?)").bind(key, now).run();
    if (ins.meta && ins.meta.changes === 0) return; // 1 小时内同一访问者已计过
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO downloads (plugin_id, day, count) VALUES (?, ?, 1) ON CONFLICT(plugin_id, day) DO UPDATE SET count = count + 1"
    ).bind(countId, day).run();
    // 地区明细：和计数同一次下载才写一条，所以明细条数 = 计入总数的下载次数。写失败只丢这一条明细，不影响计数。
    try {
      const g = geoOf(request);
      await env.DB.prepare(
        "INSERT INTO download_geo (ts, plugin_id, country, region, city, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(now, countId, g.country, g.region, g.city, g.lat, g.lon).run();
    } catch (e) { /* 表还没建好等情况：忽略 */ }
    if (Math.random() < 0.02) { // 顺手清理：2 天前的去重记录、1 年前的地区明细
      await env.DB.prepare("DELETE FROM dedupe WHERE ts < ?").bind(now - 2 * 86400).run();
      try { await env.DB.prepare("DELETE FROM download_geo WHERE ts < ?").bind(now - GEO_KEEP_SECONDS).run(); } catch (e) { /* 忽略 */ }
    }
  } catch (e) { /* 计数失败不影响下载 */ }
}

export async function onRequest({ request, env, params, waitUntil }) {
  const id = String(params.id || "");
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id) || !["GET", "HEAD"].includes(request.method))
    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const hit = await resolve(env, request, id);
  if (!hit) return new Response(JSON.stringify({ error: "unknown id" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const file = await env.ASSETS.fetch(new URL(hit.file, request.url));
  if (!file.ok) return new Response(JSON.stringify({ error: "file missing" }), { status: 404, headers: { "Content-Type": "application/json" } });

  if (request.method === "GET") waitUntil(count(env, request, hit.countId));

  const name = hit.file.split("/").pop();
  const headers = new Headers(file.headers);
  headers.set("Content-Disposition", `attachment; filename="${name}"`);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(file.body, { status: 200, headers });
}
