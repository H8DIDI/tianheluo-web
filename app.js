// 公共：导航/页脚注入 + 插件数据渲染
const ICONS = { "市政管线": "◎", "数据处理": "▤", "建模辅助": "▦", "视图管理": "◫" };
const STATUS = { stable: "稳定版", beta: "测试版", planned: "计划中" };

const here = location.pathname.split("/").pop() || "index.html";
const navItem = (href, label, keys) =>
  `<a href="${href}" class="${keys.includes(here.replace(".html", "") || "index") ? "on" : ""}">${label}</a>`;

document.getElementById("nav").innerHTML = `
<div class="wrap">
  <a class="brand" href="/"><span class="logo">THL</span>天河落</a>
  <nav>
    ${navItem("/store.html", "插件商店", ["store", "plugin"])}
    ${navItem("/install.html", "安装指南", ["install"])}
    ${navItem("/#how", "工作方式", [])}
  </nav>
  <span class="sp"></span>
  <a class="btn sm pri" href="/install.html">获取宿主</a>
</div>`;

document.getElementById("foot").innerHTML = `
<div class="wrap">
  <div><b>天河落 Tianheluo</b>面向 Revit 的插件宿主与应用商店。<br>先从 Revit 2026 开始。</div>
  <div><b>产品</b><a href="/store.html">插件商店</a><a href="/install.html">安装指南</a></div>
  <div><b>联系</b><a href="mailto:hello@tianheluo.com">hello@tianheluo.com</a></div>
  <div class="copy">© 2026 天河落 · Revit 是 Autodesk, Inc. 的商标，本站与 Autodesk 无关联。</div>
</div>`;

async function loadData() {
  const r = await fetch("/plugins.json", { cache: "no-cache" });
  return r.json();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function card(p) {
  return `
  <a class="pc" href="/plugin.html?id=${encodeURIComponent(p.id)}">
    <div class="top"><span class="pic">${ICONS[p.category] || "◇"}</span>
      <h3>${esc(p.name)}<small>${esc(p.en)}</small></h3></div>
    <p>${esc(p.summary)}</p>
    <div class="meta"><span class="tag ${p.status}">${STATUS[p.status]}</span>
      <span class="tag">${esc(p.category)}</span><span class="tag">Revit ${esc(p.revit)}</span></div>
  </a>`;
}

// 首页：精选
async function renderFeatured() {
  const box = document.getElementById("featured");
  if (!box) return;
  const { plugins } = await loadData();
  box.innerHTML = plugins.filter((p) => p.status !== "planned").map(card).join("");
}

// 商店：筛选
async function renderStore() {
  const box = document.getElementById("plist");
  if (!box) return;
  const { plugins } = await loadData();
  const cats = ["全部", ...new Set(plugins.map((p) => p.category))];
  let cat = "全部", q = "";
  const chips = document.getElementById("chips");
  const draw = () => {
    chips.innerHTML = cats.map((c) => `<button class="chip ${c === cat ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
    const list = plugins.filter((p) =>
      (cat === "全部" || p.category === cat) &&
      (p.name + p.en + p.summary).toLowerCase().includes(q));
    box.innerHTML = list.length ? list.map(card).join("") : `<div class="empty">没有匹配的插件</div>`;
  };
  chips.addEventListener("click", (e) => { const c = e.target.dataset.c; if (c) { cat = c; draw(); } });
  document.getElementById("q").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  draw();
}

// 详情
async function renderDetail() {
  const box = document.getElementById("detail");
  if (!box) return;
  const id = new URLSearchParams(location.search).get("id");
  const { plugins } = await loadData();
  const p = plugins.find((x) => x.id === id);
  if (!p) { box.innerHTML = `<div class="empty">找不到这个插件。<a href="/store.html" style="color:var(--blue)">返回商店</a></div>`; return; }
  document.title = `${p.name} — 天河落`;
  const ready = p.status !== "planned" && p.download;
  box.innerHTML = `
  <div class="crumb"><a href="/store.html">插件商店</a> / ${esc(p.name)}</div>
  <div class="dh"><span class="pic">${ICONS[p.category] || "◇"}</span>
    <div><h1>${esc(p.name)}</h1><div class="meta" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
      <span class="tag ${p.status}">${STATUS[p.status]}</span><span class="tag">${esc(p.category)}</span></div></div></div>
  <p class="lead" style="margin:10px 0 0;text-align:left;max-width:680px">${esc(p.summary)}</p>
  <div class="dcols">
    <div class="stack">
      <div class="panel"><h4>介绍</h4><p style="color:var(--mute)">${esc(p.description)}</p></div>
      <div class="panel"><h4>功能</h4><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
      <div class="panel"><h4>安装</h4><p style="color:var(--mute)">下载后把文件放进宿主的 <code>Plugins</code> 文件夹，重启 Revit 即可。详见 <a href="/install.html" style="color:var(--blue)">安装指南</a>。</p></div>
    </div>
    <div class="panel"><dl class="kv">
      <dt>版本</dt><dd>${esc(p.version)}</dd><dt>适配</dt><dd>Revit ${esc(p.revit)}</dd>
      <dt>大小</dt><dd>${esc(p.size)}</dd><dt>更新</dt><dd>${esc(p.date)}</dd></dl>
      ${ready ? `<a class="btn pri" href="${esc(p.download)}" download>下载插件</a>`
              : `<a class="btn" aria-disabled="true">${p.status === "planned" ? "开发中" : "即将上架"}</a>`}
    </div>
  </div>`;
}

renderFeatured(); renderStore(); renderDetail();
