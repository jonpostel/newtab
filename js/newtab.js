(function () {
  'use strict';

  /* ============================================================ i18n */
  const I18N = {
    en: {
      locale: 'en-US',
      docTitle: 'New Tab',
      skip: 'Skip to shortcuts',
      searchLabel: 'Search shortcuts',
      searchPlaceholder: 'Search shortcuts…',
      addTooltip: 'Add shortcut',
      backupTooltip: 'Back up data',
      importTooltip: 'Import data',
      close: 'Close',
      modalTitleAdd: 'Add Shortcut',
      modalTitleEdit: 'Edit Shortcut',
      fieldName: 'Name',
      fieldUrl: 'URL',
      fieldIcon: 'Icon URL (optional)',
      namePh: 'e.g. GitHub',
      urlPh: 'https://github.com',
      iconPh: 'https://github.com/favicon.ico',
      cancel: 'Cancel',
      save: 'Save',
      edit: 'Edit',
      move: 'Move (long-press to drag)',
      delete: 'Delete',
      greetingMorning: 'Good morning',
      greetingAfternoon: 'Good afternoon',
      greetingEvening: 'Good evening',
      confirmDelete: 'Delete this shortcut?',
      confirmImport: (n) => `Import ${n} shortcut(s)? This will overwrite all current data.`,
      importSuccess: 'Import succeeded',
      importFailed: 'Import failed: ',
      badFile: 'Invalid backup file format',
      emptyState: 'No shortcuts yet. Click + to add one.',
      noResults: 'No matching shortcuts.'
    },
    zh: {
      locale: 'zh-CN',
      docTitle: '新标签页',
      skip: '跳转到快捷方式',
      searchLabel: '搜索快捷方式',
      searchPlaceholder: '搜索快捷方式…',
      addTooltip: '添加快捷方式',
      backupTooltip: '备份数据',
      importTooltip: '导入数据',
      close: '关闭',
      modalTitleAdd: '添加快捷方式',
      modalTitleEdit: '编辑快捷方式',
      fieldName: '名称',
      fieldUrl: '网址',
      fieldIcon: '图标 URL（可选）',
      namePh: '例如：GitHub',
      urlPh: 'https://github.com',
      iconPh: 'https://github.com/favicon.ico',
      cancel: '取消',
      save: '保存',
      edit: '编辑',
      move: '移动（长按拖动）',
      delete: '删除',
      greetingMorning: '早上好',
      greetingAfternoon: '下午好',
      greetingEvening: '晚上好',
      confirmDelete: '确定要删除这个网站吗？',
      confirmImport: (n) => `确认导入 ${n} 个网站？这将覆盖当前所有数据。`,
      importSuccess: '导入成功',
      importFailed: '导入失败：',
      badFile: '备份文件格式不正确',
      emptyState: '暂无快捷方式。点击 + 添加一个。',
      noResults: '未找到匹配的快捷方式。'
    }
  };

  function detectLang() {
    const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^zh/i.test(l) ? 'zh' : 'en';
  }

  const lang = detectLang();
  const t = I18N[lang];
  const dateFormatter = new Intl.DateTimeFormat(t.locale, {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  /* ============================================================ State */
  let sites = [];
  let dragState = null;
  const LONG_PRESS_DURATION = 300;
  const MOVE_THRESHOLD = 5;

  const els = {
    grid: document.getElementById('siteGrid'),
    greeting: document.getElementById('greeting'),
    date: document.getElementById('date'),
    search: document.getElementById('searchInput'),
    btnAdd: document.getElementById('btnAdd'),
    btnBackup: document.getElementById('btnBackup'),
    btnImport: document.getElementById('btnImport'),
    fileImport: document.getElementById('fileImport'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    form: document.getElementById('siteForm'),
    siteId: document.getElementById('siteId'),
    siteName: document.getElementById('siteName'),
    siteUrl: document.getElementById('siteUrl'),
    siteIcon: document.getElementById('siteIcon'),
    btnCancel: document.getElementById('btnCancel'),
    btnCancel2: document.getElementById('btnCancel2')
  };

  /* ====================================================== i18n apply */
  function applyI18n() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t.docTitle;

    const skipLink = document.querySelector('.skip-link');
    if (skipLink) skipLink.textContent = t.skip;

    const searchLabel = document.querySelector('label[for="searchInput"]');
    if (searchLabel) searchLabel.textContent = t.searchLabel;
    els.search.placeholder = t.searchPlaceholder;
    els.search.setAttribute('aria-label', t.searchLabel);

    els.btnAdd.setAttribute('aria-label', t.addTooltip);
    els.btnAdd.setAttribute('data-tooltip', t.addTooltip);
    els.btnBackup.setAttribute('aria-label', t.backupTooltip);
    els.btnBackup.setAttribute('data-tooltip', t.backupTooltip);
    els.btnImport.setAttribute('aria-label', t.importTooltip);
    els.btnImport.setAttribute('data-tooltip', t.importTooltip);

    els.btnCancel.setAttribute('aria-label', t.close);
    if (els.btnCancel2) els.btnCancel2.textContent = t.cancel;
    const submitBtn = els.form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = t.save;

    setLabel(els.siteName, t.fieldName);
    setLabel(els.siteUrl, t.fieldUrl);
    setLabel(els.siteIcon, t.fieldIcon);
    els.siteName.placeholder = t.namePh;
    els.siteUrl.placeholder = t.urlPh;
    els.siteIcon.placeholder = t.iconPh;
  }

  function setLabel(input, text) {
    if (input.labels && input.labels[0]) input.labels[0].textContent = text;
  }

  /* ====================================================== Helpers */
  function normalizeUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ====================================================== Icon cache
   * Caches icon URL responses in the Cache API so that opening a new tab
   * does not re-issue a network request for every shortcut icon.
   * Session-level Map dedupes concurrent requests for the same URL.
   * Falls back to the raw URL when CORS blocks fetching (browser HTTP
   * cache may still help). */
  const ICON_CACHE_NAME = 'dark-new-tab-icons';
  const iconCache = new Map(); // iconUrl -> Promise<blobUrl|rawUrl|null>

  function loadIcon(iconUrl) {
    if (!iconUrl) return Promise.resolve(null);
    if (iconCache.has(iconUrl)) return iconCache.get(iconUrl);

    const promise = (async () => {
      try {
        const cache = await caches.open(ICON_CACHE_NAME);
        let response = await cache.match(iconUrl);

        if (!response) {
          response = await fetch(iconUrl, { mode: 'cors' });
          if (!response.ok) throw new Error('fetch failed: ' + response.status);
          // Clone before consuming blob so the response stays cacheable.
          await cache.put(iconUrl, response.clone());
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
      } catch (e) {
        // CORS or network failure — fall back to direct URL.
        // Browser HTTP cache may still serve it; we cannot persist it.
        return iconUrl;
      }
    })();

    iconCache.set(iconUrl, promise);
    return promise;
  }

  /* ====================================================== Render */
  function render() {
    const keyword = els.search.value.trim().toLowerCase();

    els.grid.innerHTML = '';

    if (sites.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = t.emptyState;
      els.grid.appendChild(empty);
      return;
    }

    // Precompute display data once per render to avoid repeated URL parsing.
    const view = sites.map(s => {
      const domain = getDomain(s.url);
      return {
        site: s,
        domain,
        nameLower: s.name.toLowerCase(),
        domainLower: domain.toLowerCase()
      };
    });

    const filtered = keyword
      ? view.filter(v => v.nameLower.includes(keyword) || v.domainLower.includes(keyword))
      : view;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = t.noResults;
      els.grid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(v => frag.appendChild(createSiteCard(v.site, v.domain)));
    els.grid.appendChild(frag);
  }

  function createSiteCard(site, domain) {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.dataset.id = site.id;
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${site.name} — ${domain}`);

    const iconUrl = site.icon || '';
    // Array.from correctly handles astral-plane characters (emoji, rare CJK)
    // that charAt(0) would split into broken surrogate halves.
    const initial = (Array.from(site.name)[0] || '').toUpperCase();

    card.innerHTML = `
      <div class="actions">
        <button type="button" class="icon-btn edit" data-id="${site.id}" aria-label="${escapeHtml(t.edit)}" title="${escapeHtml(t.edit)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button type="button" class="icon-btn move" data-id="${site.id}" aria-label="${escapeHtml(t.move)}" title="${escapeHtml(t.move)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="12" r="1.5"></circle><circle cx="9" cy="5" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>
        </button>
        <button type="button" class="icon-btn delete" data-id="${site.id}" aria-label="${escapeHtml(t.delete)}" title="${escapeHtml(t.delete)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="icon">${escapeHtml(initial)}</div>
      <div class="name">${escapeHtml(site.name)}</div>
      <div class="url">${escapeHtml(domain)}</div>
    `;

    // When an icon URL is provided, load it asynchronously from cache (or
    // fetch+cache). The card shows the initial character as placeholder until
    // the icon is ready, and falls back to the initial on load error.
    const iconEl = card.querySelector('.icon');
    if (iconUrl) {
      loadIcon(iconUrl).then(src => {
        // Card may have been removed from DOM by a re-render.
        if (!card.isConnected || !src) return;
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.width = 44;
        img.height = 44;
        img.addEventListener('error', () => { iconEl.textContent = initial; });
        iconEl.innerHTML = '';
        iconEl.appendChild(img);
      });
    }

    card.querySelector('.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openEdit(site);
    });
    card.querySelector('.move').addEventListener('click', (e) => {
      e.stopPropagation();
    });
    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSite(site.id);
    });

    const navigate = () => { window.location.href = site.url; };
    card.addEventListener('click', navigate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate();
      }
    });

    return card;
  }

  /* ====================================================== Drag & drop */
  function startDrag(card, site, clientX, clientY) {
    const rect = card.getBoundingClientRect();
    const clone = card.cloneNode(true);
    clone.classList.add('dragging');
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    document.body.appendChild(clone);

    card.classList.add('drag-placeholder');

    dragState.card = card;
    dragState.site = site;
    dragState.clone = clone;
    dragState.offsetX = clientX - rect.left;
    dragState.offsetY = clientY - rect.top;
    dragState.startX = clientX;
    dragState.startY = clientY;
    dragState.dragging = true;
    dragState.hasMoved = false;

    updateClonePosition(clientX, clientY);
  }

  function updateClonePosition(clientX, clientY) {
    if (!dragState) return;
    dragState.clone.style.transform = `translate(${clientX - dragState.startX}px, ${clientY - dragState.startY}px)`;
  }

  function getInsertIndex(clientX, clientY) {
    if (!dragState) return null;
    dragState.clone.style.visibility = 'hidden';
    const targetEl = document.elementFromPoint(clientX, clientY);
    dragState.clone.style.visibility = 'visible';

    const targetCard = targetEl ? targetEl.closest('.site-card') : null;
    if (!targetCard || targetCard === dragState.card) return null;

    const rect = targetCard.getBoundingClientRect();
    const midpointX = rect.left + rect.width / 2;
    const cards = Array.from(els.grid.children);
    const targetIndex = cards.indexOf(targetCard);

    if (targetIndex < 0) return null;
    return clientX < midpointX ? targetIndex : targetIndex + 1;
  }

  function movePlaceholder(toIndex) {
    if (toIndex === null) return;
    const cards = Array.from(els.grid.children);
    const currentIndex = cards.indexOf(dragState.card);

    if (currentIndex < 0) return;
    if (toIndex === currentIndex || toIndex === currentIndex + 1) return;

    if (toIndex < currentIndex) {
      els.grid.insertBefore(dragState.card, cards[toIndex]);
    } else {
      const insertAfter = cards[toIndex - 1];
      if (insertAfter && insertAfter !== dragState.card) {
        els.grid.insertBefore(dragState.card, insertAfter.nextSibling);
      }
    }
  }

  function suppressCardClick(card) {
    if (!card) return;
    function blockClick(e) {
      if (e.target.closest('.site-card') === card) {
        e.stopPropagation();
        e.preventDefault();
      }
      document.removeEventListener('click', blockClick, true);
    }
    document.addEventListener('click', blockClick, true);
  }

  async function endDrag() {
    if (!dragState) return;
    const card = dragState.card;

    if (dragState.clone) {
      dragState.clone.remove();
    }
    if (card) {
      card.classList.remove('drag-placeholder');
    }

    if (dragState.dragging) {
      const newOrderIds = Array.from(els.grid.children)
        .filter(c => c.classList.contains('site-card'))
        .map(c => c.dataset.id);
      const oldOrderIds = sites.map(s => s.id);
      const changed = newOrderIds.length !== oldOrderIds.length ||
        newOrderIds.some((id, i) => id !== oldOrderIds[i]);
      if (changed) {
        sites.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
        await Storage.saveSites(sites);
      }
    }

    dragState = null;
    suppressCardClick(card);
  }

  function cancelPendingDrag() {
    if (dragState && !dragState.dragging) {
      clearTimeout(dragState.timer);
      dragState = null;
    }
  }

  function getSiteById(id) {
    return sites.find(s => s.id === id);
  }

  /* ====================================================== Lifecycle */
  async function load() {
    updateHeader();
    sites = await Storage.loadSites();
    render();
  }

  function updateHeader() {
    const hour = new Date().getHours();
    let text = t.greetingEvening;
    if (hour >= 5 && hour < 12) text = t.greetingMorning;
    else if (hour >= 12 && hour < 18) text = t.greetingAfternoon;
    els.greeting.textContent = text;

    els.date.textContent = dateFormatter.format(new Date());
  }

  /* ====================================================== Modal */
  function openAdd() {
    els.modalTitle.textContent = t.modalTitleAdd;
    els.form.reset();
    els.siteId.value = '';
    els.modal.classList.remove('hidden');
    els.siteName.focus();
  }

  function openEdit(site) {
    els.modalTitle.textContent = t.modalTitleEdit;
    els.siteId.value = site.id;
    els.siteName.value = site.name;
    els.siteUrl.value = site.url;
    els.siteIcon.value = site.icon || '';
    els.modal.classList.remove('hidden');
    els.siteName.focus();
  }

  function closeModal() {
    els.modal.classList.add('hidden');
    els.form.reset();
  }

  async function saveSite(e) {
    e.preventDefault();
    const id = els.siteId.value;
    const name = els.siteName.value.trim();
    const url = normalizeUrl(els.siteUrl.value);
    let icon = els.siteIcon.value.trim();

    if (!name || !url) return;

    if (id) {
      const idx = sites.findIndex(s => s.id === id);
      if (idx >= 0) {
        sites[idx] = { id, name, url, icon };
      }
    } else {
      sites.push({ id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), name, url, icon });
    }

    await Storage.saveSites(sites);
    closeModal();
    render();
  }

  async function deleteSite(id) {
    if (!confirm(t.confirmDelete)) return;
    sites = sites.filter(s => s.id !== id);
    await Storage.saveSites(sites);
    render();
  }

  /* ====================================================== Backup / import */
  async function backupData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sites: sites
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dark_new_tab_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!payload || !Array.isArray(payload.sites)) {
          throw new Error(t.badFile);
        }
        if (!confirm(t.confirmImport(payload.sites.length))) {
          return;
        }
        sites = payload.sites.map(s => ({
          id: s.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
          name: String(s.name || '').trim(),
          url: normalizeUrl(s.url),
          icon: String(s.icon || '').trim()
        })).filter(s => s.name && s.url);
        await Storage.saveSites(sites);
        render();
        alert(t.importSuccess);
      } catch (err) {
        alert(t.importFailed + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* ====================================================== Events */
  let searchTimer = null;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 120);
  }

  let dragRafId = null;

  function bindEvents() {
    els.btnAdd.addEventListener('click', openAdd);
    els.btnCancel.addEventListener('click', closeModal);
    if (els.btnCancel2) els.btnCancel2.addEventListener('click', closeModal);
    els.form.addEventListener('submit', saveSite);
    els.search.addEventListener('input', onSearchInput);

    els.btnBackup.addEventListener('click', backupData);
    els.btnImport.addEventListener('click', () => els.fileImport.click());
    els.fileImport.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importData(file);
      els.fileImport.value = '';
    });
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal || e.target.hasAttribute('data-close')) closeModal();
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.classList.contains('hidden')) {
        closeModal();
      }
    });

    els.grid.addEventListener('pointerdown', (e) => {
      const moveBtn = e.target.closest('.icon-btn.move');
      if (!moveBtn || e.button !== 0) return;

      const card = moveBtn.closest('.site-card');
      if (!card) return;

      const site = getSiteById(card.dataset.id);
      if (!site) return;

      card.setPointerCapture(e.pointerId);

      dragState = {
        siteId: site.id,
        card: card,
        site: site,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        hasMoved: false
      };

      dragState.timer = setTimeout(() => {
        if (dragState && !dragState.hasMoved) {
          startDrag(card, site, e.clientX, e.clientY);
        }
      }, LONG_PRESS_DURATION);
    });

    els.grid.addEventListener('pointermove', (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const distance = Math.hypot(dx, dy);

      // Cancellation logic runs immediately (pre-drag threshold check).
      if (!dragState.dragging && distance > MOVE_THRESHOLD) {
        dragState.hasMoved = true;
        cancelPendingDrag();
        return;
      }

      if (dragState.dragging) {
        e.preventDefault();
        // Store latest pointer position; coalesce DOM work into one rAF.
        dragState.lastX = e.clientX;
        dragState.lastY = e.clientY;
        if (dragRafId) return;
        dragRafId = requestAnimationFrame(() => {
          dragRafId = null;
          if (!dragState || !dragState.dragging) return;
          const cx = dragState.lastX;
          const cy = dragState.lastY;
          updateClonePosition(cx, cy);
          const insertIndex = getInsertIndex(cx, cy);
          movePlaceholder(insertIndex);
        });
      }
    });

    els.grid.addEventListener('pointerup', async (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;

      // Flush any pending drag frame before finalizing.
      if (dragRafId) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }

      if (dragState.dragging) {
        e.preventDefault();
        await endDrag();
      } else {
        const card = dragState.card;
        cancelPendingDrag();
        suppressCardClick(card);
      }
    });

    els.grid.addEventListener('pointercancel', async (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      if (dragRafId) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }
      if (dragState.dragging) {
        await endDrag();
      } else {
        cancelPendingDrag();
        dragState = null;
      }
    });
  }

  /* ====================================================== Boot */
  applyI18n();
  bindEvents();
  load();
})();
