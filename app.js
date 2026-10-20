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
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const TEMPLATES = {
  'Личный опыт': '## С чем я столкнулся\n\nОпишите проблему или ситуацию.\n\n## Как я это решил\n\n- Шаг 1\n- Шаг 2\n- Шаг 3\n\n## Вывод\n\nКороткая мысль в конце.',
  'Обзор': '## Что это\n\nКороткое описание.\n\n## Плюсы\n- \n- \n\n## Минусы\n- \n- \n\n## Итог\n\nКому подойдёт?',
  'Чек-лист': 'Вот что нужно сделать:\n\n- [ ] Пункт 1\n- [ ] Пункт 2\n- [ ] Пункт 3\n\nА вы как справляетесь? Напишите в комментариях.'
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
function dbGetVersions(db, postId) { return new Promise((res, rej) => { const r = dbStore(db, 'post_versions').index('postId').getAll(postId); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

// ============ Utils ============
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDateTime(ts) { return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function today() { return new Date().toISOString().slice(0, 10); }
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('show'));
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
function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
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

async function processImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============ Swipe to delete ============
function setupSwipe(wrapper, onDelete) {
  const content = wrapper.querySelector('.swipe-content');
  let startX = 0, startY = 0, currentX = 0;
  let isSwiping = false, isScrolling = false, isOpen = false;
  let justSwiped = false; // Флаг для блокировки клика после свайпа

  content.addEventListener('click', (e) => {
    if (isOpen) {
      e.preventDefault(); 
      e.stopPropagation();
      content.style.transition = 'transform 0.2s'; 
      content.style.transform = 'translateX(0px)'; 
      isOpen = false;
      justSwiped = true; 
      setTimeout(() => { justSwiped = false; }, 100);
    } else if (justSwiped) {
      e.preventDefault(); 
      e.stopPropagation();
      justSwiped = false;
    }
  });

  content.addEventListener('touchstart', e => {
    if (isOpen) return; 
    startX = e.touches[0].clientX; 
    startY = e.touches[0].clientY;
    currentX = startX;
    isSwiping = false; 
    isScrolling = false; 
    justSwiped = false;
    content.style.transition = 'none';
  }, {passive: true});

  content.addEventListener('touchmove', e => {
    if (isOpen || isScrolling) return;
    currentX = e.touches[0].clientX;
    let currentY = e.touches[0].clientY;
    let diffX = currentX - startX;
    let diffY = currentY - startY;

    if (!isSwiping) {
      // Если сдвиг по вертикали больше, чем по горизонтали, это скролл
      if (Math.abs(diffY) > Math.abs(diffX)) {
        isScrolling = true;
        return;
      }
      // Если сдвинули влево больше чем на 15px — это свайп
      if (diffX < -15) { 
        isSwiping = true; 
      }
    }
    
    if (isSwiping) {
      e.preventDefault(); // Блокируем скролл и выделение
      content.style.transform = `translateX(${Math.max(-80, diffX)}px)`;
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
      justSwiped = true; 
      setTimeout(() => { justSwiped = false; }, 100);
    }
    setTimeout(() => { isSwiping = false; }, 50);
  });

  content.addEventListener('touchcancel', () => {
    isSwiping = false;
    isScrolling = false;
    justSwiped = false;
    content.style.transition = 'transform 0.2s';
    if (!isOpen) content.style.transform = 'translateX(0px)';
  });

  wrapper.querySelector('.swipe-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    content.style.transform = 'translateX(0px)'; 
    isOpen = false; 
    onDelete();
  });
}

// ============ State ============
let db;
let currentTab = 'plan';
let pendingBackupCount = 0;
let searchQuery = '';
let filterChannel = 'all';
let emailjsConfig = { service: '', template: '', publicKey: '' };
let planViewMode = 'list';
let postsViewMode = 'list';
let currentCalendarDate = new Date();

// ============ Init ============
async function init() {
  db = await openDB();
  let settings = await dbGet(db, 'settings', 'main');
  if (!settings) {
    settings = { id: 'main', lastBackupAt: null, pendingChanges: 0, emailjs: { service: '', template: '', publicKey: '' }, theme: 'light' };
    await dbPut(db, 'settings', settings);
  }
  pendingBackupCount = settings.pendingChanges || 0;
  updateBackupBadge();
  
  if (settings.emailjs) {
    emailjsConfig = settings.emailjs;
    if (emailjsConfig.publicKey && typeof emailjs !== 'undefined') {
      emailjs.init({ publicKey: emailjsConfig.publicKey });
    }
  }

  if (settings.theme === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-toggle').textContent = '☀️';
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.addEventListener('click', handleGlobalClick);
  document.getElementById('backup-badge').addEventListener('click', () => sendManualBackup());
  document.getElementById('restore-file').addEventListener('change', handleRestoreFile);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  setupFilters('plan');
  setupFilters('posts');
  setupViewToggles();

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
  }

  const mission = await dbGet(db, 'mission', 'main');
  if (mission) document.getElementById('mission-body').value = mission.body || '';

  switchTab('plan');
}

async function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
  const settings = await dbGet(db, 'settings', 'main');
  settings.theme = isDark ? 'dark' : 'light';
  await dbPut(db, 'settings', settings);
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

// ============ Filters & Views ============
function setupFilters(prefix) {
  const searchInput = document.getElementById(`search-${prefix}`);
  const chipsContainer = document.getElementById(`filter-${prefix}`);
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      prefix === 'plan' ? renderPlan() : renderPosts();
    });
  }

  if (chipsContainer) {
    Object.entries(PLATFORMS).forEach(([k, v]) => {
      const btn = document.createElement('button');
      btn.className = 'filter-chip';
      btn.dataset.filter = k;
      btn.textContent = v.name;
      chipsContainer.appendChild(btn);
    });

    chipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      chipsContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterChannel = chip.dataset.filter;
      prefix === 'plan' ? renderPlan() : renderPosts();
    });
  }
}

