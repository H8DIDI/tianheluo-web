// 插件数据渲染 + 下载数 / 热门榜（页面主体已有静态版；这里用实时数据替换）
const STATUS = { stable: "稳定版", beta: "测试版", planned: "计划中" };
const CAT_COLOR = { "市政管线": "#3FA9FF", "出图打印": "#818CF8", "数据处理": "#10B981", "导出": "#F59E0B", "建模辅助": "#38BDF8", "视图管理": "#06B6D4" };
// 全站插件累计下载低于这个数时，热榜还没有参考价值：标题改为“精选上架”，不再展示“还没有数据”的提示语
const COLD_THRESHOLD = 50;
// 插件详情页网址。用函数拼接，避免搜索引擎把 JS 里的字面量当成真实链接去抓取（会得到一个 404）
const pageUrl = (id) => "/plugins/".concat(encodeURIComponent(id));

// 导航栏/页脚由 tools/build_seo.py 直接写进每个页面的 HTML（爬虫不执行 JS，所以不能靠这里注入）。

async function loadData() {
  const r = await fetch("/plugins.json", { cache: "no-cache" });
  return r.json();
}

// 下载统计（/api/stats）：失败时返回空，页面照常显示，只是不显示数字
let _stats;
async function loadStats() {
  if (_stats) return _stats;
  try {
    const r = await fetch("/api/stats");
    _stats = r.ok ? await r.json() : { plugins: {} };
  } catch { _stats = { plugins: {} }; }
  return _stats;
}
const total = (st, id) => (st.plugins && st.plugins[id] ? st.plugins[id].total : 0);
const week = (st, id) => (st.plugins && st.plugins[id] ? st.plugins[id].week : 0);
const fmt = (n) => (n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + " 万" : n.toLocaleString("en-US"));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// 图标徽标：按分类配色 + 一个字（与宿主里的图标风格一致）
function badge(p, size) {
  const base = p.color || CAT_COLOR[p.category] || "#3FA9FF";
  const g = p.glyph || (p.name || "T").replace(/^(一键|清理重复|清理|强电)/, "").slice(0, 1);
  const fs = g.length > 1 ? 0.3 : 0.5;
  return `<span class="pic" style="width:${size}px;height:${size}px;font-size:${Math.round(size * fs)}px;background:linear-gradient(135deg,${base},${base}99);border-color:${base}88;color:#fff;font-weight:800">${esc(g)}</span>`;
}

function card(p, st) {
  const n = total(st, p.id);
  return `
  <a class="pc" href="${pageUrl(p.id)}">
    <div class="top">${badge(p, 44)}
      <h3>${esc(p.name)}<small>${esc(p.en)}</small></h3></div>
    <p>${esc(p.summary)}</p>
    <div class="meta"><span class="tag ${p.status}">${STATUS[p.status]}</span>
      <span class="tag">${esc(p.category)}</span>${p.tier === "community" ? '<span class="tag community">社区</span>' : ""}${n > 0 ? `<span class="tag dl">⬇ ${fmt(n)}</span>` : ""}</div>
  </a>`;
}

// 首页热榜区的标题：冷启动时改为“精选上架”，数据够了再换回“热门插件榜”
function popularTitles(cold) {
  const eyebrow = document.querySelector("[data-pop-eyebrow]");
  const title = document.querySelector("[data-pop-title]");
  if (eyebrow) eyebrow.textContent = cold ? "精选上架" : "热门插件榜";
  if (title) title.textContent = cold ? "精选上架插件 / 核心工程工作流" : "大家都在用";
}

// 热门榜：本周 / 总榜两个标签。数据不足时退化成“最新上架”。
async function renderPopular() {
  const box = document.getElementById("popular");
  if (!box) return;
  const limit = parseInt(box.dataset.limit || "5", 10);
  const [{ plugins }, st] = await Promise.all([loadData(), loadStats()]);
  const live = plugins.filter((p) => p.status !== "planned");
  const cold = live.reduce((s, p) => s + total(st, p.id), 0) < COLD_THRESHOLD;
  popularTitles(cold);
  const newest = () => [...live].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, limit).map((p) => ({ p, n: null }));
  if (cold) {
    box.innerHTML = `<div class="rank-body"></div>`;
    box.querySelector(".rank-body").innerHTML = newest().map((r) => rankRow(r, 0)).join("");
    return;
  }
  let mode = "week";
  const draw = () => {
    const key = mode === "week" ? week : total;
    let rows = live.map((p) => ({ p, n: key(st, p.id) })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name)).slice(0, limit);
    let note = "";
    if (rows.length === 0) {
      rows = newest();
      note = `<p class="rank-note">${mode === "week" ? "本周还没有新的下载，" : "还没有下载记录，"}先展示最新上架的插件。</p>`;
    }
    box.querySelector(".rank-body").innerHTML = note + rows.map((r, i) => rankRow(r, i)).join("");
    box.querySelectorAll(".rank-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
  };
  box.innerHTML = `<div class="rank-tabs"><button data-m="week">本周热门</button><button data-m="all">总榜</button></div><div class="rank-body"></div>`;
  box.querySelector(".rank-tabs").addEventListener("click", (e) => { const m = e.target.dataset.m; if (m) { mode = m; draw(); } });
  draw();
}

