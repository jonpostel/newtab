(function () {
  'use strict';

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

  function getFavicon(url) {
    try {
      return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(new URL(url).hostname) + '&sz=64';
    } catch {
      return '';
    }
  }

  function render() {
    const keyword = els.search.value.trim().toLowerCase();
    const filtered = sites.filter(s =>
      s.name.toLowerCase().includes(keyword) ||
      getDomain(s.url).toLowerCase().includes(keyword)
    );

    els.grid.innerHTML = '';

    filtered.forEach((site, index) => {
      const card = createSiteCard(site, index);
      els.grid.appendChild(card);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function createSiteCard(site, index) {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.dataset.id = site.id;
    const iconUrl = site.icon || getFavicon(site.url);
    const displayUrl = getDomain(site.url);
    const initial = site.name.charAt(0).toUpperCase();

    card.innerHTML = `
      <div class="actions">
        <button class="icon-btn edit" data-id="${site.id}" title="编辑">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="icon-btn move" data-id="${site.id}" title="移动（长按拖动）">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1.5"></circle><circle cx="9" cy="5" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>
        </button>
        <button class="icon-btn delete" data-id="${site.id}" title="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="icon">
        ${iconUrl ? `<img src="${iconUrl}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${initial}'">` : initial}
      </div>
      <div class="name">${escapeHtml(site.name)}</div>
      <div class="url">${escapeHtml(displayUrl)}</div>
    `;

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

    card.addEventListener('click', () => {
      window.location.href = site.url;
    });

    return card;
  }

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
      sites.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
      await Storage.saveSites(sites);
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

  async function load() {
    updateHeader();
    sites = await Storage.loadSites();
    render();
  }

  function openAdd() {
    els.modalTitle.textContent = '添加网站';
    els.form.reset();
    els.siteId.value = '';
    els.modal.classList.remove('hidden');
    els.siteName.focus();
  }

  function openEdit(site) {
    els.modalTitle.textContent = '编辑网站';
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
    if (!confirm('确定要删除这个网站吗？')) return;
    sites = sites.filter(s => s.id !== id);
    await Storage.saveSites(sites);
    render();
  }

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
          throw new Error('备份文件格式不正确');
        }
        if (!confirm(`确认导入 ${payload.sites.length} 个网站？这将覆盖当前所有数据。`)) {
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
        alert('导入成功');
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function updateHeader() {
    const hour = new Date().getHours();
    let text = '晚上好';
    if (hour >= 5 && hour < 12) text = '早上好';
    else if (hour >= 12 && hour < 18) text = '下午好';
    els.greeting.textContent = text;
    els.date.textContent = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
  }

  function bindEvents() {
    els.btnAdd.addEventListener('click', openAdd);
    els.btnCancel.addEventListener('click', closeModal);
    if (els.btnCancel2) els.btnCancel2.addEventListener('click', closeModal);
    els.form.addEventListener('submit', saveSite);
    els.search.addEventListener('input', render);

    els.siteUrl.addEventListener('input', () => {
      if (els.siteIcon.value.trim()) return;
      const url = normalizeUrl(els.siteUrl.value);
      if (!url) return;
      try {
        const hostname = new URL(url).hostname;
        els.siteIcon.value = `https://${hostname}/favicon.ico`;
      } catch {
        // ignore invalid URL
      }
    });

    els.btnBackup.addEventListener('click', backupData);
    els.btnImport.addEventListener('click', () => els.fileImport.click());
    els.fileImport.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importData(file);
      els.fileImport.value = '';
    });
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal || e.target.classList.contains('modal-backdrop')) closeModal();
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

      if (!dragState.dragging && distance > MOVE_THRESHOLD) {
        dragState.hasMoved = true;
        cancelPendingDrag();
        return;
      }

      if (dragState.dragging) {
        e.preventDefault();
        updateClonePosition(e.clientX, e.clientY);
        const insertIndex = getInsertIndex(e.clientX, e.clientY);
        movePlaceholder(insertIndex);
      }
    });

    els.grid.addEventListener('pointerup', async (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;

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
      if (dragState.dragging) {
        await endDrag();
      } else {
        cancelPendingDrag();
        dragState = null;
      }
    });
  }

  bindEvents();
  load();
})();