function setupViewToggles() {
  const planToggle = document.querySelector('#section-plan .view-toggle');
  if (planToggle) {
    planToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      planToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      planViewMode = btn.dataset.view === 'plan-calendar' ? 'calendar' : 'list';
      
      if (planViewMode === 'calendar') {
        document.getElementById('plan-filters').classList.add('hidden');
        document.getElementById('plan-list').classList.add('hidden');
        document.getElementById('plan-calendar').classList.remove('hidden');
      } else {
        document.getElementById('plan-filters').classList.remove('hidden');
        document.getElementById('plan-list').classList.remove('hidden');
        document.getElementById('plan-calendar').classList.add('hidden');
      }
      renderPlan();
    });
  }

  const postsToggle = document.querySelector('#section-posts .view-toggle');
  if (postsToggle) {
    postsToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      postsToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      postsViewMode = btn.dataset.view === 'posts-kanban' ? 'kanban' : 'list';
      
      if (postsViewMode === 'kanban') {
        document.getElementById('posts-filters').classList.add('hidden');
        document.getElementById('posts-list').classList.add('hidden');
        document.getElementById('posts-kanban').classList.remove('hidden');
      } else {
        document.getElementById('posts-filters').classList.remove('hidden');
        document.getElementById('posts-list').classList.remove('hidden');
        document.getElementById('posts-kanban').classList.add('hidden');
      }
      renderPosts();
    });
  }
}

function matchesFilter(post) {
  if (filterChannel !== 'all') {
    if (!post.channels || !post.channels.includes(filterChannel)) return false;
  }
  if (searchQuery) {
    const textToSearch = (post.title || '') + ' ' + (post.body || '');
    if (!textToSearch.toLowerCase().includes(searchQuery)) return false;
  }
  return true;
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
    case 'save-emailjs': saveEmailjsSettings(); break;
    case 'backup-now': sendManualBackup(); break;
    case 'restore-backup': document.getElementById('restore-file').click(); break;
    case 'copy-text': copyPostText(btn.dataset.platform); break;
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

// ============ Post Card ============
function buildPostCard(post, mode) {
  const status = POST_STATUSES[post.status] || POST_STATUSES.draft;
  const channelPills = (post.channels || []).map(ch => {
    const p = PLATFORMS[ch];
    return p ? `<span class="channel-pill" style="background:${p.color}; color: ${ch==='max'||ch==='zen'?'white':'#292724'}">${p.name}</span>` : '';
  }).join('');
  
  const tagsHtml = (post.tags || []).length ? `<div class="tags">${post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';
  const seriesHtml = post.seriesName ? `<div class="card-series">📚 ${escapeHtml(post.seriesName)}${post.seriesPart ? ` · ч. ${post.seriesPart}${post.seriesTotal ? `/${post.seriesTotal}` : ''}` : ''}</div>` : '';
  const relatedCount = (post.relatedPostIds || []).length;
  const relatedHtml = relatedCount ? `<span class="card-related">🔗 ${relatedCount} ${relatedCount === 1 ? 'связь' : 'связей'}</span>` : '';
  const snippet = (post.body || '').replace(/[#*_`\[\]]/g, '').slice(0, 120);

  let metaLine = '';
  if (mode === 'plan' && post.publishDate) {
    metaLine = `<div class="card-date">📅 ${fmtDate(new Date(post.publishDate).getTime())}</div>`;
  } else if (mode === 'posts') {
    metaLine = `<div class="card-meta">Изменён ${fmtDateTime(post.updatedAt)}${post.publishDate ? ` · 📅 ${fmtDate(new Date(post.publishDate).getTime())}` : ''}</div>`;
  }

  let warningHtml = '';
  if (post.status === 'ready' || post.status === 'published') {
    const c = post.checklist || {};
    if (!c.text || !c.image || !c.links || !c.tags) {
      warningHtml = `<div class="card-warning">⚠️ Чек-лист не заполнен</div>`;
    }
  }

  const coverHtml = post.coverImage ? `<img src="${post.coverImage}" class="card-cover" alt="">` : '';

  return `
    <div class="swipe-wrapper">
      <div class="swipe-actions">
        <button class="swipe-delete"><span style="font-size:1.2rem">🗑</span>Удалить</button>
      </div>
      <div class="swipe-content card" data-action="edit-post" data-id="${post.id}">
        ${coverHtml}
        <div class="card-row">
          ${channelPills}
          <span class="status-pill" style="background:${status.color}">${status.label}</span>
        </div>
        <h3 class="card-title">${escapeHtml(post.title || 'Без названия')}</h3>
        ${snippet ? `<p class="card-body">${escapeHtml(snippet)}${(post.body || '').length > 120 ? '…' : ''}</p>` : ''}
        ${warningHtml}
        ${seriesHtml}
        ${tagsHtml}
        ${metaLine}
        ${relatedHtml ? `<div style="margin-top:6px">${relatedHtml}</div>` : ''}
      </div>
    </div>`;
}

