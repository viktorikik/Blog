// ============ Config ============
const PLATFORMS = {
  instagram: { name: 'Instagram', color: '#F27691', maxLength: 2200, hashtagLimit: 30 },
  telegram:  { name: 'Telegram',  color: '#DCEB32', maxLength: 4096 },
  vk:        { name: 'VK',        color: '#687B59', maxLength: 15000 },
  max:       { name: 'MAX',       color: '#292724', maxLength: 4096 },
  zen:       { name: 'Дзен',      color: '#292724', maxLength: 10000 },
};
const POST_STATUSES = {
  draft:     { label: 'Черновик',     color: 'var(--sage-light)' },
  review:    { label: 'На вычитке',   color: 'var(--coral)' },
  ready:     { label: 'Готово',       color: 'var(--lime)' },
  published: { label: 'Опубликовано', color: 'var(--graphite)' },
};
const IDEA_STATUSES = {
  new:      { label: 'Новая',     color: 'var(--sage-light)' },
  approved: { label: 'Одобрена',  color: 'var(--lime)' },
  in_work:  { label: 'В работе',  color: 'var(--coral)' },
  rejected: { label: 'Отклонена', color: '#d8cdbd' },
};
const SECTION_TITLES = {
  plan: 'Контент-план', posts: 'Все посты', ideas: 'Идеи',
  mission: 'Миссия', settings: 'Настройки',
};

