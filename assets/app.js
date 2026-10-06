/* =========================================================
   UI layer — side panel, nav dock, audio
   ========================================================= */
(function () {
  const META = {
    about:    { num: "01", en: "About",        jp: "研究室紹介" },
    research: { num: "02", en: "Research",     jp: "研究内容"   },
    results:  { num: "03", en: "Publications", jp: "研究成果"   },
    members:  { num: "04", en: "Members",      jp: "メンバー"   },
    environment:    { num: "05", en: "Environment",     jp: "環境"       },
    access:   { num: "06", en: "Access",       jp: "アクセス"   },
    others:   { num: "07", en: "Beyond",       jp: "その他"     },
  };
  const NODE_OF = { about: 1, research: 2, results: 3, members: 4, environment: 5, access: 6, others: 7 };

  const body = document.body;
  const panel = document.querySelector(".panel");
  const elNum = panel.querySelector(".panel__eyebrow .num");
  const elEn = panel.querySelector(".panel__eyebrow .en");
  const elTitle = panel.querySelector(".panel__title");
  const elContent = panel.querySelector(".panel__content");
  const scroll = panel.querySelector(".panel__scroll");
  const dockItems = [...document.querySelectorAll(".dock__item")];
  let current = null;

  function setDock(id) {
    dockItems.forEach((it) => it.classList.toggle("active", it.dataset.section === id));
  }

  // Section HTML is pre-rendered at build time (scripts/build.mjs:
  // marked + KaTeX) into <article data-md="…"> inside #md-sources.
  function renderMarkdown(id) {
    const block = document.querySelector(`#md-sources [data-md="${id}"]`);
    return block ? block.innerHTML.trim() : "";
  }

  function fill(id) {
    const m = META[id];
    elNum.textContent = m.num;
    elEn.textContent = m.en;
    elTitle.textContent = m.jp;
    elContent.className = "panel__content md";
    elContent.innerHTML = renderMarkdown(id);
    setupImages();
    setupFrames();
    scroll.scrollTop = 0;
  }

  // markdown ![alt](path): real <img>, but until the file exists show a
  // styled placeholder that carries the alt text.
  function setupImages() {
    elContent.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      const toPlaceholder = () => {
        if (img.dataset.ph) return;
        img.dataset.ph = "1";
        const ph = document.createElement("div");
        ph.className = "imgph";
        const span = document.createElement("span");
        span.textContent = img.getAttribute("alt") || "Image";
        ph.appendChild(span);
        img.replaceWith(ph);
      };
      img.addEventListener("error", toPlaceholder);
      const src = img.getAttribute("src");
      if (!src || src === "#") { toPlaceholder(); return; }
      if (img.complete && img.naturalWidth === 0) toPlaceholder();
    });
  }

  // iframes (e.g. map) are stored as data-src so the hidden source copy
  // doesn't load them; activate only the copy shown in the panel.
  function setupFrames() {
    elContent.querySelectorAll("iframe[data-src]").forEach((f) => {
      f.src = f.dataset.src;
      f.removeAttribute("data-src");
    });
  }

  function open(id, nodeId) {
    if (!META[id]) return;
    const already = body.classList.contains("panel-open");
    if (already && current === id) return;
    if (already) {
      // swap content with a quick fade
      scroll.style.opacity = "0";
      setTimeout(() => { fill(id); scroll.style.opacity = "1"; }, 180);
    } else {
      fill(id);
      scroll.style.opacity = "1";
    }
    current = id;
    body.classList.add("panel-open");
    setDock(id);
    if (window.NCIL) {
      window.NCIL.setPanelOpen(true);
      const nid = nodeId != null ? nodeId : NODE_OF[id];
      if (nid != null) window.NCIL.focusNode(nid);
    }
  }

  function close() {
    body.classList.remove("panel-open");
    current = null;
    setDock(null);
    if (window.NCIL) { window.NCIL.setPanelOpen(false); window.NCIL.resetView(); }
  }

  // hook used by the 3d layer
  window.NCIL_openSection = open;

  panel.querySelector(".panel__close").addEventListener("click", close);
  document.querySelector(".scrim").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  dockItems.forEach((it) =>
    it.addEventListener("click", () => open(it.dataset.section, NODE_OF[it.dataset.section]))
  );

  // brand -> home
  document.querySelector(".brand").addEventListener("click", () => {
    close();
    if (window.NCIL) window.NCIL.fireAll();
  });

  /* ---------- audio ---------- */
  const audio = document.getElementById("labAudio");
  const btn = document.getElementById("audioBtn");
  const label = btn.querySelector(".audio-btn__label");
  audio.volume = 0.55;
  let playing = false;
  btn.addEventListener("click", () => {
    playing = !playing;
    if (playing) { audio.play().catch(() => {}); btn.classList.add("playing"); label.textContent = "Sound On"; }
    else { audio.pause(); btn.classList.remove("playing"); label.textContent = "Sound Off"; }
  });
})();