// ============ Plan View ============
async function renderPlan() {
  if (planViewMode === 'calendar') {
    renderCalendar();
    return;
  }
  
  const all = await dbGetAll(db, 'posts');
  // Показываем посты с датой, кроме опубликованных
  let plans = all.filter(p => p.publishDate && p.status !== 'published' && matchesFilter(p));
  const t = today();
  plans.sort((a, b) => {
    const aPast = a.publishDate < t, bPast = b.publishDate < t;
    if (aPast !== bPast) return aPast ? 1 : -1;
    if (aPast) return b.publishDate.localeCompare(a.publishDate);
    return a.publishDate.localeCompare(b.publishDate);
  });
  const el = document.getElementById('plan-list');
  if (!plans.length) { el.innerHTML = '<p class="empty">Ничего не найдено или план пуст.</p>'; return; }
  
  el.innerHTML = plans.map(p => buildPostCard(p, 'plan')).join('');
  el.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const id = wrapper.querySelector('.swipe-content').dataset.id;
    setupSwipe(wrapper, () => { if (confirm('Удалить этот пост?')) executeDeletePost(id); });
  });
}

// ============ Calendar Render ============
async function renderCalendar() {
  const all = await dbGetAll(db, 'posts');
  // В календаре тоже не показываем опубликованные
  const plans = all.filter(p => p.publishDate && p.status !== 'published');
  
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = lastDay.getDate();
  
  let html = `
    <div class="cal-header">
      <button class="cal-nav-btn" id="cal-prev">←</button>
      <span>${MONTH_NAMES[month]} ${year}</span>
      <button class="cal-nav-btn" id="cal-next">→</button>
    </div>
    <div class="cal-grid">
  `;
  
  DAY_NAMES.forEach(d => html += `<div class="cal-day-name">${d}</div>`);
  
  for (let i = 0; i < startDayOfWeek; i++) {
    html += `<div class="cal-day" style="opacity:0.3"></div>`;
  }
  
  const todayStr = today();
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayPosts = plans.filter(p => p.publishDate === dateStr);
    const isToday = dateStr === todayStr;
    
    const dots = dayPosts.map(p => {
      const ch = p.channels && p.channels.length > 0 ? p.channels[0] : 'max';
      return `<div class="cal-dot" style="background:${PLATFORMS[ch]?.color || '#292724'}"></div>`;
    }).slice(0, 4).join('');
    
    html += `<div class="cal-day ${isToday?'today':''} ${dayPosts.length?'has-posts':''}" data-date="${dateStr}">
      ${d}
      <div class="cal-dots">${dots}</div>
    </div>`;
  }
  
  html += `</div><div id="cal-day-details" class="cal-day-posts"></div>`;
  document.getElementById('plan-calendar').innerHTML = html;
  
  document.getElementById('cal-prev').onclick = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); };
  document.getElementById('cal-next').onclick = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); };
  
  document.querySelectorAll('.cal-day[data-date]').forEach(cell => {
    cell.onclick = () => {
      const date = cell.dataset.date;
      const posts = plans.filter(p => p.publishDate === date);
      if (!posts.length) return;
      
      const detailsEl = document.getElementById('cal-day-details');
      detailsEl.innerHTML = `<h3 style="margin-bottom:12px;font-size:1rem">Посты на ${fmtDate(new Date(date).getTime())}</h3>` +
        posts.map(p => buildPostCard(p, 'plan')).join('');
        
      detailsEl.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
        const id = wrapper.querySelector('.swipe-content').dataset.id;
        setupSwipe(wrapper, () => { if (confirm('Удалить этот пост?')) executeDeletePost(id); });
      });
    };
  });
}

// ============ Posts View ============
async function renderPosts() {
  if (postsViewMode === 'kanban') {
    renderKanban();
    return;
  }

  const posts = await dbGetAll(db, 'posts');
  let filtered = posts.filter(matchesFilter);
  filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  const el = document.getElementById('posts-list');
  if (!filtered.length) { el.innerHTML = '<p class="empty">Ничего не найдено.</p>'; return; }
  
  el.innerHTML = filtered.map(p => buildPostCard(p, 'posts')).join('');
  el.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const id = wrapper.querySelector('.swipe-content').dataset.id;
    setupSwipe(wrapper, () => { if (confirm('Удалить этот пост?')) executeDeletePost(id); });
  });
}

