/* AI Database Viewer - Application Logic */
(function () {
  "use strict";

  /* --- State --- */
  let articles = [];
  let activeCategory = "all";
  let activeTags = [];
  let searchQuery = "";
  let currentView = "grid"; // 'grid' | 'detail'

  /* --- DOM refs --- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const dom = {
    sidebar: $("#sidebar"),
    sidebarClose: $("#sidebarClose"),
    menuBtn: $("#menuBtn"),
    overlay: $("#overlay"),
    categoryTree: $("#categoryTree"),
    activeTagsEl: $("#activeTags"),
    searchInput: $("#searchInput"),
    searchClear: $("#searchClear"),
    statTotal: $("#statTotal"),
    statFiltered: $("#statFiltered"),
    cardGrid: $("#cardGrid"),
    articleDetail: $("#articleDetail"),
    detailContent: $("#detailContent"),
    backBtn: $("#backBtn"),
    emptyState: $("#emptyState"),
  };

  /* --- Category metadata --- */
  const CATEGORIES = {
    A: { name: "生成モデル・システム", icon: "A", cls: "cat-a" },
    B: { name: "研究・論文", icon: "B", cls: "cat-b" },
    C: { name: "出版・ドキュメント", icon: "C", cls: "cat-c" },
    D: { name: "表現・応用芸術", icon: "D", cls: "cat-d" },
    E: { name: "法規制・ガバナンス", icon: "E", cls: "cat-e" },
    F: { name: "社会実装・メディア", icon: "F", cls: "cat-f" },
  };

  const TAG_CLASSES = {
    Org: "tag-org",
    Tech: "tag-tech",
    Domain: "tag-domain",
    Topic: "tag-topic",
    Status: "tag-status",
  };

  /* --- Initialise --- */
  async function init() {
    try {
      const res = await fetch("data/articles.json");
      articles = await res.json();
    } catch (e) {
      console.error("Failed to load articles:", e);
      articles = [];
    }
    sortByReleaseDate();
    assignUniqueIds();
    updateCounts();
    render();
    bindEvents();
  }

  /* --- Sort articles by releaseDate (newest first) --- */
  function sortByReleaseDate() {
    articles.sort((a, b) => {
      const da = a.releaseDate || "0000";
      const db = b.releaseDate || "0000";
      return db.localeCompare(da);
    });
  }

  /* --- Auto-assign unique IDs per category --- */
  function assignUniqueIds() {
    const counters = {};
    articles.forEach((a) => {
      const cat = a.category || "X";
      if (!counters[cat]) counters[cat] = 1;
      a.id = cat + String(counters[cat]).padStart(3, "0");
      counters[cat]++;
    });
  }

  /* --- Event binding --- */
  function bindEvents() {
    // Category clicks
    dom.categoryTree.addEventListener("click", (e) => {
      const btn = e.target.closest(".category-item");
      if (!btn) return;
      activeCategory = btn.dataset.category;
      $$(".category-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showGrid();
      render();
    });

    // Search
    dom.searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      dom.searchClear.classList.toggle("visible", searchQuery.length > 0);
      showGrid();
      render();
    });

    dom.searchClear.addEventListener("click", () => {
      dom.searchInput.value = "";
      searchQuery = "";
      dom.searchClear.classList.remove("visible");
      showGrid();
      render();
    });

    // Back button
    dom.backBtn.addEventListener("click", () => showGrid());

    // Mobile sidebar toggle
    dom.menuBtn.addEventListener("click", () => toggleSidebar(true));
    dom.sidebarClose.addEventListener("click", () => toggleSidebar(false));
    dom.overlay.addEventListener("click", () => toggleSidebar(false));
  }

  /* --- Sidebar mobile --- */
  function toggleSidebar(open) {
    dom.sidebar.classList.toggle("open", open);
    dom.overlay.classList.toggle("hidden", !open);
  }

  /* --- Filter logic --- */
  function filteredArticles() {
    return articles.filter((a) => {
      // Category filter
      if (activeCategory !== "all" && a.category !== activeCategory)
        return false;
      // Tag filter – must match ALL active tags
      for (const t of activeTags) {
        if (!a.tags.some((at) => at.type === t.type && at.value === t.value))
          return false;
      }
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = (
          a.title +
          " " +
          a.summary +
          " " +
          a.body
        ).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  /* --- Update category counts --- */
  function updateCounts() {
    const countAll = $("#countAll");
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    articles.forEach((a) => {
      if (counts[a.category] !== undefined) counts[a.category]++;
    });
    countAll.textContent = articles.length;
    Object.keys(counts).forEach((k) => {
      const el = $(`#count${k}`);
      if (el) el.textContent = counts[k];
    });
  }

  /* --- Render card grid --- */
  function render() {
    const items = filteredArticles();
    dom.statTotal.textContent = articles.length;
    dom.statFiltered.textContent = items.length;

    if (items.length === 0) {
      dom.cardGrid.classList.add("hidden");
      dom.emptyState.classList.remove("hidden");
      return;
    }

    dom.emptyState.classList.add("hidden");
    dom.cardGrid.classList.remove("hidden");
    dom.cardGrid.innerHTML = items.map((a, i) => cardHTML(a, i)).join("");

    // Bind card clicks
    dom.cardGrid.querySelectorAll(".article-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".tag")) return; // let tag clicks bubble separately
        const id = card.dataset.id;
        showDetail(id);
      });
    });

    // Bind tag clicks inside cards
    dom.cardGrid.querySelectorAll(".tag").forEach((tagEl) => {
      tagEl.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTag(tagEl.dataset.type, tagEl.dataset.value);
      });
    });
  }

  /* --- Card HTML --- */
  function cardHTML(a, index) {
    const cat = CATEGORIES[a.category] || {};
    const tagEls = a.tags
      .map((t) => {
        const cls = TAG_CLASSES[t.type] || "tag-status";
        const isActive = activeTags.some(
          (at) => at.type === t.type && at.value === t.value,
        );
        return `<button class="tag ${cls}${isActive ? " active" : ""}" data-type="${t.type}" data-value="${t.value}">[${t.type}] ${t.value}</button>`;
      })
      .join("");

    return `
      <div class="article-card" data-id="${a.id}" style="animation-delay:${index * 60}ms">
        <div class="card-header">
          <div class="card-category ${cat.cls}">${cat.icon}</div>
          <h3 class="card-title">${a.title}</h3>
        </div>
        <div class="card-meta">
          <span class="card-subcategory">${a.subcategory} ${a.subcategoryName}</span>
          <span class="card-date">${a.lastVerified}</span>
        </div>
        <p class="card-summary">${a.summary}</p>
        <div class="card-tags">${tagEls}</div>
      </div>`;
  }

  /* --- Tag toggle --- */
  function toggleTag(type, value) {
    const idx = activeTags.findIndex(
      (t) => t.type === type && t.value === value,
    );
    if (idx >= 0) {
      activeTags.splice(idx, 1);
    } else {
      activeTags.push({ type, value });
    }
    renderActiveTags();
    showGrid();
    render();
  }

  function renderActiveTags() {
    if (activeTags.length === 0) {
      dom.activeTagsEl.innerHTML = '<p class="no-tags">タグ未選択</p>';
      return;
    }
    dom.activeTagsEl.innerHTML = activeTags
      .map((t) => {
        const cls = TAG_CLASSES[t.type] || "tag-status";
        return `<button class="active-tag ${cls}" data-type="${t.type}" data-value="${t.value}">[${t.type}] ${t.value} <span class="remove-tag">✕</span></button>`;
      })
      .join("");

    dom.activeTagsEl.querySelectorAll(".active-tag").forEach((el) => {
      el.addEventListener("click", () => {
        toggleTag(el.dataset.type, el.dataset.value);
      });
    });
  }

  /* --- Show detail view --- */
  function showDetail(id) {
    const a = articles.find((x) => x.id === id);
    if (!a) return;
    currentView = "detail";
    dom.cardGrid.classList.add("hidden");
    dom.emptyState.classList.add("hidden");
    dom.articleDetail.classList.remove("hidden");

    const cat = CATEGORIES[a.category] || {};
    const tagEls = a.tags
      .map((t) => {
        const cls = TAG_CLASSES[t.type] || "tag-status";
        return `<button class="tag ${cls}" data-type="${t.type}" data-value="${t.value}">[${t.type}] ${t.value}</button>`;
      })
      .join("");

    const linkEls = a.links
      .map(
        (l) =>
          `<a class="detail-link" href="${l}" target="_blank" rel="noopener">🔗 ${l}</a>`,
      )
      .join("");

    dom.detailContent.innerHTML = `
      <div class="detail-header">
        <div class="detail-category-badge ${cat.cls}">${cat.icon} ${a.categoryName}</div>
        <h2 class="detail-title">${a.title}</h2>
        <div class="detail-summary">${a.summary}</div>
      </div>
      <div class="detail-body">${a.body}</div>
      <div class="detail-footer">
        <p class="detail-section-title">リンク</p>
        <div class="detail-links">${linkEls}</div>
        <p class="detail-section-title">タグ</p>
        <div class="detail-tags">${tagEls}</div>
        <p class="detail-section-title">最終確認日</p>
        <p class="detail-date">${a.lastVerified}</p>
      </div>`;

    // Tag clicks in detail
    dom.detailContent.querySelectorAll(".tag").forEach((el) => {
      el.addEventListener("click", () => {
        toggleTag(el.dataset.type, el.dataset.value);
        showGrid();
      });
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* --- Show grid view --- */
  function showGrid() {
    currentView = "grid";
    dom.articleDetail.classList.add("hidden");
    render();
  }

  /* --- Start --- */
  document.addEventListener("DOMContentLoaded", init);
})();
