// 公共：导航/页脚注入 + 插件数据渲染 + 下载数 / 热门榜
const STATUS = { stable: "稳定版", beta: "测试版", planned: "计划中" };
const CAT_COLOR = { "市政管线": "#2F8CFF", "出图打印": "#8B5CF6", "数据处理": "#10B981", "导出": "#F59E0B", "建模辅助": "#EC4899", "视图管理": "#06B6D4" };

const here = location.pathname.split("/").pop() || "index.html";
const navItem = (href, label, keys) =>
  `<a href="${href}" class="${keys.includes(here.replace(".html", "") || "index") ? "on" : ""}">${label}</a>`;

document.getElementById("nav").innerHTML = `
<div class="wrap">
  <a class="brand" href="/"><span class="logo">THL</span>天河落</a>
  <nav>
    ${navItem("/store.html", "插件商店", ["store", "plugin"])}
    ${navItem("/install.html", "安装指南", ["install"])}
    ${navItem("/developers", "开发者", ["developers", "ai"])}
    ${navItem("/contact", "交流群", ["contact"])}
    ${navItem("/#how", "工作方式", [])}
  </nav>
  <span class="sp"></span>
  <a class="btn sm pri" href="/install.html">下载宿主</a>
</div>`;

document.getElementById("foot").innerHTML = `
<div class="wrap">
  <div><b>天河落 Tianheluo</b>面向 Revit 的插件宿主与应用商店。<br>先从 Revit 2026 开始。</div>
  <div><b>产品</b><a href="/store.html">插件商店</a><a href="/install.html">安装指南</a><a href="https://github.com/H8DIDI/tianheluo-core" target="_blank" rel="noopener">GitHub · 宿主源码</a><a href="https://github.com/H8DIDI/tianheluo-web" target="_blank" rel="noopener">GitHub · 网站源码</a></div>
  <div><b>联系与投稿</b><a href="mailto:jiajiabimer@gmail.com">jiajiabimer@gmail.com</a><a href="/contact">加微信 · 交流群</a><a href="/developers">开发者 · 提交插件</a><a href="/ai">AI 开发规范</a></div>
  <div class="wx"><b>Revit 插件交流群</b><a href="/contact"><img src="/wechat-didi.png" alt="微信二维码 didi" width="104" height="104" loading="lazy"></a><span>加微信 didi，拉你进群：提建议、反馈体验、投稿插件</span></div>
  <div class="copy">© 2026 天河落 · Revit 是 Autodesk, Inc. 的商标，本站与 Autodesk 无关联。下载计数仅记录“某插件被下载了一次”，不保存你的 IP 或任何个人信息。</div>
</div>`;

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
  <a class="pc" href="/plugin.html?id=${encodeURIComponent(p.id)}">
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
      <a class="rk" href="/plugin.html?id=${encodeURIComponent(r.p.id)}">
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

// 详情
async function renderDetail() {
  const box = document.getElementById("detail");
  if (!box) return;
  const id = new URLSearchParams(location.search).get("id");
  const [{ plugins }, st] = await Promise.all([loadData(), loadStats()]);
  const p = plugins.find((x) => x.id === id);
  if (!p) { box.innerHTML = `<div class="empty">找不到这个插件。<a href="/store.html" style="color:var(--blue)">返回商店</a></div>`; return; }
  document.title = `${p.name} — 天河落`;
  const ready = p.status !== "planned" && p.download;
  const n = total(st, p.id), w = week(st, p.id);
  box.innerHTML = `
  <div class="crumb"><a href="/store.html">插件商店</a> / ${esc(p.name)}</div>
  <div class="dh">${badge(p, 72)}
    <div><h1>${esc(p.name)}</h1><div class="meta" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
      <span class="tag ${p.status}">${STATUS[p.status]}</span><span class="tag">${esc(p.category)}</span>${p.tier === "community" ? '<span class="tag community">社区</span>' : ""}</div></div></div>
  <p class="lead" style="margin:10px 0 0;text-align:left;max-width:680px">${esc(p.summary)}</p>
  <div class="dcols">
    <div class="stack">
      <div class="panel"><h4>介绍</h4><p style="color:var(--mute);white-space:pre-line">${esc(p.description)}</p></div>
      <div class="panel"><h4>功能</h4><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
      <div class="panel"><h4>怎么安装</h4><p style="color:var(--mute)"><b>推荐：</b>在 Revit 里打开「天河落 → 插件中心 → 商店」，找到它点「安装」，立刻能用，不用重启。<br>
        也可以先点右边「下载插件」得到 <code>.thlp</code> 文件，再在插件中心点「安装插件包…」选择它。还没装宿主？先看 <a href="/install.html" style="color:var(--blue)">安装指南</a>。<br>
        有新版本时，插件中心会提示「更新」，一键即可。</p></div>
    </div>
    <div class="panel"><dl class="kv">
      <dt>版本</dt><dd>${esc(p.version)}</dd><dt>适配</dt><dd>Revit ${esc(p.revit)}</dd>
      <dt>大小</dt><dd>${esc(p.size)}</dd><dt>更新</dt><dd>${esc(p.date)}</dd>
      <dt>下载</dt><dd>${n > 0 ? `${fmt(n)} 次${w > 0 ? `（本周 ${fmt(w)}）` : ""}` : "暂无"}</dd>
      ${p.author ? `<dt>原作者</dt><dd>${esc(p.author)}</dd>` : ""}
      ${p.license ? `<dt>开源许可</dt><dd>${esc(p.license)}</dd>` : ""}</dl>
      ${p.homepage ? `<p style="font-size:13px;color:var(--dim);margin:-6px 0 14px">基于开源项目，<a href="${esc(p.homepage)}" target="_blank" rel="noopener" style="color:var(--blue)">查看原项目</a>。</p>` : ""}
      ${ready ? `<a class="btn pri" href="${esc(p.download)}" download>下载插件</a>`
              : `<a class="btn" aria-disabled="true">${p.status === "planned" ? "开发中" : "即将上架"}</a>`}
    </div>
  </div>`;
}

renderFeatured(); renderPopular(); renderStore(); renderDetail();