// ============ Kanban Render ============
async function renderKanban() {
  const posts = await dbGetAll(db, 'posts');
  const filtered = posts.filter(p => {
    if (!searchQuery) return true;
    return ((p.title || '') + ' ' + (p.body || '')).toLowerCase().includes(searchQuery);
  });

  const columns = ['draft', 'review', 'ready', 'published'];
  const kanbanEl = document.getElementById('posts-kanban');
  
  let html = '';
  columns.forEach(statusKey => {
    const statusInfo = POST_STATUSES[statusKey];
    const colPosts = filtered.filter(p => p.status === statusKey).sort((a,b) => b.updatedAt - a.updatedAt);
    
    html += `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span>${statusInfo.label}</span>
          <span class="kanban-count">${colPosts.length}</span>
        </div>
        <div class="kanban-cards">
          ${colPosts.map(p => buildPostCard(p, 'kanban')).join('')}
        </div>
      </div>
    `;
  });
  
  kanbanEl.innerHTML = html;
  
  kanbanEl.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const id = wrapper.querySelector('.swipe-content').dataset.id;
    setupSwipe(wrapper, () => { if (confirm('Удалить этот пост?')) executeDeletePost(id); });
  });
}

// ============ Copy logic ============
function copyPostText(platform) {
  const title = document.querySelector('#post-title').value.trim();
  const body = document.querySelector('#post-body').value;
  let textToCopy = '';
  
  if (platform === 'telegram' || platform === 'vk') {
    textToCopy = platform === 'telegram' ? `${title ? title+'\n\n' : ''}${body}` : stripMarkdown(`${title ? title+'\n\n' : ''}${body}`);
  } else if (platform === 'zen') {
    textToCopy = stripMarkdown(body);
  } else {
    textToCopy = stripMarkdown(`${title ? title+'\n\n' : ''}${body}`);
  }
  
  navigator.clipboard.writeText(textToCopy).then(() => {
    toast(`Скопировано для ${PLATFORMS[platform].name} ✓`);
  }).catch(err => {
    toast('Ошибка копирования');
  });
}

