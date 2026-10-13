// 插件数据渲染 + 下载数 / 热门榜（页面主体已有静态版；这里用实时数据替换）
const STATUS = { stable: "稳定版", beta: "测试版", planned: "计划中" };
const CAT_COLOR = { "市政管线": "#2F8CFF", "出图打印": "#8B5CF6", "数据处理": "#10B981", "导出": "#F59E0B", "建模辅助": "#EC4899", "视图管理": "#06B6D4" };

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
  const base = p.color || CAT_COLOR[p.category] || "#3B9BFF";
  const g = p.glyph || (p.name || "T").replace(/^(一键|清理重复|清理|强电)/, "").slice(0, 1);
  const fs = g.length > 1 ? 0.3 : 0.5;
  return `<span class="pic" style="width:${size}px;height:${size}px;font-size:${Math.round(size * fs)}px;background:linear-gradient(135deg,${base},${base}99);border-color:${base}88;color:#fff;font-weight:800">${esc(g)}</span>`;
}

function card(p, st) {
  const n = total(st, p.id);
  return `
  <a class="pc" href="/plugins/${encodeURIComponent(p.id)}">
    <div class="top">${badge(p, 44)}
      <h3>${esc(p.name)}<small>${esc(p.en)}</small></h3></div>
    <p>${esc(p.summary)}</p>
    <div class="meta"><span class="tag ${p.status}">${STATUS[p.status]}</span>
      <span class="tag">${esc(p.category)}</span>${p.tier === "community" ? '<span class="tag community">社区</span>' : ""}${n > 0 ? `<span class="tag dl">⬇ ${fmt(n)}</span>` : ""}</div>
  </a>`;
}

// 热门榜：本周 / 总榜两个标签。还没有任何下载数据时，退化成“最新上架”。
async function renderPopular() {
  const box = document.getElementById("popular");
  if (!box) return;
  const limit = parseInt(box.dataset.limit || "5", 10);
  const [{ plugins }, st] = await Promise.all([loadData(), loadStats()]);
  const live = plugins.filter((p) => p.status !== "planned");
  let mode = "week";
  const draw = () => {
    const key = mode === "week" ? week : total;
    let rows = live.map((p) => ({ p, n: key(st, p.id) })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name)).slice(0, limit);
    let note = "";
    if (rows.length === 0) {
      rows = [...live].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, limit).map((p) => ({ p, n: null }));
      note = `<p class="rank-note">还没有下载数据，先展示最新上架的插件。第一批用户安装之后，这里会出现真实的榜单。</p>`;
    }
    box.querySelector(".rank-body").innerHTML = note + rows.map((r, i) => `
      <a class="rk" href="/plugins/${encodeURIComponent(r.p.id)}">
        <span class="no ${i < 3 && r.n ? "top" : ""}">${i + 1}</span>
        ${badge(r.p, 40)}
        <span class="nm"><b>${esc(r.p.name)}</b><small>${esc(r.p.category)}${r.p.tier === "community" ? " · 社区" : ""}</small></span>
        <span class="cnt">${r.n === null ? esc(r.p.date || "") : `⬇ ${fmt(r.n)}`}</span>
      </a>`).join("");
    box.querySelectorAll(".rank-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
  };
  box.innerHTML = `<div class="rank-tabs"><button data-m="week">本周热门</button><button data-m="all">总榜</button></div><div class="rank-body"></div>`;
  box.querySelector(".rank-tabs").addEventListener("click", (e) => { const m = e.target.dataset.m; if (m) { mode = m; draw(); } });
  draw();
}

// 首页：精选
async function renderFeatured() {
  const box = document.getElementById("featured");
  if (!box) return;
  const [{ plugins }, st] = await Promise.all([loadData(), loadStats()]);
  box.innerHTML = plugins.filter((p) => p.status !== "planned").map((p) => card(p, st)).join("");
}

// 商店：筛选 + 排序（有下载数据时默认按下载数）
async function renderStore() {
  const box = document.getElementById("plist");
  if (!box) return;
  const [{ plugins }, st] = await Promise.all([loadData(), loadStats()]);
  const cats = ["全部", ...new Set(plugins.map((p) => p.category))];
  let cat = "全部", q = "", sort = Object.keys(st.plugins || {}).length ? "hot" : "new";
  const chips = document.getElementById("chips");
  const draw = () => {
    chips.innerHTML = cats.map((c) => `<button class="chip ${c === cat ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("") +
      `<span class="chip-sep"></span>` +
      [["hot", "最热"], ["new", "最新"], ["name", "名称"]].map(([k, t]) => `<button class="chip ${k === sort ? "on" : ""}" data-s="${k}">${t}</button>`).join("");
    const list = plugins.filter((p) =>
      (cat === "全部" || p.category === cat) &&
      (p.name + p.en + p.summary).toLowerCase().includes(q));
    list.sort((a, b) => sort === "hot" ? total(st, b.id) - total(st, a.id) || a.name.localeCompare(b.name)
      : sort === "new" ? (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));
    box.innerHTML = list.length ? list.map((p) => card(p, st)).join("") : `<div class="empty">没有匹配的插件</div>`;
  };
  chips.addEventListener("click", (e) => { const c = e.target.dataset.c, s = e.target.dataset.s; if (c) cat = c; if (s) sort = s; if (c || s) draw(); });
  document.getElementById("q").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
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
