// ============ Config ============
const PLATFORMS = {
  instagram: { name: 'Instagram', color: '#F27691', maxLength: 2200, hashtagLimit: 30 },
  telegram:  { name: 'Telegram',  color: '#DCEB32', maxLength: 4096 },
  vk:        { name: 'VK',        color: '#687B59', maxLength: 15000 },
  max:       { name: 'MAX',       color: '#292724', maxLength: 4096 },
  zen:       { name: 'Дзен',      color: '#292724', maxLength: 10000 },
};
const IDEA_STATUSES = {
  new:      { label: 'Новая',     color: '#687B59' },
  approved: { label: 'Одобрена',  color: '#DCEB32' },
  in_work:  { label: 'В работе',  color: '#F27691' },
  rejected: { label: 'Отклонена', color: '#d8cdbd' },
};
const DRAFT_STATUSES = {
  draft:  { label: 'Черновик',   color: '#687B59' },
  review: { label: 'На вычитке', color: '#F27691' },
  ready:  { label: 'Готово',     color: '#DCEB32' },
};
const PLAN_STATUSES = {
  planned:   { label: 'Запланировано', color: '#687B59' },
  published: { label: 'Опубликовано',  color: '#DCEB32' },
};
const SECTION_TITLES = {
  plan: 'Контент-план', drafts: 'Черновики', ideas: 'Идеи',
  mission: 'Миссия', settings: 'Настройки',
};