// ============ Post Editor ============
async function openPostEditor(id, opts = {}) {
  const isNew = id === 'new';
  let post;
  if (isNew) {
    post = {
      id: uid(), title: '', body: '', status: 'draft', publishDate: opts.prefillDate ? today() : '',
      channels: [], tags: [], seriesName: '', seriesPart: null, seriesTotal: null,
      relatedPostIds: [], ideaId: null, coverImage: '', 
      checklist: { text: false, image: false, links: false, tags: false },
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  } else {
    post = await dbGet(db, 'posts', id);
    if (!post.checklist) post.checklist = { text: false, image: false, links: false, tags: false };
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
  let currentImage = post.coverImage || '';

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
        
        <label class="label" style="margin-top:12px">Шаблоны текста</label>
        <div class="template-bar">
          ${Object.keys(TEMPLATES).map(name => `<button class="template-btn" data-template="${name}">${name}</button>`).join('')}
        </div>

        <label class="label">Обложка</label>
        <div class="image-upload-box" id="upload-box">
          ${currentImage ? `
            <div class="image-preview-wrap">
              <img src="${currentImage}" class="image-preview-thumb">
              <button class="image-remove" id="remove-img">×</button>
            </div>
          ` : 'Нажмите, чтобы выбрать фото'}
        </div>
        <input type="file" id="post-image-input" accept="image/*" hidden>

        <label class="label">Текст поста</label>
        <div class="format-bar">
          <button data-md="bold" title="Жирный"><b>B</b></button>
          <button data-md="italic" title="Курсив"><i>I</i></button>
          <button data-md="link" title="Ссылка">🔗</button>
          <button data-md="list" title="Список">≡</button>
          <button data-md="h2" title="Подзаголовок">H2</button>
        </div>
        <textarea id="post-body" class="body-textarea" placeholder="Текст поста в Markdown...">${escapeHtml(post.body)}</textarea>
      </div>

      <div class="editor-view hidden" data-view="meta">
        <label class="label">Статус</label>
        <select id="post-status">
          ${Object.entries(POST_STATUSES).map(([k, v]) => `<option value="${k}" ${post.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>

        <label class="label">Чек-лист готовности</label>
        <div class="checklist-grid">
          <label class="checklist-item"><input type="checkbox" id="check-text" ${post.checklist.text?'checked':''}> Текст написан и вычитан</label>
          <label class="checklist-item"><input type="checkbox" id="check-image" ${post.checklist.image?'checked':''}> Картинка/обложка готова</label>
          <label class="checklist-item"><input type="checkbox" id="check-links" ${post.checklist.links?'checked':''}> Ссылки и хэштеги проверены</label>
          <label class="checklist-item"><input type="checkbox" id="check-tags" ${post.checklist.tags?'checked':''}> Теги и каналы указаны</label>
        </div>

        <label class="label">Дата публикации</label>
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

        <label class="label">Теги</label>
        <input id="post-tags" type="text" value="${escapeHtml((post.tags || []).join(', '))}" placeholder="лайфстайл, техника">

        <label class="label">Серия</label>
        <div class="series-row">
          <input id="series-name" type="text" placeholder="Название" value="${escapeHtml(post.seriesName || '')}">
          <input id="series-part" type="number" min="1" placeholder="Часть" value="${post.seriesPart || ''}">
          <input id="series-total" type="number" min="1" placeholder="Всего" value="${post.seriesTotal || ''}">
        </div>

        <label class="label">Связанные посты</label>
        <div class="related-chips" id="related-chips"></div>
        <input id="related-search" type="text" placeholder="Найти пост...">
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

  // Templates
  root.querySelectorAll('.template-btn').forEach(btn => {
    btn.onclick = () => {
      const tpl = TEMPLATES[btn.dataset.template];
      if (tpl) {
        if (bodyEl.value.trim() && !confirm('Заменить текущий текст шаблоном?')) return;
        bodyEl.value = tpl;
        toast('Шаблон применён');
      }
    };
  });

  // Image Upload
  const uploadBox = root.querySelector('#upload-box');
  const imgInput = root.querySelector('#post-image-input');
  
  uploadBox.onclick = (e) => {
    if (e.target.id === 'remove-img') return;
    imgInput.click();
  };
  
  imgInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Обработка фото...');
    currentImage = await processImage(file);
    uploadBox.innerHTML = `
      <div class="image-preview-wrap">
        <img src="${currentImage}" class="image-preview-thumb">
        <button class="image-remove" id="remove-img">×</button>
      </div>
    `;
    const checkImg = root.querySelector('#check-image');
    if (checkImg) checkImg.checked = true;
  };
  
  uploadBox.addEventListener('click', (e) => {
    if (e.target.id === 'remove-img') {
      currentImage = '';
      uploadBox.innerHTML = 'Нажмите, чтобы выбрать фото';
      imgInput.value = '';
      const checkImg = root.querySelector('#check-image');
      if (checkImg) checkImg.checked = false;
    }
  });

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
      if (md === 'bold') insertMd(bodyEl, '**', '**', 'жирный');
      if (md === 'italic') insertMd(bodyEl, '*', '*', 'курсив');
      if (md === 'link') insertMd(bodyEl, '[', '](https://)', 'текст');
      if (md === 'list') insertMd(bodyEl, '\n- ', '', 'пункт');
      if (md === 'h2') insertMd(bodyEl, '\n## ', '', 'подзаголовок');
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
      if (selectedChannels.includes(ch)) selectedChannels = selectedChannels.filter(x => x !== ch);
      else selectedChannels.push(ch);
      renderChannels();
    };
  });
  renderChannels();

  function renderChips() {
    const el = root.querySelector('#related-chips');
    el.innerHTML = selectedRelatedIds.map(id => `<span class="related-chip">${escapeHtml(titleById[id] || 'Без названия')}<button data-remove="${id}">×</button></span>`).join('');
    el.querySelectorAll('[data-remove]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); selectedRelatedIds = selectedRelatedIds.filter(x => x !== b.dataset.remove); renderChips(); };
    });
  }
  function renderSuggestions(query) {
    const el = root.querySelector('#related-suggestions');
    if (!query || !query.trim()) { el.innerHTML = ''; return; }
    const q = query.toLowerCase();
    const matches = otherPosts.filter(p => !selectedRelatedIds.includes(p.id) && (p.title || '').toLowerCase().includes(q)).slice(0, 10);
    if (!matches.length) { el.innerHTML = '<div class="related-suggestion" style="color:var(--muted);cursor:default">Ничего не найдено</div>'; return; }
    el.innerHTML = matches.map(p => `<div class="related-suggestion" data-add="${p.id}">${escapeHtml(p.title || 'Без названия')}</div>`).join('');
    el.querySelectorAll('[data-add]').forEach(s => {
      s.onclick = () => {
        const rid = s.dataset.add;
        if (!selectedRelatedIds.includes(rid)) { selectedRelatedIds.push(rid); renderChips(); root.querySelector('#related-search').value = ''; renderSuggestions(''); }
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
    const series = { name: root.querySelector('#series-name').value.trim(), part: parseInt(root.querySelector('#series-part').value) || null, total: parseInt(root.querySelector('#series-total').value) || null };
    root.querySelector('#platform-preview').innerHTML = buildPreview(currentPlatform, titleEl.value, bodyEl.value, series, relatedTitles, currentImage);
  }
  root.querySelectorAll('.platform-tab').forEach(t => {
    t.onclick = () => { currentPlatform = t.dataset.platform; renderPreview(); };
  });

  root.querySelector('[data-close]').onclick = () => {
    const changed = isNew ? (titleEl.value || bodyEl.value || currentImage) : (post.title !== titleEl.value || post.body !== bodyEl.value || post.coverImage !== currentImage);
    if (changed && !confirm('Есть несохранённые изменения. Выйти?')) return;
    closeModal(); switchTab(currentTab);
  };

  if (!isNew) root.querySelector('#post-history').onclick = () => showHistory(post.id);

  root.querySelector('#post-save').onclick = async () => {
    const newStatus = root.querySelector('#post-status').value;
    const checklist = {
      text: root.querySelector('#check-text').checked,
      image: root.querySelector('#check-image').checked,
      links: root.querySelector('#check-links').checked,
      tags: root.querySelector('#check-tags').checked
    };
    
    if (newStatus === 'published') {
      if (!checklist.text || !checklist.image || !checklist.links || !checklist.tags) {
        if (!confirm('Вы переводите пост в статус "Опубликовано", но чек-лист готовности заполнен не полностью. Продолжить?')) return;
      }
    }

    post.title = titleEl.value.trim();
    post.body = bodyEl.value;
    post.status = newStatus;
    post.checklist = checklist;
    post.publishDate = root.querySelector('#post-date').value || '';
    post.channels = [...selectedChannels];
    post.ideaId = root.querySelector('#post-idea').value || null;
    post.tags = root.querySelector('#post-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    post.seriesName = root.querySelector('#series-name').value.trim();
    post.coverImage = currentImage;
    if (post.seriesName) {
      post.seriesPart = parseInt(root.querySelector('#series-part').value) || null;
      post.seriesTotal = parseInt(root.querySelector('#series-total').value) || null;
    } else { post.seriesPart = null; post.seriesTotal = null; }
    post.updatedAt = Date.now();

    await dbPut(db, 'post_versions', {
      id: uid(), postId: post.id, title: post.title, body: post.body, status: post.status,
      channels: [...post.channels], tags: [...post.tags], seriesName: post.seriesName, seriesPart: post.seriesPart, seriesTotal: post.seriesTotal, publishDate: post.publishDate, savedAt: Date.now(), comment: isNew ? 'Создан' : 'Изменён',
    });

    await updateRelatedLinks(post.id, selectedRelatedIds);
    post.relatedPostIds = [...selectedRelatedIds];

    await dbPut(db, 'posts', post);
    await markChange();
    toast('Сохранено ✓');
    if (isNew) { closeModal(); switchTab('posts'); }
  };

  const initialTab = opts.openTab || 'text';
  if (initialTab === 'preview') root.querySelector('[data-mode="preview"]').click();
  else if (initialTab === 'meta') root.querySelector('[data-mode="meta"]').click();
}

async function updateRelatedLinks(postId, newIds) {
  const post = await dbGet(db, 'posts', postId);
  if (!post) return;
  const oldIds = post.relatedPostIds || [];
  const added = newIds.filter(id => !oldIds.includes(id));
  const removed = oldIds.filter(id => !newIds.includes(id));
  for (const otherId of added) {
    const other = await dbGet(db, 'posts', otherId);
    if (other) { other.relatedPostIds = [...(other.relatedPostIds || []), postId]; other.updatedAt = Date.now(); await dbPut(db, 'posts', other); }
  }
  for (const otherId of removed) {
    const other = await dbGet(db, 'posts', otherId);
    if (other) { other.relatedPostIds = (other.relatedPostIds || []).filter(id => id !== postId); other.updatedAt = Date.now(); await dbPut(db, 'posts', other); }
  }
}

async function deletePost(id) {
  const others = await dbGetAll(db, 'posts');
  for (const p of others) {
    if (p.id !== id && (p.relatedPostIds || []).includes(id)) {
      p.relatedPostIds = p.relatedPostIds.filter(x => x !== id); p.updatedAt = Date.now(); await dbPut(db, 'posts', p);
    }
  }
  const versions = await dbGetVersions(db, id);
  for (const v of versions) await dbDelete(db, 'post_versions', v.id);
  await dbDelete(db, 'posts', id);
}

function buildPreview(platform, title, body, series, relatedTitles, image) {
  const p = PLATFORMS[platform];
  const len = body.length;
  const over = len > p.maxLength;
  const hashtags = (body.match(/#[\wа-яё]+/gi) || []).length;
  const overHash = p.hashtagLimit && hashtags > p.hashtagLimit;
  const counter = `<div class="counter ${over ? 'over' : ''}">${len} / ${p.maxLength}${overHash ? ` · хэштегов ${hashtags}/${p.hashtagLimit}` : ''}</div>`;
  const md = renderMarkdown(body);
  const seriesLine = series.name ? `<div class="pf-line">📚 Серия: ${escapeHtml(series.name)}${series.part ? ` · ч. ${series.part}${series.total ? `/${series.total}` : ''}` : ''}</div>` : '';
  const relatedLine = relatedTitles.length ? `<div class="pf-line">🔗 Связанные: ${relatedTitles.map(t => escapeHtml(t)).join(', ')}</div>` : '';
  const footer = (seriesLine || relatedLine) ? `<div class="preview-footer">${seriesLine}${relatedLine}</div>` : '';
  
  const imgHtml = image ? `<img src="${image}" class="ig-image">` : `<div class="ig-image-placeholder" style="background:${p.color}22">Нет фото</div>`;
  
  const copyBtn = `<button class="copy-btn" data-action="copy-text" data-platform="${platform}">Копировать</button>`;

  if (platform === 'instagram') return `
    ${copyBtn}
    <div class="ig-preview" style="margin-top: 30px">
      <div class="ig-header">
        <div class="ig-avatar" style="background:${p.color}">Е</div><div class="ig-username">eshe.odna.galochka</div>
      </div>
      ${imgHtml}
      <div class="ig-caption">${title ? `<div class="ig-title"><strong>${escapeHtml(title)}</strong></div>` : ''}<div class="ig-text">${md}</div></div>
      ${footer}${counter}
    </div>`;

  if (platform === 'telegram' || platform === 'max') return `
    ${copyBtn}
    <div class="tg-preview" style="margin-top: 30px">
      <div class="tg-bubble" style="border-left-color:${p.color}">
        ${title ? `<div class="tg-title">${escapeHtml(title)}</div>` : ''}<div class="tg-text">${md}</div>
      </div>
      ${footer}${counter}
    </div>`;

  if (platform === 'vk') return `
    ${copyBtn}
    <div class="vk-preview" style="margin-top: 30px">
      <div class="vk-header"><div class="vk-avatar" style="background:${p.color}">Е</div><div><strong>Ещё одна галочка</strong><br><small style="color:var(--muted)">только что</small></div></div>
      <div class="vk-text">${md}</div>${footer}${counter}
    </div>`;

  if (platform === 'zen') return `
    ${copyBtn}
    <div class="zen-preview" style="margin-top: 30px">
      <h2 class="zen-title">${escapeHtml(title) || 'Заголовок публикации'}</h2>
      ${image ? `<img src="${image}" style="width:100%;border-radius:10px;margin-bottom:12px;">` : ''}
      <div class="zen-text">${md}</div>${footer}${counter}
    </div>`;
  return '<p>Нет предпросмотра</p>';
}

async function showHistory(postId) {
  const versions = await dbGetVersions(db, postId);
  versions.sort((a, b) => b.savedAt - a.savedAt);
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal">
      <header class="modal-header"><button data-close>←</button><h2>История версий</h2><span style="width:40px"></span></header>
      <div class="editor-view">
        ${!versions.length ? '<p class="empty">Версий пока нет</p>' : versions.map(v => `
          <div class="version-card">
            <div class="version-meta">${fmtDateTime(v.savedAt)} · ${escapeHtml(v.comment || '')}</div>
            <div class="version-title">${escapeHtml(v.title || '—')}</div>
            <div class="version-snippet">${escapeHtml((v.body || '').slice(0, 100))}...</div>
            <div class="version-actions">
              <button data-view-id="${v.id}">Просмотр</button>
              <button class="btn-primary" data-restore-id="${v.id}" data-post-id="${postId}">Восстановить</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  root.querySelector('[data-close]').onclick = closeModal;
  root.querySelectorAll('[data-view-id]').forEach(b => {
    b.onclick = async () => {
      const v = await dbGet(db, 'post_versions', b.dataset.viewId);
      alert(`Версия от ${fmtDateTime(v.savedAt)}\n\n${v.title || '—'}\n\n${v.body || ''}`);
    };
  });
  root.querySelectorAll('[data-restore-id]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Восстановить эту версию?')) return;
      const v = await dbGet(db, 'post_versions', b.dataset.restoreId);
      const post = await dbGet(db, 'posts', b.dataset.postId);
      await dbPut(db, 'post_versions', { id: uid(), postId: post.id, title: post.title, body: post.body, status: post.status, channels: [...post.channels], tags: [...post.tags], seriesName: post.seriesName, seriesPart: post.seriesPart, seriesTotal: post.seriesTotal, publishDate: post.publishDate, savedAt: Date.now(), comment: 'До восстановления' });
      post.title = v.title || ''; post.body = v.body || ''; post.status = v.status || post.status;
      post.channels = v.channels || post.channels; post.tags = v.tags || post.tags;
      post.seriesName = v.seriesName || ''; post.seriesPart = v.seriesPart ?? null; post.seriesTotal = v.seriesTotal ?? null;
      post.publishDate = v.publishDate || ''; post.updatedAt = Date.now();
      await dbPut(db, 'posts', post); await markChange(); closeModal(); toast('Восстановлено ✓'); openPostEditor(post.id);
    };
  });
}

