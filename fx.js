// 天河落 THL — 交互与动效（fx.js v5 · 天河深海星轨）
// 1. 顶部阅读进度条   2. 清理旧版主题设置   3. 黄金分割轴网 + 微光水滴   4. 滚动渐显
// 5. 卡片光标追随   6. 代码一键复制   7. 首页启动器演示   8. 命令舱（Ctrl+K / ⌘K / "/"）
// 9. 使用统计（不设 Cookie；服务器会记录 IP 与城市，保留 180 天；浏览器开启“请勿追踪”或 GPC 时完全关闭）
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 9. 使用统计：事件发往同源的 /api/event，服务端只写入白名单事件（见 functions/api/event.js）
  const TRACK_OFF = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  const track = (n, v, x) => {
    if (TRACK_OFF) return;
    const body = JSON.stringify({
      n, p: location.pathname,
      v: v == null || !Number.isFinite(Number(v)) ? null : Number(v),
      x: x == null ? null : String(x).slice(0, 120),
    });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/event", body);
      else fetch("/api/event", { method: "POST", body, keepalive: true });
    } catch { /* 统计失败不影响页面 */ }
  };
  window.thlTrack = track;

  // 1. 顶部 2px 阅读进度条
  const prog = document.createElement("div");
  prog.className = "scroll-progress";
  document.body.prepend(prog);
  const updateProgress = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = h > 0 ? Math.min(100, (window.scrollY / h) * 100) + "%" : "0%";
  };
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  // 2. 旧版「换肤」残留清理（已取消多主题，只保留天河蓝）
  try { localStorage.removeItem("thl_theme"); } catch {}
  document.documentElement.removeAttribute("data-theme");

  // 3. 黄金分割轴网 + 微光水滴：沿 0.382 / 0.618 轴线缓缓落下，呼应 Logo 的螺线中心
  if (!reduce) {
    const PHI = (1 + Math.sqrt(5)) / 2;
    const cvs = document.createElement("canvas");
    cvs.className = "starfield-canvas";
    document.body.prepend(cvs);
    const ctx = cvs.getContext("2d");
    let w = 0, h = 0, dpr = 1, drops = [], raf = 0;
    const axes = () => [w / PHI / PHI, w / PHI]; // 0.382w、0.618w
    const spawn = () => {
      const n = Math.min(18, Math.round(w / 90));
      drops = Array.from({ length: n }, () => {
        const col = axes()[Math.random() < 0.5 ? 0 : 1];
        return { x: col + (Math.random() - 0.5) * 6, y: Math.random() * h, v: 0.12 + Math.random() * 0.22, r: 0.8 + Math.random() * 1.2, a: 0.15 + Math.random() * 0.35 };
      });
    };
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      cvs.width = w * dpr; cvs.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawn();
    };
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(63, 169, 255, 0.045)";
      ctx.lineWidth = 1;
      for (const x of axes()) { ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); ctx.stroke(); }
      for (const d of drops) {
        d.y += d.v;
        if (d.y > h + 6) { d.y = -6; d.x = axes()[Math.random() < 0.5 ? 0 : 1] + (Math.random() - 0.5) * 6; }
        ctx.beginPath();
        ctx.fillStyle = `rgba(63, 169, 255, ${d.a})`;
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", resize);
    // 标签页切到后台时停止计算，回来再继续（省电）
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    });
    resize();
    raf = requestAnimationFrame(frame);
  }

  // 4. 滚动渐显 (.reveal)
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  const watch = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
  watch();
  new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });

  // 5. 卡片表面微光跟随 (--mx / --my)
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest && e.target.closest(".bn,.card,.pc,.panel");
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", (e.clientX - r.left) + "px");
    t.style.setProperty("--my", (e.clientY - r.top) + "px");
  });

  // 6. 代码块与路径点击一键复制
  document.addEventListener("click", (e) => {
    const codeEl = e.target.closest && e.target.closest("pre, code.path");
    if (!codeEl || !navigator.clipboard) return;
    navigator.clipboard.writeText(codeEl.innerText.trim()).catch(() => {});
  });

  // 7. 首页启动器演示
  const typed = document.getElementById("typed");
  const items = [...document.querySelectorAll(".win .it")];
  const toast = document.getElementById("toast");
  const toastTxt = document.getElementById("toastTxt");
  const ph = document.getElementById("ph");
  const script = [
    { q: "井深", pick: "well-depth", msg: "已校正 12 口井 · Ctrl+Z 可整体撤销" },
    { q: "统计", pick: "count-elements", msg: "当前视图共 1,284 个构件" },
    { q: "备注", pick: "set-comments", msg: "已写入 36 个构件的注释" },
  ];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const show = (q, pick) => {
    ph.style.display = q ? "none" : "";
    items.forEach((it) => {
      const hit = !q || it.dataset.k.includes(q);
      it.classList.toggle("hide", !hit);
      it.classList.toggle("sel", hit && it.dataset.id === pick);
    });
  };
  async function loop() {
    if (reduce) { show("", "well-depth"); return; }
    for (;;) {
      for (const s of script) {
        show("", s.pick); typed.textContent = "";
        await sleep(900);
        for (const ch of s.q) { typed.textContent += ch; show(typed.textContent, s.pick); await sleep(220); }
        await sleep(700);
        toastTxt.textContent = s.msg; toast.classList.add("show");
        await sleep(2300); toast.classList.remove("show");
        await sleep(500);
        while (typed.textContent) { typed.textContent = typed.textContent.slice(0, -1); show(typed.textContent, s.pick); await sleep(90); }
      }
    }
  }
  if (typed) loop();

  // 8. 命令舱 HUD：全站任意页面按 Ctrl+K（Mac 为 ⌘K）或 "/" 呼出
  //    "/" 只在焦点不在输入框、可编辑区域时生效，避免打字时误触发。
  const hud = (() => {
    const STATIC = [
      { name: "插件商店", sub: "浏览全部插件", href: "/store", key: "插件商店 store 插件 下载" },
      { name: "安装指南", sub: "安装天河落宿主", href: "/install", key: "安装指南 install 宿主 下载" },
      { name: "开发者平台", sub: "用 AI 写插件并投稿", href: "/developers", key: "开发者 developers 投稿 AI" },
      { name: "AI 开发规范", sub: "给 Claude / ChatGPT 读的说明书", href: "/ai", key: "ai 规范 说明书 spec" },
      { name: "交流群与联系", sub: "加微信 didi 进群", href: "/contact", key: "交流群 联系 微信 contact" },
      { name: "隐私说明", sub: "数据怎么收集、不收集什么", href: "/privacy", key: "隐私 privacy 数据" },
    ];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    let root = null, input = null, list = null, shown = [], idx = 0, plugins = null, lastFocus = null;

    const build = () => {
      root = document.createElement("div");
      root.className = "hud";
      root.hidden = true;
      root.innerHTML = `<div class="hud-box" role="dialog" aria-modal="true" aria-label="搜索插件与页面">
        <input class="hud-in" type="search" placeholder="搜索插件、页面…" aria-label="搜索插件与页面" autocomplete="off" spellcheck="false" aria-controls="hud-list">
        <ul class="hud-list" id="hud-list" role="listbox"></ul>
        <div class="hud-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div>
      </div>`;
      document.body.appendChild(root);
      input = root.querySelector(".hud-in");
      list = root.querySelector(".hud-list");
      root.addEventListener("mousedown", (e) => { if (e.target === root) close(); });
      input.addEventListener("input", () => render());
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        else if (e.key === "Enter") {
          e.preventDefault();
          if (shown[idx]) { track("hud_pick", idx, shown[idx].href); location.assign(shown[idx].href); }
        }
        else if (e.key === "Escape") { e.preventDefault(); close(); }
        else if (e.key === "Tab") { e.preventDefault(); }   // 焦点留在搜索框里
      });
    };

    const loadPlugins = async () => {
      if (plugins) return plugins;
      try {
        window.__thlPlugins = window.__thlPlugins || fetch("/plugins.json", { cache: "no-cache" }).then((r) => r.json());
        const j = await window.__thlPlugins;
        plugins = (j.plugins || []).filter((p) => p.status !== "planned").map((p) => ({
          name: p.name, sub: `${p.en} · ${p.category}`, href: `/plugins/${p.id}`,
          key: `${p.name} ${p.en} ${p.id} ${p.category} ${p.summary || ""}`.toLowerCase(),
        }));
      } catch { plugins = []; }
      return plugins;
    };

    const render = () => {
      const q = input.value.trim().toLowerCase();
      const pool = [...STATIC, ...(plugins || [])];
      shown = pool.filter((x) => !q || x.key.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)).slice(0, 12);
      idx = Math.min(idx, Math.max(0, shown.length - 1));
      list.innerHTML = shown.length
        ? shown.map((x, i) => `<li role="option" aria-selected="${i === idx}"><a class="hud-it${i === idx ? " on" : ""}" href="${x.href}"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></a></li>`).join("")
        : `<li class="hud-empty">没有匹配的插件或页面</li>`;
    };

    const move = (d) => {
      if (!shown.length) return;
      idx = (idx + d + shown.length) % shown.length;
      list.querySelectorAll(".hud-it").forEach((a, i) => {
        a.classList.toggle("on", i === idx);
        a.parentElement.setAttribute("aria-selected", String(i === idx));
      });
      list.querySelectorAll(".hud-it")[idx].scrollIntoView({ block: "nearest" });
    };

    const open = async () => {
      if (!root) build();
      lastFocus = document.activeElement;
      root.hidden = false;
      document.body.style.overflow = "hidden";
      input.value = ""; idx = 0;
      render();
      input.focus();
      track("hud_open");
      await loadPlugins();
      render();
    };

    const close = () => {
      if (!root || root.hidden) return;
      const q = input.value.trim();
      if (q.length >= 2) track("hud_query", shown.length, q);   // 搜索了什么、有几条结果（无结果的词最能说明缺什么）
      root.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    const isOpen = () => !!root && !root.hidden;
    return { open, close, isOpen };
  })();

  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "k") {       // Ctrl+K / ⌘K 任何时候都可呼出或收起
      e.preventDefault();
      hud.isOpen() ? hud.close() : hud.open();
      return;
    }
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !hud.isOpen()) {
      const t = e.target;
      const editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!editable) { e.preventDefault(); hud.open(); }
    }
  });
  document.querySelectorAll("[data-hud]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); hud.open(); }));

  // 9b. 点击类事件（委托，不改动页面标记）
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a, button");
    if (!a) return;
    if (a.id === "copyPrompt") track("copy_prompt");
    else if (a.hasAttribute("download")) track("download_click", null, a.getAttribute("href"));
    else if (a.classList.contains("pc") || a.classList.contains("rk")) track("plugin_click", null, a.getAttribute("href"));
    else if (a.matches('a[href^="mailto:"], a[href*="github.com"], a[href="/contact"]')) track("contact_click", null, a.getAttribute("href"));
    else if (a.matches('a.btn.pri[href="/install"]')) track("install_click");
  });

  // 9c. 404 页面：记下访问的路径，以及来自本站的哪个页面（方便修正坏链接）
  if (document.body && document.body.hasAttribute("data-404")) {
    let from = "";
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.host === location.host) from = r.pathname;
    } catch {}
    track("hit_404", null, from);
  }

  // 9d. 页面性能与前端错误（浏览器不支持的指标会自动跳过）
  if (!TRACK_OFF) {
    window.addEventListener("error", (e) => track("js_error", null, (e.message || "unknown").slice(0, 100)));
    if ("PerformanceObserver" in window) {
      let lcp = null, cls = 0, sent = false;
      try { new PerformanceObserver((l) => { const last = l.getEntries().at(-1); if (last) lcp = last.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
      const flush = () => {
        if (sent) return;
        sent = true;
        if (lcp != null) track("vital_lcp", Math.round(lcp));
        track("vital_cls", Math.round(cls * 1000) / 1000);
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav) track("vital_ttfb", Math.round(nav.responseStart));
      };
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    }
  }
})();
