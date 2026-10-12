// 动效：滚动出现、鼠标跟随高光、启动器自动演示
(() => {
  // 滚动出现
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.15 });
  const watch = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
  watch();
  new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });

  // 鼠标跟随高光
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest && e.target.closest(".bn,.card,.pc");
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", e.clientX - r.left + "px");
    t.style.setProperty("--my", e.clientY - r.top + "px");
  });

  // 启动器演示
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
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
