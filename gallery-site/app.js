/* ============================================
   GPT-Image-2 Prompt Gallery — Application
   Vanilla ES6+ · No dependencies
   ============================================ */

(() => {
  'use strict';

  /* ---------- State ---------- */
  const state = {
    allItems: [],
    filteredItems: [],
    currentCategory: '全部',
    searchQuery: '',
    visibleCount: 30,
    increment: 20,
    isLoading: false,
    pendingImages: 0,
  };

  /* ---------- DOM refs ---------- */
  const $ = (sel) => document.querySelector(sel);
  const dom = {
    gallery:      $('#gallery'),
    empty:        $('#gallery-empty'),
    loader:       $('#gallery-loader'),
    sentinel:     $('#gallery-sentinel'),
    tabs:         $('#category-tabs'),
    searchInput:  $('#search-input'),
    statCases:    $('#stat-cases'),
    statCats:     $('#stat-categories'),
    modal:        $('#modal'),
    modalImage:   $('#modal-image'),
    modalTitle:   $('#modal-title'),
    modalCategory:$('#modal-category'),
    modalSource:  $('#modal-source'),
    modalPrompt:  $('#modal-prompt'),
    modalClose:   $('#modal-close'),
    modalBackdrop:$('#modal-backdrop'),
    modalCopy:    $('#modal-copy'),
    copyText:     $('#copy-text'),
    toast:        $('#toast'),
  };

  /* ---------- Init ---------- */
  function init() {
    state.allItems = Array.isArray(window.GALLERY_DATA) ? window.GALLERY_DATA : [];
    state.filteredItems = [...state.allItems];
    renderStats();
    renderCategoryTabs();
    renderGallery();
    setupEventListeners();
    setupInfiniteScroll();
  }

  /* ---------- Stats ---------- */
  function renderStats() {
    const categories = new Set(state.allItems.map((d) => d.category));
    dom.statCases.textContent = state.allItems.length;
    dom.statCats.textContent = categories.size;
  }

  /* ---------- Category Tabs ---------- */
  function renderCategoryTabs() {
    const counts = {};
    state.allItems.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const allCount = state.allItems.length;

    const fragment = document.createDocumentFragment();

    // "全部" tab
    const allBtn = createTabButton('全部', allCount, true);
    fragment.appendChild(allBtn);

    sorted.forEach(([cat, count]) => {
      fragment.appendChild(createTabButton(cat, count, false));
    });

    dom.tabs.innerHTML = '';
    dom.tabs.appendChild(fragment);
  }

  function createTabButton(label, count, isActive) {
    const btn = document.createElement('button');
    btn.className = 'filter-tab' + (isActive ? ' active' : '');
    btn.dataset.category = label;
    btn.innerHTML = `${label}<span class="filter-tab__count">${count}</span>`;
    return btn;
  }

  /* ---------- Filtering ---------- */
  function filterItems() {
    const cat = state.currentCategory;
    const q = state.searchQuery.toLowerCase().trim();

    state.filteredItems = state.allItems.filter((item) => {
      const matchCat = cat === '全部' || item.category === cat;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.prompt && item.prompt.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });

    state.visibleCount = 30;
    renderGallery();
  }

  /* ---------- Render Gallery ---------- */
  function renderGallery() {
    const items = state.filteredItems.slice(0, state.visibleCount);

    // Toggle empty state
    if (state.filteredItems.length === 0) {
      dom.gallery.innerHTML = '';
      dom.empty.hidden = false;
      dom.loader.hidden = true;
      return;
    }
    dom.empty.hidden = true;

    const fragment = document.createDocumentFragment();
    items.forEach((item, i) => {
      fragment.appendChild(createCard(item, i));
    });

    dom.gallery.innerHTML = '';
    dom.gallery.appendChild(fragment);

    // Reset pending image counter for the new batch; updateLoaderVisibility
    // will be called as each image finishes loading.
    state.pendingImages = 0;
    updateLoaderVisibility();

    // Setup lazy loading for newly added images
    requestAnimationFrame(() => setupLazyLoad());
  }

  /* ---------- Card ---------- */
  function createCard(item, index) {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.animationDelay = `${Math.min(index * 0.04, 0.8)}s`;

    const promptPreview = item.prompt
      ? item.prompt.replace(/\n/g, ' ').slice(0, 100)
      : '';

    card.innerHTML = `
      <div class="card__image-wrap">
        <div class="card__shimmer"></div>
        <img class="card__image"
             data-src="${escapeAttr(item.image || '')}"
             alt="${escapeAttr(item.title || '')}"
             loading="lazy">
      </div>
      <div class="card__body">
        <span class="card__badge">${escapeHTML(item.category || '')}</span>
        <h3 class="card__title">${escapeHTML(item.title || '')}</h3>
        <p class="card__prompt-preview">${escapeHTML(promptPreview)}</p>
      </div>
    `;

    card.addEventListener('click', () => openModal(item));
    return card;
  }

  /* ---------- Lazy Load ---------- */
  function setupLazyLoad() {
    const images = dom.gallery.querySelectorAll('img[data-src]:not(.loaded)');
    if (!images.length) {
      updateLoaderVisibility();
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          const src = img.dataset.src;
          if (!src) return;

          state.pendingImages += 1;
          updateLoaderVisibility();

          img.src = src;
          img.onload = () => {
            img.classList.add('loaded');
            const shimmer = img.previousElementSibling;
            if (shimmer) shimmer.classList.add('hidden');
            state.pendingImages = Math.max(0, state.pendingImages - 1);
            updateLoaderVisibility();
          };
          img.onerror = () => {
            // Hide shimmer on error too; show placeholder
            const shimmer = img.previousElementSibling;
            if (shimmer) shimmer.classList.add('hidden');
            img.style.minHeight = '80px';
            img.style.background = 'var(--bg-tertiary)';
            img.classList.add('loaded');
            state.pendingImages = Math.max(0, state.pendingImages - 1);
            updateLoaderVisibility();
          };

          obs.unobserve(img);
        });
      },
      { rootMargin: '200px' }
    );

    images.forEach((img) => observer.observe(img));
  }

  /* ---------- Loader visibility ---------- */
  // Show the pulsing loader only when images are actively loading AND there
  // are more items to append. Once all currently visible images finish
  // loading, hide it — infinite-scroll is driven by a separate sentinel.
  function updateLoaderVisibility() {
    const hasMore = state.visibleCount < state.filteredItems.length;
    dom.loader.hidden = !(hasMore && state.pendingImages > 0);
  }

  /* ---------- Infinite Scroll ---------- */
  function setupInfiniteScroll() {
    const sentinel = dom.sentinel;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (state.isLoading) return;
        if (state.visibleCount >= state.filteredItems.length) return;
        loadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
  }

  function loadMore() {
    state.isLoading = true;
    const start = state.visibleCount;
    const end = Math.min(start + state.increment, state.filteredItems.length);
    state.visibleCount = end;

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      fragment.appendChild(createCard(state.filteredItems[i], i));
    }
    dom.gallery.appendChild(fragment);

    updateLoaderVisibility();
    state.isLoading = false;

    requestAnimationFrame(() => setupLazyLoad());
  }

  /* ---------- Modal ---------- */
  function openModal(item) {
    dom.modalImage.src = item.image || '';
    dom.modalImage.alt = item.title || '';
    dom.modalTitle.textContent = item.title || '';
    dom.modalCategory.textContent = item.category || '';
    dom.modalSource.textContent = item.source ? `来源: ${item.source}` : '';
    dom.modalPrompt.textContent = item.prompt || '';

    // Reset copy button
    dom.copyText.textContent = '复制';
    dom.modalCopy.classList.remove('copied');

    dom.modal.classList.add('open');
    dom.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Store current prompt for copy
    dom.modalCopy.dataset.prompt = item.prompt || '';
  }

  function closeModal() {
    dom.modal.classList.remove('open');
    dom.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  /* ---------- Copy Prompt ---------- */
  async function copyPrompt() {
    const text = dom.modalCopy.dataset.prompt || '';
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      dom.copyText.textContent = '已复制';
      dom.modalCopy.classList.add('copied');
      showToast('提示词已复制到剪贴板');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      dom.copyText.textContent = '已复制';
      dom.modalCopy.classList.add('copied');
      showToast('提示词已复制到剪贴板');
    }

    setTimeout(() => {
      dom.copyText.textContent = '复制';
      dom.modalCopy.classList.remove('copied');
    }, 2000);
  }

  /* ---------- Toast ---------- */
  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('visible');
    setTimeout(() => dom.toast.classList.remove('visible'), 1800);
  }

  /* ---------- Event Listeners ---------- */
  function setupEventListeners() {
    // Category tabs (event delegation)
    dom.tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;
      dom.tabs.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentCategory = tab.dataset.category;
      filterItems();
    });

    // Search input
    dom.searchInput.addEventListener(
      'input',
      debounce((e) => {
        state.searchQuery = e.target.value;
        filterItems();
      }, 300)
    );

    // Modal close
    dom.modalClose.addEventListener('click', closeModal);
    dom.modalBackdrop.addEventListener('click', closeModal);

    // Copy button
    dom.modalCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      copyPrompt();
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.modal.classList.contains('open')) {
        closeModal();
      }
    });
  }

  /* ---------- Utilities ---------- */
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', init);
})();