// ============ DB ============
const DB_NAME = 'eshe-odna-galochka';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const old of ['drafts', 'draft_versions', 'content_plan']) {
        if (db.objectStoreNames.contains(old)) db.deleteObjectStore(old);
      }
      if (!db.objectStoreNames.contains('ideas')) db.createObjectStore('ideas', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('posts')) db.createObjectStore('posts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('post_versions')) {
        const s = db.createObjectStore('post_versions', { keyPath: 'id' });
        s.createIndex('postId', 'postId');
      }
      if (!db.objectStoreNames.contains('mission')) db.createObjectStore('mission', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function dbStore(db, store, mode) { return db.transaction(store, mode).objectStore(store); }
function dbGet(db, store, key) { return new Promise((res, rej) => { const r = dbStore(db, store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbPut(db, store, value) { return new Promise((res, rej) => { const r = dbStore(db, store, 'readwrite').put(value); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbDelete(db, store, key) { return new Promise((res, rej) => { const r = dbStore(db, store, 'readwrite').delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
function dbGetAll(db, store) { return new Promise((res, rej) => { const r = dbStore(db, store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbGetVersions(db, postId) {
  return new Promise((res, rej) => {
    const r = dbStore(db, 'post_versions').index('postId').getAll(postId);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// ============ Utils ============
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDateTime(ts) { return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function today() { return new Date().toISOString().slice(0, 10); }
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
}
function renderMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}
function insertMd(textarea, before, after, placeholder) {
  const s = textarea.selectionStart, e = textarea.selectionEnd;
  const sel = textarea.value.slice(s, e) || placeholder;
  textarea.value = textarea.value.slice(0, s) + before + sel + after + textarea.value.slice(e);
  textarea.focus();
  textarea.selectionStart = s + before.length;
  textarea.selectionEnd = s + before.length + sel.length;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

// ============ Swipe to delete ============
function setupSwipe(wrapper, onDelete) {
  const content = wrapper.querySelector('.swipe-content');
  let startX = 0, startY = 0, currentX = 0;
  let isSwiping = false;
  let isScrolling = false;
  let isOpen = false;

  // Перехватываем клик, если карточка открыта или если был свайп
  content.addEventListener('click', (e) => {
    if (isOpen) {
      e.preventDefault();
      e.stopPropagation();
      content.style.transition = 'transform 0.2s';
      content.style.transform = 'translateX(0px)';
      isOpen = false;
    } else if (isSwiping) {
      // Блокируем клик, если только что был свайп
      e.preventDefault();
      e.stopPropagation();
    }
    // Если ничего не открыто и свайпа не было, клик спокойно уходит дальше в handleGlobalClick
  });

  content.addEventListener('touchstart', e => {
    if (isOpen) return; 
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = false;
    isScrolling = false;
    content.style.transition = 'none';
  }, {passive: true});

  content.addEventListener('touchmove', e => {
    if (isOpen || isScrolling) return;
    
    currentX = e.touches[0].clientX;
    let currentY = e.touches[0].clientY;
    let diffX = currentX - startX;
    let diffY = currentY - startY;

    // Определяем намерение пользователя
    if (!isSwiping) {
      // Свайп срабатывает, только если движение по горизонтали больше 10px И больше, чем по вертикали
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
        isSwiping = true;
      } else if (Math.abs(diffY) > 10) {
        // Если движение по вертикали больше — это скролл, игнорируем
        isScrolling = true;
        return;
      }
    }

    if (isSwiping && diffX < 0) {
      e.preventDefault();
      let move = Math.max(-80, diffX);
      content.style.transform = `translateX(${move}px)`;
    }
  }, {passive: false});

  content.addEventListener('touchend', (e) => {
    if (isOpen || isScrolling) return;

    if (isSwiping) {
      let diffX = currentX - startX;
      content.style.transition = 'transform 0.2s';
      
      if (diffX < -40) {
        content.style.transform = 'translateX(-80px)';
        isOpen = true;
      } else {
        content.style.transform = 'translateX(0px)';
      }
      // Предотвращаем синтетический клик после свайпа
      e.preventDefault();
    }
    
    // Сбрасываем флаг с небольшой задержкой, чтобы клик не сработал случайно
    setTimeout(() => { isSwiping = false; }, 50);
  });

  // Кнопка удаления
  wrapper.querySelector('.swipe-delete').addEventListener('click', () => {
    content.style.transform = 'translateX(0px)';
    isOpen = false;
    onDelete();
  });
}

// ============ State ============
let db;
let currentTab = 'plan';
let pendingBackupCount = 0;

// ============ Init ============
async function init() {
  db = await openDB();
  let settings = await dbGet(db, 'settings', 'main');
  if (!settings) {
    settings = { id: 'main', lastBackupAt: null, pendingChanges: 0 };
    await dbPut(db, 'settings', settings);
  }
  pendingBackupCount = settings.pendingChanges || 0;
  updateBackupBadge();

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  document.addEventListener('click', handleGlobalClick);
  document.getElementById('backup-badge').addEventListener('click', sendBackup);
  document.getElementById('restore-file').addEventListener('change', handleRestoreFile);

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
  }

  const mission = await dbGet(db, 'mission', 'main');
  if (mission) document.getElementById('mission-body').value = mission.body || '';

  switchTab('plan');
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `section-${tab}`));
  document.getElementById('section-title').textContent = SECTION_TITLES[tab];
  if (tab === 'plan') renderPlan();
  if (tab === 'posts') renderPosts();
  if (tab === 'ideas') renderIdeas();
  if (tab === 'settings') renderSettings();
}

// ============ Global click ============
async function handleGlobalClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  switch (action) {
    case 'new-plan': openPostEditor('new', { prefillDate: true, openTab: 'meta' }); break;
    case 'new-post': openPostEditor('new', { openTab: 'text' }); break;
    case 'edit-post': openPostEditor(id); break;
    case 'new-idea': openIdeaEditor(null); break;
    case 'edit-idea': openIdeaEditor(id); break;
    case 'save-mission': saveMission(); break;
    case 'backup-now': sendBackup(); break;
    case 'restore-backup': document.getElementById('restore-file').click(); break;
  }
}

async function executeDeletePost(id) {
  await deletePost(id);
  await markChange();
  switchTab(currentTab);
}

async function executeDeleteIdea(id) {
  await dbDelete(db, 'ideas', id);
  await markChange();
  renderIdeas();
}

// ============ Post card ============
function buildPostCard(post, mode) {
  const status = POST_STATUSES[post.status] || POST_STATUSES.draft;
  const channelPills = (post.channels || []).map(ch => {
    const p = PLATFORMS[ch];
    return p ? `<span class="channel-pill" style="background:${p.color}; color: ${ch==='max'||ch==='zen'?'white':'var(--graphite)'}">${p.name}</span>` : '';
  }).join('');
  
  const tagsHtml = (post.tags || []).length
    ? `<div class="tags">${post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const seriesHtml = post.seriesName
    ? `<div class="card-series">📚 ${escapeHtml(post.seriesName)}${post.seriesPart ? ` · ч. ${post.seriesPart}${post.seriesTotal ? `/${post.seriesTotal}` : ''}` : ''}</div>`
    : '';
  const relatedCount = (post.relatedPostIds || []).length;
  const relatedHtml = relatedCount ? `<span class="card-related">🔗 ${relatedCount} ${relatedCount === 1 ? 'связь' : 'связей'}</span>` : '';
  const snippet = (post.body || '').replace(/[#*_`\[\]]/g, '').slice(0, 120);

  let metaLine = '';
  if (mode === 'plan' && post.publishDate) {
    metaLine = `<div class="card-date">📅 ${fmtDate(new Date(post.publishDate).getTime())}</div>`;
  } else if (mode === 'posts') {
    metaLine = `<div class="card-meta">Изменён ${fmtDateTime(post.updatedAt)}${post.publishDate ? ` · 📅 ${fmtDate(new Date(post.publishDate).getTime())}` : ''}</div>`;
  }

  // data-action="edit-post" навешан на весь swipe-content
  return `
    <div class="swipe-wrapper">
      <div class="swipe-actions">
        <button class="swipe-delete">
          <span style="font-size:1.2rem">🗑</span>
          Удалить
        </button>
      </div>
      <div class="swipe-content card" data-action="edit-post" data-id="${post.id}">
        <div class="card-row">
          ${channelPills}
          <span class="status-pill" style="background:${status.color}">${status.label}</span>
        </div>
        <h3 class="card-title">${escapeHtml(post.title || 'Без названия')}</h3>
        ${snippet ? `<p class="card-body">${escapeHtml(snippet)}${(post.body || '').length > 120 ? '…' : ''}</p>` : ''}
        ${seriesHtml}
        ${tagsHtml}
        ${metaLine}
        ${relatedHtml ? `<div style="margin-top:6px">${relatedHtml}</div>` : ''}
      </div>
    </div>`;
}

// ============ Plan view ============
async function renderPlan() {
  const all = await dbGetAll(db, 'posts');
  const plans = all.filter(p => p.publishDate);
  const t = today();
  plans.sort((a, b) => {
    const aPast = a.publishDate < t;
    const bPast = b.publishDate < t;
    if (aPast !== bPast) return aPast ? 1 : -1;
    if (aPast) return b.publishDate.localeCompare(a.publishDate);
    return a.publishDate.localeCompare(b.publishDate);
  });
  const el = document.getElementById('plan-list');
  if (!plans.length) { el.innerHTML = '<p class="empty">План пуст. Запланируйте первый пост или добавьте дату существующему.</p>'; return; }
  
  el.innerHTML = plans.map(p => buildPostCard(p, 'plan')).join('');
  
  el.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const id = wrapper.querySelector('.swipe-content').dataset.id;
    setupSwipe(wrapper, () => {
      if (confirm('Удалить этот пост?')) executeDeletePost(id);
    });
  });
}

// ============ Posts view ============
async function renderPosts() {
  const posts = await dbGetAll(db, 'posts');
  posts.sort((a, b) => b.updatedAt - a.updatedAt);
  const el = document.getElementById('posts-list');
  if (!posts.length) { el.innerHTML = '<p class="empty">Постов пока нет. Начните с нового.</p>'; return; }
  
  el.innerHTML = posts.map(p => buildPostCard(p, 'posts')).join('');
  
  el.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const id = wrapper.querySelector('.swipe-content').dataset.id;
    setupSwipe(wrapper, () => {
      if (confirm('Удалить этот пост?')) executeDeletePost(id);
    });
  });
}

// ============ Post editor ============
async function openPostEditor(id, opts = {}) {
  const isNew = id === 'new';
  let post;
  if (isNew) {
    post = {
      id: uid(), title: '', body: '', status: 'draft',
      publishDate: opts.prefillDate ? today() : '',
      channels: [], tags: [], seriesName: '', seriesPart: null, seriesTotal: null,
      relatedPostIds: [], ideaId: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  } else {
    post = await dbGet(db, 'posts', id);
  }
  if (!post) return toast('Пост не найден');

  const ideas = await dbGetAll(db, 'ideas');
  const allPosts = await dbGetAll(db, 'posts');
  const otherPosts = allPosts.filter(p => p.id !== post.id);
  const titleById = {};
  allPosts.forEach(p => { titleById[p.id] = p.title || 'Без названия'; });

  let selectedRelatedIds = [...(post.relatedPostIds || [])];
  let selectedChannels = [...(post.channels || [])];
  let currentPlatform = 'telegram';

  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal">
      <header class="modal-header">
        <button data-close>←</button>
        <h2>${isNew ? 'Новый пост' : 'Пост'}</h2>
        <div style="display:flex;gap:4px">
          ${isNew ? '' : '<button id="post-history" title="История версий">🕐</button>'}
          <button class="btn-primary" id="post-save">Сохранить</button>
        </div>
      </header>
      <div class="modal-tabs">
        <button class="modal-tab active" data-mode="text">Текст</button>
        <button class="modal-tab" data-mode="meta">Мета</button>
        <button class="modal-tab" data-mode="preview">Предпросмотр</button>
      </div>

      <div class="editor-view" data-view="text">
        <input id="post-title" class="title-input" type="text" placeholder="Заголовок поста" value="${escapeHtml(post.title)}">
        <div class="format-bar">
          <button data-md="bold" title="Жирный"><b>B</b></button>
          <button data-md="italic" title="Курсив"><i>I</i></button>
          <button data-md="link" title="Ссылка">🔗</button>
          <button data-md="list" title="Список">≡</button>
          <button data-md="h2" title="Подзаголовок">H2</button>
        </div>
        <textarea id="post-body" class="body-textarea" placeholder="Текст поста в Markdown. Хэштеги — в конце через #.">${escapeHtml(post.body)}</textarea>
      </div>

      <div class="editor-view hidden" data-view="meta">
        <label class="label">Статус</label>
        <select id="post-status">
          ${Object.entries(POST_STATUSES).map(([k, v]) => `<option value="${k}" ${post.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>

        <label class="label">Дата публикации (для плана)</label>
        <input id="post-date" type="date" value="${post.publishDate || ''}">

        <label class="label">Каналы</label>
        <div class="channels-picker">
          ${Object.entries(PLATFORMS).map(([k, v]) => `<button class="channel-toggle" data-channel="${k}" style="--toggle-color:${v.color}">${v.name}</button>`).join('')}
        </div>

        <label class="label">Идея</label>
        <select id="post-idea">
          <option value="">— без идеи —</option>
          ${ideas.map(i => `<option value="${i.id}" ${post.ideaId === i.id ? 'selected' : ''}>${escapeHtml(i.title)}</option>`).join('')}
        </select>

        <label class="label">Теги (через запятую)</label>
        <input id="post-tags" type="text" value="${escapeHtml((post.tags || []).join(', '))}" placeholder="лайфстайл, техника, личное">

        <label class="label">Серия (направленная связь)</label>
        <div class="series-row">
          <input id="series-name" type="text" placeholder="Название серии" value="${escapeHtml(post.seriesName || '')}">
          <input id="series-part" type="number" min="1" placeholder="Часть" value="${post.seriesPart || ''}">
          <input id="series-total" type="number" min="1" placeholder="Всего" value="${post.seriesTotal || ''}">
        </div>

        <label class="label">Связанные посты (двусторонние)</label>
        <div class="related-chips" id="related-chips"></div>
        <input id="related-search" type="text" placeholder="Найти пост по названию…">
        <div class="related-suggestions" id="related-suggestions"></div>
      </div>

      <div class="preview-view hidden" data-view="preview">
        <div class="platform-tabs">
          ${Object.entries(PLATFORMS).map(([k, v]) => `<button class="platform-tab" data-platform="${k}" style="--tab-color:${v.color}">${v.name}</button>`).join('')}
        </div>
        <div class="platform-preview" id="platform-preview"></div>
      </div>
    </div>`;

  const titleEl = root.querySelector('#post-title');
  const bodyEl = root.querySelector('#post-body');

  root.querySelectorAll('.modal-tab').forEach(t => {
    t.onclick = () => {
      root.querySelectorAll('.modal-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      root.querySelectorAll('[data-view]').forEach(v => v.classList.toggle('hidden', v.dataset.view !== t.dataset.mode));
      if (t.dataset.mode === 'preview') renderPreview();
    };
  });

  root.querySelectorAll('.format-bar button').forEach(b => {
    b.onclick = () => {
      const md = b.dataset.md;
      if (md === 'bold')   insertMd(bodyEl, '**', '**', 'жирный');
      if (md === 'italic') insertMd(bodyEl, '*', '*', 'курсив');
      if (md === 'link')   insertMd(bodyEl, '[', '](https://)', 'текст');
      if (md === 'list')   insertMd(bodyEl, '\n- ', '', 'пункт');
      if (md === 'h2')     insertMd(bodyEl, '\n## ', '', 'подзаголовок');
    };
  });

  function renderChannels() {
    root.querySelectorAll('.channel-toggle').forEach(btn => {
      btn.classList.toggle('active', selectedChannels.includes(btn.dataset.channel));
    });
  }
  root.querySelectorAll('.channel-toggle').forEach(btn => {
    btn.onclick = () => {
      const ch = btn.dataset.channel;
      if (selectedChannels.includes(ch)) {
        selectedChannels = selectedChannels.filter(x => x !== ch);
      } else {
        selectedChannels.push(ch);
      }
      renderChannels();
    };
  });
  renderChannels();

  function renderChips() {
    const el = root.querySelector('#related-chips');
    el.innerHTML = selectedRelatedIds.map(id => {
      const title = titleById[id] || 'Без названия';
      return `<span class="related-chip">${escapeHtml(title)}<button data-remove="${id}">×</button></span>`;
    }).join('');
    el.querySelectorAll('[data-remove]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        selectedRelatedIds = selectedRelatedIds.filter(x => x !== b.dataset.remove);
        renderChips();
      };
    });
  }
  function renderSuggestions(query) {
    const el = root.querySelector('#related-suggestions');
    if (!query || !query.trim()) { el.innerHTML = ''; return; }
    const q = query.toLowerCase();
    const matches = otherPosts
      .filter(p => !selectedRelatedIds.includes(p.id))
      .filter(p => (p.title || '').toLowerCase().includes(q))
      .slice(0, 10);
    if (!matches.length) {
      el.innerHTML = '<div class="related-suggestion" style="color:var(--muted);cursor:default">Ничего не найдено</div>';
      return;
    }
    el.innerHTML = matches.map(p => `<div class="related-suggestion" data-add="${p.id}">${escapeHtml(p.title || 'Без названия')}</div>`).join('');
    el.querySelectorAll('[data-add]').forEach(s => {
      s.onclick = () => {
        const rid = s.dataset.add;
        if (!selectedRelatedIds.includes(rid)) {
          selectedRelatedIds.push(rid);
          renderChips();
          root.querySelector('#related-search').value = '';
          renderSuggestions('');
        }
      };
    });
  }
  root.querySelector('#related-search').oninput = (e) => renderSuggestions(e.target.value);
  renderChips();

  async function renderPreview() {
    root.querySelectorAll('.platform-tab').forEach(t => t.classList.toggle('active', t.dataset.platform === currentPlatform));
    const relatedTitles = [];
    for (const rid of selectedRelatedIds) {
      const p = await dbGet(db, 'posts', rid);
      if (p) relatedTitles.push(p.title || 'Без названия');
    }
    const series = {
      name: root.querySelector('#series-name').value.trim(),
      part: parseInt(root.querySelector('#series-part').value) || null,
      total: parseInt(root.querySelector('#series-total').value) || null,
    };
    root.querySelector('#platform-preview').innerHTML =
      buildPreview(currentPlatform, titleEl.value, bodyEl.value, series, relatedTitles);
  }
  root.querySelectorAll('.platform-tab').forEach(t => {
    t.onclick = () => { currentPlatform = t.dataset.platform; renderPreview(); };
  });

  root.querySelector('[data-close]').onclick = () => {
    const changed = isNew
      ? (titleEl.value || bodyEl.value)
      : (post.title !== titleEl.value || post.body !== bodyEl.value);
    if (changed && !confirm('Есть несохранённые изменения. Выйти?')) return;
    closeModal();
    switchTab(currentTab);
  };

  if (!isNew) {
    root.querySelector('#post-history').onclick = () => showHistory(post.id);
  }

  root.querySelector('#post-save').onclick = async () => {
    post.title = titleEl.value.trim();
    post.body = bodyEl.value;
    post.status = root.querySelector('#post-status').value;
    post.publishDate = root.querySelector('#post-date').value || '';
    post.channels = [...selectedChannels];
    post.ideaId = root.querySelector('#post-idea').value || null;
    post.tags = root.querySelector('#post-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    post.seriesName = root.querySelector('#series-name').value.trim();
    if (post.seriesName) {
      post.seriesPart = parseInt(root.querySelector('#series-part').value) || null;
      post.seriesTotal = parseInt(root.querySelector('#series-total').value) || null;
    } else {
      post.seriesPart = null;
      post.seriesTotal = null;
    }
    post.updatedAt = Date.now();

    await dbPut(db, 'post_versions', {
      id: uid(), postId: post.id,
      title: post.title, body: post.body,
      status: post.status, channels: [...post.channels], tags: [...post.tags],
      seriesName: post.seriesName, seriesPart: post.seriesPart, seriesTotal: post.seriesTotal,
      publishDate: post.publishDate,
      savedAt: Date.now(),
      comment: isNew ? 'Создан' : 'Изменён',
    });

    await updateRelatedLinks(post.id, selectedRelatedIds);
    post.relatedPostIds = [...selectedRelatedIds];

    await dbPut(db, 'posts', post);
    await markChange();
    toast('Сохранено ✓');

    if (isNew) { closeModal(); switchTab('posts'); }
  };

  const initialTab = opts.openTab || 'text';
  if (initialTab === 'preview') {
    root.querySelector('[data-mode="preview"]').click();
  } else if (initialTab === 'meta') {
    root.querySelector('[data-mode="meta"]').click();
  }
}

async function updateRelatedLinks(postId, newIds) {
  const post = await dbGet(db, 'posts', postId);
  if (!post) return;
  const oldIds = post.relatedPostIds || [];
  const added = newIds.filter(id => !oldIds.includes(id));
  const removed = oldIds.filter(id => !newIds.includes(id));

  for (const otherId of added) {
    const other = await dbGet(db, 'posts', otherId);
    if (other) {
      other.relatedPostIds = [...(other.relatedPostIds || []), postId];
      other.updatedAt = Date.now();
      await dbPut(db, 'posts', other);
    }
  }
  for (const otherId of removed) {
    const other = await dbGet(db, 'posts', otherId);
    if (other) {
      other.relatedPostIds = (other.relatedPostIds || []).filter(id => id !== postId);
      other.updatedAt = Date.now();
      await dbPut(db, 'posts', other);
    }
  }
}

async function deletePost(id) {
  const others = await dbGetAll(db, 'posts');
  for (const p of others) {
    if (p.id !== id && (p.relatedPostIds || []).includes(id)) {
      p.relatedPostIds = p.relatedPostIds.filter(x => x !== id);
      p.updatedAt = Date.now();
      await dbPut(db, 'posts', p);
    }
  }
  const versions = await dbGetVersions(db, id);
  for (const v of versions) await dbDelete(db, 'post_versions', v.id);
  await dbDelete(db, 'posts', id);
}

function buildPreview(platform, title, body, series, relatedTitles) {
  const p = PLATFORMS[platform];
  const len = body.length;
  const over = len > p.maxLength;
  const hashtags = (body.match(/#[\wа-яё]+/gi) || []).length;
  const overHash = p.hashtagLimit && hashtags > p.hashtagLimit;
  const counter = `<div class="counter ${over ? 'over' : ''}">${len} / ${p.maxLength}${overHash ? ` · хэштегов ${hashtags}/${p.hashtagLimit}` : ''}</div>`;
  const md = renderMarkdown(body);
  const seriesLine = series.name
    ? `<div class="pf-line">📚 Серия: ${escapeHtml(series.name)}${series.part ? ` · ч. ${series.part}${series.total ? `/${series.total}` : ''}` : ''}</div>`
    : '';
  const relatedLine = relatedTitles.length
    ? `<div class="pf-line">🔗 Связанные посты: ${relatedTitles.map(t => escapeHtml(t)).join(', ')}</div>`
    : '';
  const footer = (seriesLine || relatedLine)
    ? `<div class="preview-footer">${seriesLine}${relatedLine}</div>`
    : '';

  if (platform === 'instagram') return `
    <div class="ig-preview">
      <div class="ig-header">
        <div class="ig-avatar" style="background:${p.color}">Е</div>
        <div class="ig-username">eshe.odna.galochka</div>
      </div>
      <div class="ig-image" style="background:${p.color}22;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.85rem">Изображение поста</div>
      <div class="ig-caption">
        ${title ? `<div class="ig-title"><strong>${escapeHtml(title)}</strong></div>` : ''}
        <div class="ig-text">${md}</div>
      </div>
      ${footer}
      ${counter}
    </div>`;

  if (platform === 'telegram' || platform === 'max') return `
    <div class="tg-preview">
      <div class="tg-bubble" style="border-left-color:${p.color}">
        ${title ? `<div class="tg-title">${escapeHtml(title)}</div>` : ''}
        <div class="tg-text">${md}</div>
      </div>
      ${footer}
      ${counter}
    </div>`;

  if (platform === 'vk') return `
    <div class="vk-preview">
      <div class="vk-header">
        <div class="vk-avatar" style="background:${p.color}">Е</div>
        <div><strong>Ещё одна галочка</strong><br><small style="color:var(--muted)">только что</small></div>
      </div>
      <div class="vk-text">${md}</div>
      ${footer}
      ${counter}
    </div>`;

  if (platform === 'zen') return `
    <div class="zen-preview">
      <h2 class="zen-title">${escapeHtml(title) || 'Заголовок публикации'}</h2>
      <div class="zen-text">${md}</div>
      ${footer}
      ${counter}
    </div>`;

  return '<p>Нет предпросмотра</p>';
}

async function showHistory(postId) {
  const versions = await dbGetVersions(db, postId);
  versions.sort((a, b) => b.savedAt - a.savedAt);
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal">
      <header class="modal-header">
        <button data-close>←</button>
        <h2>История версий</h2>
        <span style="width:40px"></span>
      </header>
      <div class="editor-view">
        ${!versions.length ? '<p class="empty">Версий пока нет</p>' : versions.map(v => `
          <div class="version-card">
            <div class="version-meta">${fmtDateTime(v.savedAt)} · ${escapeHtml(v.comment || '')}</div>
            <div class="version-title">${escapeHtml(v.title || '—')}</div>
            <div class="version-snippet">${escapeHtml((v.body || '').slice(0, 100))}${(v.body || '').length > 100 ? '…' : ''}</div>
            <div class="version-actions">
              <button data-view-id="${v.id}">Просмотр</button>
              <button class="btn-primary" data-restore-id="${v.id}" data-post-id="${postId}">Восстановить</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  root.querySelector('[data-close]').onclick = () => closeModal();
  root.querySelectorAll('[data-view-id]').forEach(b => {
    b.onclick = async () => {
      const v = await dbGet(db, 'post_versions', b.dataset.viewId);
      alert(`Версия от ${fmtDateTime(v.savedAt)}\n\n${v.title || '—'}\n\n${v.body || ''}`);
    };
  });
  root.querySelectorAll('[data-restore-id]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Восстановить эту версию? Текущее состояние сохранится в истории.')) return;
      const v = await dbGet(db, 'post_versions', b.dataset.restoreId);
      const post = await dbGet(db, 'posts', b.dataset.postId);
      await dbPut(db, 'post_versions', {
        id: uid(), postId: post.id,
        title: post.title, body: post.body,
        status: post.status, channels: [...(post.channels || [])], tags: [...(post.tags || [])],
        seriesName: post.seriesName, seriesPart: post.seriesPart, seriesTotal: post.seriesTotal,
        publishDate: post.publishDate,
        savedAt: Date.now(), comment: 'До восстановления',
      });
      post.title = v.title || '';
      post.body = v.body || '';
      post.status = v.status || post.status;
      post.channels = v.channels || post.channels;
      post.tags = v.tags || post.tags;
      post.seriesName = v.seriesName || '';
      post.seriesPart = v.seriesPart ?? null;
      post.seriesTotal = v.seriesTotal ?? null;
      post.publishDate = v.publishDate || '';
      post.updatedAt = Date.now();
      await dbPut(db, 'posts', post);
      await markChange();
      closeModal();
      toast('Восстановлено ✓');
      openPostEditor(post.id);
    };
  });
}

// ============ Ideas ============
async function renderIdeas() {
  const ideas = await dbGetAll(db, 'ideas');
  ideas.sort((a, b) => b.createdAt - a.createdAt);
  const list = document.getElementById('ideas-list');
  if (!ideas.length) { list.innerHTML = '<p class="empty">Пока пусто. Запишите первую идею.</p>'; return; }
  
  list.innerHTML = ideas.map(i => {
    const st = IDEA_STATUSES[i.status] || IDEA_STATUSES.new;
    return `
      <div class="swipe-wrapper">
        <div class="swipe-actions">
          <button class="swipe-delete">
            <span style="font-size:1.2rem">🗑</span>
            Удалить
          </button>
        </div>
        <div class="swipe-content card" data-action="edit-idea" data-id="${i.id}">
          <div class="card-row">
            <span class="status-pill" style="background:${st.color}">${st.label}</span>
          </div>
          <h3 class="card-title">${escapeHtml(i.title)}</h3>
          ${i.description ? `<p class="card-body">${escapeHtml(i.description)}</p>` : ''}
          ${i.tags ? `<div class="tags">${i.tags.split(',').map(t => `<span class="tag">${escapeHtml(t.trim())}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const id = wrapper.querySelector('.swipe-content').dataset.id;
    setupSwipe(wrapper, () => {
      if (confirm('Удалить эту идею?')) executeDeleteIdea(id);
    });
  });
}

async function openIdeaEditor(id) {
  let idea;
  if (!id) idea = { id: uid(), title: '', description: '', tags: '', status: 'new', createdAt: Date.now() };
  else idea = await dbGet(db, 'ideas', id);
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal">
      <header class="modal-header">
        <button data-close>←</button>
        <h2>${id ? 'Идея' : 'Новая идея'}</h2>
        <button class="btn-primary" id="save-idea">Сохранить</button>
      </header>
      <div class="editor-view">
        <label class="label">Заголовок</label>
        <input id="idea-title" type="text" value="${escapeHtml(idea.title)}" placeholder="О чём идея?">
        <label class="label">Описание</label>
        <textarea id="idea-desc" class="small-textarea" placeholder="Пара мыслей, контекст, ссылки">${escapeHtml(idea.description)}</textarea>
        <label class="label">Теги (через запятую)</label>
        <input id="idea-tags" type="text" value="${escapeHtml(idea.tags)}" placeholder="лайфстайл, техника, личное">
        <label class="label">Статус</label>
        <select id="idea-status">
          ${Object.entries(IDEA_STATUSES).map(([k, v]) => `<option value="${k}" ${idea.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>`;
  root.querySelector('[data-close]').onclick = closeModal;
  root.querySelector('#save-idea').onclick = async () => {
    idea.title = root.querySelector('#idea-title').value.trim();
    idea.description = root.querySelector('#idea-desc').value.trim();
    idea.tags = root.querySelector('#idea-tags').value.trim();
    idea.status = root.querySelector('#idea-status').value;
    if (!idea.title) return toast('Заголовок обязателен');
    await dbPut(db, 'ideas', idea);
    await markChange();
    closeModal();
    renderIdeas();
    toast('Сохранено ✓');
  };
}

async function saveMission() {
  const body = document.getElementById('mission-body').value;
  await dbPut(db, 'mission', { id: 'main', body, updatedAt: Date.now() });
  await markChange();
  toast('Сохранено ✓');
}

async function renderSettings() {
  const settings = await dbGet(db, 'settings', 'main');
  const el = document.getElementById('last-backup');
  el.textContent = settings?.lastBackupAt
    ? `Последний бэкап: ${fmtDateTime(settings.lastBackupAt)}`
    : 'Последний бэкап: —';
}

async function markChange() {
  const settings = await dbGet(db, 'settings', 'main');
  settings.pendingChanges = (settings.pendingChanges || 0) + 1;
  await dbPut(db, 'settings', settings);
  pendingBackupCount = settings.pendingChanges;
  updateBackupBadge();
}

function updateBackupBadge() {
  const badge = document.getElementById('backup-badge');
  const count = document.getElementById('backup-count');
  if (pendingBackupCount > 0) {
    badge.classList.remove('hidden');
    count.textContent = pendingBackupCount;
  } else {
    badge.classList.add('hidden');
  }
}

async function exportAll() {
  const result = { exportedAt: new Date().toISOString(), version: 2, app: 'eshe-odna-galochka' };
  for (const store of ['ideas', 'posts', 'post_versions', 'mission']) {
    result[store] = await dbGetAll(db, store);
  }
  return result;
}

async function sendBackup() {
  try {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `galochka-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const file = new File([blob], filename, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Бэкап «Ещё одна галочка»' });
      const settings = await dbGet(db, 'settings', 'main');
      settings.pendingChanges = 0;
      settings.lastBackupAt = Date.now();
      await dbPut(db, 'settings', settings);
      pendingBackupCount = 0;
      updateBackupBadge();
      if (currentTab === 'settings') renderSettings();
      toast('Бэкап отправлен ✓');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast('Файл скачан');
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('Ошибка: ' + e.message);
  }
}

async function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!confirm('Восстановить из бэкапа? Записи с совпадающими ID будут перезаписаны, остальные добавятся.')) {
      e.target.value = ''; return;
    }
    for (const store of ['ideas', 'posts', 'post_versions', 'mission']) {
      if (!Array.isArray(data[store])) continue;
      for (const item of data[store]) await dbPut(db, store, item);
    }
    toast('Восстановлено ✓');
    switchTab(currentTab);
  } catch (err) {
    alert('Ошибка восстановления: ' + err.message);
  }
  e.target.value = '';
}

init();