// ============ DB ============
const DB_NAME = 'eshe-odna-galochka';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('ideas')) db.createObjectStore('ideas', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('draft_versions')) {
        const s = db.createObjectStore('draft_versions', { keyPath: 'id' });
        s.createIndex('draftId', 'draftId');
      }
      if (!db.objectStoreNames.contains('content_plan')) db.createObjectStore('content_plan', { keyPath: 'id' });
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
function dbGetVersions(db, draftId) {
  return new Promise((res, rej) => {
    const r = dbStore(db, 'draft_versions').index('draftId').getAll(draftId);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// ============ Utils ============
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDateTime(ts) { return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
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
  if (tab === 'drafts') renderDrafts();
  if (tab === 'ideas') renderIdeas();
  if (tab === 'settings') renderSettings();
}

// ============ Global click ============
async function handleGlobalClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  switch (action) {
    case 'new-plan': openPlanEditor(null); break;
    case 'edit-plan': openPlanEditor(id); break;
    case 'delete-plan':
      if (confirm('Удалить запись из плана?')) { await dbDelete(db, 'content_plan', id); markChange(); renderPlan(); }
      break;
    case 'open-linked-draft': openDraftEditor(id); break;
    case 'new-draft': openDraftEditor('new'); break;
    case 'edit-draft': openDraftEditor(id); break;
    case 'delete-draft':
      if (confirm('Удалить черновик и его историю?')) {
        const versions = await dbGetVersions(db, id);
        for (const v of versions) await dbDelete(db, 'draft_versions', v.id);
        await dbDelete(db, 'drafts', id);
        markChange(); renderDrafts();
      }
      break;
    case 'new-idea': openIdeaEditor(null); break;
    case 'edit-idea': openIdeaEditor(id); break;
    case 'delete-idea':
      if (confirm('Удалить идею?')) { await dbDelete(db, 'ideas', id); markChange(); renderIdeas(); }
      break;
    case 'save-mission': saveMission(); break;
    case 'backup-now': sendBackup(); break;
    case 'restore-backup': document.getElementById('restore-file').click(); break;
  }
}

// ============ Plan ============
async function renderPlan() {
  const plans = await dbGetAll(db, 'content_plan');
  plans.sort((a, b) => (a.publishDate || '9999').localeCompare(b.publishDate || '9999'));
  const list = document.getElementById('plan-list');
  if (!plans.length) { list.innerHTML = '<p class="empty">Пока пусто. Добавьте первый пост.</p>'; return; }
  list.innerHTML = plans.map(p => {
    const pl = PLATFORMS[p.channel] || { name: p.channel, color: '#292724' };
    const st = PLAN_STATUSES[p.status] || PLAN_STATUSES.planned;
    return `
      <div class="card">
        <div class="card-row">
          <span class="channel-pill" style="background:${pl.color}">${escapeHtml(pl.name)}</span>
          <span class="status-pill" style="background:${st.color}">${st.label}</span>
        </div>
        <h3 class="card-title">${escapeHtml(p.title || '—')}</h3>
        <div class="card-meta">${p.publishDate ? fmtDate(new Date(p.publishDate).getTime()) : '—'}</div>
        <div class="card-actions">
          ${p.draftId ? `<button data-action="open-linked-draft" data-id="${p.draftId}" title="Черновик">📝</button>` : ''}
          <button data-action="edit-plan" data-id="${p.id}" title="Изменить">✎</button>
          <button data-action="delete-plan" data-id="${p.id}" title="Удалить">🗑</button>
        </div>
      </div>`;
  }).join('');
}

async function openPlanEditor(id) {
  let plan;
  if (!id) plan = { id: uid(), title: '', publishDate: '', channel: 'telegram', status: 'planned', draftId: null };
  else plan = await dbGet(db, 'content_plan', id);
  const drafts = await dbGetAll(db, 'drafts');
  drafts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal">
      <header class="modal-header">
        <button data-close>←</button>
        <h2>${id ? 'Пост в плане' : 'Новый пост'}</h2>
        <button class="btn-primary" id="save-plan">Сохранить</button>
      </header>
      <div class="modal-body">
        <label class="label">Название</label>
        <input id="plan-title" type="text" value="${escapeHtml(plan.title)}" placeholder="О чём пост?">
        <label class="label">Дата публикации</label>
        <input id="plan-date" type="date" value="${plan.publishDate || ''}">
        <label class="label">Канал</label>
        <select id="plan-channel">
          ${Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}" ${plan.channel === k ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
        <label class="label">Черновик</label>
        <select id="plan-draft">
          <option value="">— без черновика —</option>
          ${drafts.map(d => `<option value="${d.id}" ${plan.draftId === d.id ? 'selected' : ''}>${escapeHtml(d.title || 'Без названия')}</option>`).join('')}
        </select>
        <label class="label">Статус</label>
        <select id="plan-status">
          ${Object.entries(PLAN_STATUSES).map(([k, v]) => `<option value="${k}" ${plan.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>`;

  root.querySelector('[data-close]').onclick = closeModal;
  root.querySelector('#save-plan').onclick = async () => {
    plan.title = root.querySelector('#plan-title').value.trim();
    plan.publishDate = root.querySelector('#plan-date').value;
    plan.channel = root.querySelector('#plan-channel').value;
    plan.draftId = root.querySelector('#plan-draft').value || null;
    plan.status = root.querySelector('#plan-status').value;
    if (!plan.title) return toast('Название обязательно');
    await dbPut(db, 'content_plan', plan);
    await markChange();
    closeModal();
    renderPlan();
    toast('Сохранено ✓');
  };
}

// ============ Drafts ============
async function renderDrafts() {
  const drafts = await dbGetAll(db, 'drafts');
  drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  const list = document.getElementById('drafts-list');
  if (!drafts.length) { list.innerHTML = '<p class="empty">Пока пусто. Создайте первый черновик.</p>'; return; }
  list.innerHTML = drafts.map(d => {
    const st = DRAFT_STATUSES[d.status] || DRAFT_STATUSES.draft;
    const snippet = (d.body || '').slice(0, 120);
    return `
      <div class="card">
        <div class="card-row">
          <span class="status-pill" style="background:${st.color}">${st.label}</span>
        </div>
        <h3 class="card-title">${escapeHtml(d.title || 'Без названия')}</h3>
        <p class="card-body">${escapeHtml(snippet)}${(d.body || '').length > 120 ? '…' : ''}</p>
        <div class="card-meta">${fmtDateTime(d.updatedAt)}</div>
        <div class="card-actions">
          <button data-action="edit-draft" data-id="${d.id}" title="Открыть">✎</button>
          <button data-action="delete-draft" data-id="${d.id}" title="Удалить">🗑</button>
        </div>
      </div>`;
  }).join('');
}

async function openDraftEditor(id) {
  const isNew = id === 'new';
  let draft;
  if (isNew) draft = { id: uid(), title: '', body: '', status: 'draft', createdAt: Date.now(), updatedAt: Date.now() };
  else draft = await dbGet(db, 'drafts', id);
  if (!draft) return toast('Черновик не найден');

  const ideas = await dbGetAll(db, 'ideas');

  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal fullscreen">
      <header class="modal-header">
        <button data-close>←</button>
        <h2>${isNew ? 'Новый черновик' : 'Черновик'}</h2>
        <div style="display:flex;gap:4px">
          <button id="draft-history" title="История версий">🕐</button>
          <button class="btn-primary" id="draft-save">Сохранить</button>
        </div>
      </header>
      <div class="modal-tabs">
        <button class="modal-tab active" data-mode="editor">Редактор</button>
        <button class="modal-tab" data-mode="preview">Предпросмотр</button>
      </div>
      <div class="editor-view" data-view="editor">
        <input id="draft-title" class="title-input" type="text" placeholder="Заголовок черновика" value="${escapeHtml(draft.title)}">
        <div class="meta-row">
          <select id="draft-status">
            ${Object.entries(DRAFT_STATUSES).map(([k, v]) => `<option value="${k}" ${draft.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
          <select id="draft-idea">
            <option value="">— без идеи —</option>
            ${ideas.map(i => `<option value="${i.id}" ${draft.ideaId === i.id ? 'selected' : ''}>${escapeHtml(i.title)}</option>`).join('')}
          </select>
        </div>
        <div class="format-bar">
          <button data-md="bold" title="Жирный"><b>B</b></button>
          <button data-md="italic" title="Курсив"><i>I</i></button>
          <button data-md="link" title="Ссылка">🔗</button>
          <button data-md="list" title="Список">≡</button>
          <button data-md="h2" title="Подзаголовок">H2</button>
        </div>
        <textarea id="draft-body" class="body-textarea" placeholder="Текст поста в Markdown. Хэштеги — в конце через #.">${escapeHtml(draft.body)}</textarea>
      </div>
      <div class="preview-view hidden" data-view="preview">
        <div class="platform-tabs">
          ${Object.entries(PLATFORMS).map(([k, v]) => `<button class="platform-tab" data-platform="${k}" style="--tab-color:${v.color}">${v.name}</button>`).join('')}
        </div>
        <div class="platform-preview" id="platform-preview"></div>
      </div>
    </div>`;

  let currentPlatform = 'telegram';
  const bodyEl = root.querySelector('#draft-body');
  const titleEl = root.querySelector('#draft-title');

  root.querySelector('[data-close]').onclick = () => {
    const changed = isNew ? (titleEl.value || bodyEl.value) : (draft.title !== titleEl.value || draft.body !== bodyEl.value);
    if (changed && !confirm('Есть несохранённые изменения. Выйти?')) return;
    closeModal();
    switchTab('drafts');
  };

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

  function renderPreview() {
    root.querySelectorAll('.platform-tab').forEach(t => t.classList.toggle('active', t.dataset.platform === currentPlatform));
    root.querySelector('#platform-preview').innerHTML = buildPreview(currentPlatform, titleEl.value, bodyEl.value);
  }

  root.querySelectorAll('.platform-tab').forEach(t => {
    t.onclick = () => { currentPlatform = t.dataset.platform; renderPreview(); };
  });

  root.querySelector('#draft-save').onclick = async () => {
    draft.title = titleEl.value.trim();
    draft.body = bodyEl.value;
    draft.status = root.querySelector('#draft-status').value;
    draft.ideaId = root.querySelector('#draft-idea').value || null;
    draft.updatedAt = Date.now();
    await dbPut(db, 'draft_versions', {
      id: uid(), draftId: draft.id,
      title: draft.title, body: draft.body,
      savedAt: Date.now(), comment: isNew ? 'Создан' : 'Изменён',
    });
    await dbPut(db, 'drafts', draft);
    await markChange();
    toast('Сохранено ✓');
    if (isNew) { closeModal(); switchTab('drafts'); }
  };

  root.querySelector('#draft-history').onclick = () => showHistory(draft.id);
  renderPreview();
}

function buildPreview(platform, title, body) {
  const p = PLATFORMS[platform];
  const len = body.length;
  const over = len > p.maxLength;
  const hashtags = (body.match(/#[\wа-яё]+/gi) || []).length;
  const overHash = p.hashtagLimit && hashtags > p.hashtagLimit;
  const counter = `<div class="counter ${over ? 'over' : ''}">${len} / ${p.maxLength}${overHash ? ` · хэштегов ${hashtags}/${p.hashtagLimit}` : ''}</div>`;
  const md = renderMarkdown(body);

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
      ${counter}
    </div>`;

  if (platform === 'telegram') return `
    <div class="tg-preview">
      <div class="tg-bubble" style="border-left-color:${p.color}">
        ${title ? `<div class="tg-title">${escapeHtml(title)}</div>` : ''}
        <div class="tg-text">${md}</div>
      </div>
      ${counter}
    </div>`;

  if (platform === 'vk') return `
    <div class="vk-preview">
      <div class="vk-header">
        <div class="vk-avatar" style="background:${p.color}">Е</div>
        <div><strong>Ещё одна галочка</strong><br><small style="color:var(--muted)">только что</small></div>
      </div>
      <div class="vk-text">${md}</div>
      ${counter}
    </div>`;

  if (platform === 'max') return `
    <div class="tg-preview">
      <div class="tg-bubble" style="border-left-color:${p.color}">
        ${title ? `<div class="tg-title">${escapeHtml(title)}</div>` : ''}
        <div class="tg-text">${md}</div>
      </div>
      ${counter}
    </div>`;

  if (platform === 'zen') return `
    <div class="zen-preview">
      <h2 class="zen-title">${escapeHtml(title) || 'Заголовок публикации'}</h2>
      <div class="zen-text">${md}</div>
      ${counter}
    </div>`;

  return '<p>Нет предпросмотра</p>';
}

async function showHistory(draftId) {
  const versions = await dbGetVersions(db, draftId);
  versions.sort((a, b) => b.savedAt - a.savedAt);
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal">
      <header class="modal-header">
        <button data-close>←</button>
        <h2>История версий</h2>
        <span style="width:40px"></span>
      </header>
      <div class="modal-body">
        ${!versions.length ? '<p class="empty">Версий пока нет</p>' : versions.map(v => `
          <div class="version-card">
            <div class="version-meta">${fmtDateTime(v.savedAt)} · ${escapeHtml(v.comment || '')}</div>
            <div class="version-title">${escapeHtml(v.title || '—')}</div>
            <div class="version-snippet">${escapeHtml((v.body || '').slice(0, 100))}${(v.body || '').length > 100 ? '…' : ''}</div>
            <div class="version-actions">
              <button data-view-id="${v.id}">Просмотр</button>
              <button class="btn-primary" data-restore-id="${v.id}" data-draft-id="${draftId}">Восстановить</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  root.querySelector('[data-close]').onclick = () => closeModal();
  root.querySelectorAll('[data-view-id]').forEach(b => {
    b.onclick = async () => {
      const v = await dbGet(db, 'draft_versions', b.dataset.viewId);
      alert(`Версия от ${fmtDateTime(v.savedAt)}\n\n${v.title || '—'}\n\n${v.body || ''}`);
    };
  });
  root.querySelectorAll('[data-restore-id]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Восстановить эту версию? Текущая будет сохранена в истории.')) return;
      const v = await dbGet(db, 'draft_versions', b.dataset.restoreId);
      const draft = await dbGet(db, 'drafts', b.dataset.draftId);
      await dbPut(db, 'draft_versions', {
        id: uid(), draftId: draft.id,
        title: draft.title, body: draft.body,
        savedAt: Date.now(), comment: 'До восстановления',
      });
      draft.title = v.title; draft.body = v.body; draft.updatedAt = Date.now();
      await dbPut(db, 'drafts', draft);
      await markChange();
      closeModal();
      toast('Восстановлено ✓');
      openDraftEditor(draft.id);
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
      <div class="card">
        <div class="card-row"><span class="status-pill" style="background:${st.color}">${st.label}</span></div>
        <h3 class="card-title">${escapeHtml(i.title)}</h3>
        ${i.description ? `<p class="card-body">${escapeHtml(i.description)}</p>` : ''}
        ${i.tags ? `<div class="tags">${i.tags.split(',').map(t => `<span class="tag">${escapeHtml(t.trim())}</span>`).join('')}</div>` : ''}
        <div class="card-actions">
          <button data-action="edit-idea" data-id="${i.id}" title="Изменить">✎</button>
          <button data-action="delete-idea" data-id="${i.id}" title="Удалить">🗑</button>
        </div>
      </div>`;
  }).join('');
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
      <div class="modal-body">
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

// ============ Mission ============
async function saveMission() {
  const body = document.getElementById('mission-body').value;
  await dbPut(db, 'mission', { id: 'main', body, updatedAt: Date.now() });
  await markChange();
  toast('Сохранено ✓');
}

// ============ Settings ============
async function renderSettings() {
  const settings = await dbGet(db, 'settings', 'main');
  const el = document.getElementById('last-backup');
  el.textContent = settings?.lastBackupAt
    ? `Последний бэкап: ${fmtDateTime(settings.lastBackupAt)}`
    : 'Последний бэкап: —';
}

// ============ Backup ============
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
  const result = { exportedAt: new Date().toISOString(), version: 1, app: 'eshe-odna-galochka' };
  for (const store of ['ideas', 'drafts', 'draft_versions', 'content_plan', 'mission']) {
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
      // Fallback: download
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
    for (const store of ['ideas', 'drafts', 'draft_versions', 'content_plan', 'mission']) {
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

// ============ Start ============
init();