function rankRow(r, i) {
  return `
      <a class="rk" href="${pageUrl(r.p.id)}">
        <span class="no ${i < 3 && r.n ? "top" : ""}">${i + 1}</span>
        ${badge(r.p, 40)}
        <span class="nm"><b>${esc(r.p.name)}</b><small>${esc(r.p.category)}${r.p.tier === "community" ? " · 社区" : ""}</small></span>
        <span class="cnt">${r.n === null ? esc(r.p.date || "") : `⬇ ${fmt(r.n)}`}</span>
      </a>`;
}

// 首页：精选
async function renderFeatured() {
  const box = document.getElementById("featured");
  if (!box) return;
  const [{ plugins }, st] = await Promise.all([loadData(), loadStats()]);
  box.innerHTML = plugins.filter((p) => p.status !== "planned").map((p) => card(p, st)).join("");
}

// 商店：筛选 + 排序。状态写进网址（?cat=…&q=…&sort=…），复制链接发给别人就是同一个筛选结果。
async function renderStore() {
  const box = document.getElementById("plist");
  if (!box) return;
  const [{ plugins }, st] = await Promise.all([loadData(), loadStats()]);
  const cats = ["全部", ...new Set(plugins.map((p) => p.category))];
  const qInput = document.getElementById("q");
  const params = new URLSearchParams(location.search);
  const defaultSort = Object.keys(st.plugins || {}).length ? "hot" : "new";
  let cat = cats.includes(params.get("cat")) ? params.get("cat") : "全部";
  let sort = ["hot", "new", "name"].includes(params.get("sort")) ? params.get("sort") : defaultSort;
  let qRaw = params.get("q") || "";
  qInput.value = qRaw;
  const chips = document.getElementById("chips");
  const syncUrl = () => {
    const u = new URLSearchParams();
    if (cat !== "全部") u.set("cat", cat);
    if (qRaw.trim()) u.set("q", qRaw.trim());
    if (sort !== defaultSort) u.set("sort", sort);
    const qs = u.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  };
  let lastCount = 0, searchTimer = 0;   // 当前结果数（埋点用）
  const draw = () => {
    chips.innerHTML = cats.map((c) => `<button class="chip ${c === cat ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("") +
      `<span class="chip-sep"></span>` +
      [["hot", "最热"], ["new", "最新"], ["name", "名称"]].map(([k, t]) => `<button class="chip ${k === sort ? "on" : ""}" data-s="${k}">${t}</button>`).join("");
    const q = qRaw.trim().toLowerCase();
    const list = plugins.filter((p) =>
      (cat === "全部" || p.category === cat) &&
      (p.name + p.en + p.summary).toLowerCase().includes(q));
    list.sort((a, b) => sort === "hot" ? total(st, b.id) - total(st, a.id) || a.name.localeCompare(b.name)
      : sort === "new" ? (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));
    box.innerHTML = list.length ? list.map((p) => card(p, st)).join("") : `<div class="empty">没有匹配的插件</div>`;
    lastCount = list.length;
    syncUrl();
  };
  chips.addEventListener("click", (e) => {
    const c = e.target.dataset.c, s = e.target.dataset.s;
    if (c) cat = c; if (s) sort = s;
    if (c || s) { draw(); if (window.thlTrack) window.thlTrack("store_filter", lastCount, c || s); }
  });
  qInput.addEventListener("input", (e) => {
    qRaw = e.target.value; draw();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { const v = qRaw.trim(); if (v.length >= 2 && window.thlTrack) window.thlTrack("store_search", lastCount, v); }, 1200);
  });
  draw();
}

// 插件详情页是静态生成的（plugins/<id>.html）；这里只把下载次数补上
async function hydrateStats() {
  const els = document.querySelectorAll("[data-dl]");
  if (!els.length) return;
  const st = await loadStats();
  els.forEach((el) => {
    const n = total(st, el.dataset.dl), w = week(st, el.dataset.dl);
    if (n > 0) el.textContent = `${fmt(n)} 次${w > 0 ? `（本周 ${fmt(w)}）` : ""}`;
  });
}

renderFeatured(); renderPopular(); renderStore(); hydrateStats();
