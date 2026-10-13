// GET /api/dl/<id>  —— 下载插件（或宿主更新包），同时给这个 id 计一次数，然后把文件直接返回。
// 设计原则：计数绝不能影响下载——数据库出任何问题都照常下载。
//   - id 必须是商店清单(plugins.json)里的插件，或宿主(host.json)里的资源；其它一律 404（防止乱写数据库）。
//   - 同一个访问者对同一个 id，1 小时内只算 1 次（用加盐哈希做去重键，不保存原始 IP）。
//   - 只统计 GET；HEAD/探测不计数。

const DEDUPE_SECONDS = 3600;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / DEDUPE_SECONDS);
    const key = await sha256Hex(`${env.HASH_SALT || "salt"}|${ip}|${countId}|${bucket}`);
    const ins = await env.DB.prepare("INSERT OR IGNORE INTO dedupe (k, ts) VALUES (?, ?)").bind(key, now).run();
    if (ins.meta && ins.meta.changes === 0) return; // 1 小时内同一访问者已计过
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO downloads (plugin_id, day, count) VALUES (?, ?, 1) ON CONFLICT(plugin_id, day) DO UPDATE SET count = count + 1"
    ).bind(countId, day).run();
    if (Math.random() < 0.02) // 顺手清理 2 天前的去重记录
      await env.DB.prepare("DELETE FROM dedupe WHERE ts < ?").bind(now - 2 * 86400).run();
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
