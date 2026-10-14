// 天河落 THL — 标杆级视觉与交互引擎 (fx.js v3)
// 借鉴 Linear / Raycast / Vercel Geist：克制微光聚光灯、深空微粒、标杆主题切换、启动器模拟
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1. 顶部 2px 信号阅读进度条
  const prog = document.createElement("div");
  prog.className = "scroll-progress";
  document.body.prepend(prog);
  const updateProgress = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = h > 0 ? Math.min(100, (window.scrollY / h) * 100) + "%" : "0%";
  };
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  // 2. 导航栏标杆级主题切换器 (Linear 星靛 / Raycast 绯红 / Geist 翡翠)
  const THEMES = [
    { id: "", name: "Linear 星靛" },
    { id: "raycast", name: "Raycast 绯红" },
    { id: "emerald", name: "Geist 翡翠" }
  ];
  let savedTheme = "";
  try { savedTheme = localStorage.getItem("thl_theme") || ""; } catch {}
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);

  const navWrap = document.querySelector(".nav .wrap");
  if (navWrap && !document.getElementById("thl-theme-btn")) {
    const btn = document.createElement("button");
    btn.id = "thl-theme-btn";
    btn.type = "button";
    btn.className = "theme-switch";
    const curIdx = () => Math.max(0, THEMES.findIndex(t => t.id === (document.documentElement.getAttribute("data-theme") || "")));
    const renderBtn = () => {
      const t = THEMES[curIdx()];
      btn.innerHTML = `<span class="theme-dot"></span><span>${t.name}</span>`;
      btn.title = "切换设计标杆主题色";
    };
    renderBtn();
    btn.addEventListener("click", () => {
      const next = THEMES[(curIdx() + 1) % THEMES.length];
      if (next.id) document.documentElement.setAttribute("data-theme", next.id);
      else document.documentElement.removeAttribute("data-theme");
      try { localStorage.setItem("thl_theme", next.id); } catch {}
      renderBtn();
    });
    const dlBtn = navWrap.querySelector(".btn");
    if (dlBtn) navWrap.insertBefore(btn, dlBtn);
    else navWrap.appendChild(btn);
  }

  // 3. Linear 风格极克制深空星尘画布
  if (!reduce) {
    const cvs = document.createElement("canvas");
    cvs.className = "starfield-canvas";
    document.body.prepend(cvs);
    const ctx = cvs.getContext("2d");
    let w = (cvs.width = window.innerWidth);
    let h = (cvs.height = window.innerHeight);
    window.addEventListener("resize", () => {
      w = cvs.width = window.innerWidth;
      h = cvs.height = window.innerHeight;
    });
    const stars = Array.from({ length: 36 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.3,
      vy: Math.random() * 0.16 + 0.04,
      a: Math.random() * 0.45 + 0.1
    }));
    const drawStars = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y += s.vy;
        if (s.y > h) { s.y = -4; s.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.a})`;
        ctx.fill();
      }
      requestAnimationFrame(drawStars);
    };
    requestAnimationFrame(drawStars);
  }

  // 4. 滚动渐显 (.reveal)
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add("in");
      io.unobserve(e.target);
    }
  }), { threshold: 0.12 });
  const watch = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
  watch();
  new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });

  // 5. Linear 级卡片表面微光跟随 (--mx / --my)
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

  // 7. 首页启动器自动打字与交互演示
  const typed = document.getElementById("typed");
  if (!typed) return;
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
  loop();
})();