// ============ Ideas ============
async function renderIdeas() {
  const ideas = await dbGetAll(db, 'ideas');
  ideas.sort((a, b) => b.createdAt - a.createdAt);
  const list = document.getElementById('ideas-list');
  if (!ideas.length) { list.innerHTML = '<p class="empty">Пока пусто.</p>'; return; }
  
  list.innerHTML = ideas.map(i => {
    const st = IDEA_STATUSES[i.status] || IDEA_STATUSES.new;
    return `
      <div class="swipe-wrapper">
        <div class="swipe-actions"><button class="swipe-delete"><span style="font-size:1.2rem">🗑</span>Удалить</button></div>
        <div class="swipe-content card" data-action="edit-idea" data-id="${i.id}">
          <div class="card-row"><span class="status-pill" style="background:${st.color}">${st.label}</span></div>
          <h3 class="card-title">${escapeHtml(i.title)}</h3>
          ${i.description ? `<p class="card-body">${escapeHtml(i.description)}</p>` : ''}
          ${i.tags ? `<div class="tags">${i.tags.split(',').map(t => `<span class="tag">${escapeHtml(t.trim())}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const id = wrapper.querySelector('.swipe-content').dataset.id;
    setupSwipe(wrapper, () => { if (confirm('Удалить идею?')) executeDeleteIdea(id); });
  });
}

async function openIdeaEditor(id) {
  let idea = id ? await dbGet(db, 'ideas', id) : { id: uid(), title: '', description: '', tags: '', status: 'new', createdAt: Date.now() };
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal">
      <header class="modal-header"><button data-close>←</button><h2>${id ? 'Идея' : 'Новая идея'}</h2><button class="btn-primary" id="save-idea">Сохранить</button></header>
      <div class="editor-view">
        <label class="label">Заголовок</label><input id="idea-title" type="text" value="${escapeHtml(idea.title)}" placeholder="О чём идея?">
        <label class="label">Описание</label><textarea id="idea-desc" class="small-textarea" placeholder="Контекст...">${escapeHtml(idea.description)}</textarea>
        <label class="label">Теги</label><input id="idea-tags" type="text" value="${escapeHtml(idea.tags)}" placeholder="лайфстайл, техника">
        <label class="label">Статус</label>
        <select id="idea-status">${Object.entries(IDEA_STATUSES).map(([k, v]) => `<option value="${k}" ${idea.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      </div>
    </div>`;
  root.querySelector('[data-close]').onclick = closeModal;
  root.querySelector('#save-idea').onclick = async () => {
    idea.title = root.querySelector('#idea-title').value.trim();
    idea.description = root.querySelector('#idea-desc').value.trim();
    idea.tags = root.querySelector('#idea-tags').value.trim();
    idea.status = root.querySelector('#idea-status').value;
    if (!idea.title) return toast('Заголовок обязателен');
    await dbPut(db, 'ideas', idea); await markChange(); closeModal(); renderIdeas(); toast('Сохранено ✓');
  };
}

async function saveMission() {
  await dbPut(db, 'mission', { id: 'main', body: document.getElementById('mission-body').value, updatedAt: Date.now() });
  await markChange(); toast('Сохранено ✓');
}

async function renderSettings() {
  const settings = await dbGet(db, 'settings', 'main');
  document.getElementById('last-backup').textContent = settings?.lastBackupAt ? `Последний бэкап: ${fmtDateTime(settings.lastBackupAt)}` : 'Последний бэкап: —';
  
  if (settings && settings.emailjs) {
    document.getElementById('emailjs-service').value = settings.emailjs.service || '';
    document.getElementById('emailjs-template').value = settings.emailjs.template || '';
    document.getElementById('emailjs-key').value = settings.emailjs.publicKey || '';
    document.getElementById('emailjs-status').textContent = settings.emailjs.publicKey ? 'Автобэкап включен ✓' : 'Не настроен';
  }
}

async function saveEmailjsSettings() {
  const service = document.getElementById('emailjs-service').value.trim();
  const template = document.getElementById('emailjs-template').value.trim();
  const publicKey = document.getElementById('emailjs-key').value.trim();
  const settings = await dbGet(db, 'settings', 'main');
  settings.emailjs = { service, template, publicKey };
  await dbPut(db, 'settings', settings);
  
  emailjsConfig = settings.emailjs;
  if (publicKey && typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey });
  }
  toast('Настройки сохранены');
  renderSettings();
}

// ============ Backup Logic ============
async function markChange() {
  const settings = await dbGet(db, 'settings', 'main');
  settings.pendingChanges = (settings.pendingChanges || 0) + 1;
  await dbPut(db, 'settings', settings);
  pendingBackupCount = settings.pendingChanges;
  updateBackupBadge();
  
  if (emailjsConfig.service && emailjsConfig.template && emailjsConfig.publicKey) {
    triggerAutoBackup();
  }
}

async function triggerAutoBackup() {
  try {
    const data = await exportAll();
    const payload = {
      message: JSON.stringify(data),
      filename: `backup-${new Date().toISOString().slice(0,10)}.json`,
      subject: 'Автобэкап "Ещё одна галочка"'
    };
    
    await emailjs.send(emailjsConfig.service, emailjsConfig.template, payload, emailjsConfig.publicKey);
    
    const settings = await dbGet(db, 'settings', 'main');
    settings.pendingChanges = 0;
    settings.lastBackupAt = Date.now();
    await dbPut(db, 'settings', settings);
    pendingBackupCount = 0;
    updateBackupBadge();
    if (currentTab === 'settings') renderSettings();
  } catch (e) {
    console.error('Ошибка автобэкапа:', e);
    toast('Не удалось отправить бэкап. Проверьте настройки.');
  }
}

function updateBackupBadge() {
  const badge = document.getElementById('backup-badge');
  if (pendingBackupCount > 0 && !emailjsConfig.publicKey) {
    badge.classList.remove('hidden');
    document.getElementById('backup-count').textContent = pendingBackupCount;
  } else {
    badge.classList.add('hidden');
  }
}

async function exportAll() {
  const result = { exportedAt: new Date().toISOString(), version: 4, app: 'eshe-odna-galochka' };
  for (const store of ['ideas', 'posts', 'post_versions', 'mission']) result[store] = await dbGetAll(db, store);
  return result;
}

async function sendManualBackup() {
  try {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `galochka-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Бэкап галочки' });
      const settings = await dbGet(db, 'settings', 'main');
      settings.pendingChanges = 0; settings.lastBackupAt = Date.now();
      await dbPut(db, 'settings', settings); pendingBackupCount = 0; updateBackupBadge();
      if (currentTab === 'settings') renderSettings();
      toast('Бэкап отправлен ✓');
    } else {
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); toast('Файл скачан');
    }
  } catch (e) { if (e.name !== 'AbortError') toast('Ошибка: ' + e.message); }
}

async function handleRestoreFile(e) {
  const file = e.target.files[0]; if (!file) return;
  try {
    const text = await file.text(); const data = JSON.parse(text);
    if (!confirm('Восстановить из бэкапа?')) { e.target.value = ''; return; }
    for (const store of ['ideas', 'posts', 'post_versions', 'mission']) {
      if (!Array.isArray(data[store])) continue;
      for (const item of data[store]) await dbPut(db, store, item);
    }
    toast('Восстановлено ✓'); switchTab(currentTab);
  } catch (err) { alert('Ошибка: ' + err.message); }
  e.target.value = '';
}

init();
