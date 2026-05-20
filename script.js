const API_ROOT = 'https://jojos-bizarre-api.netlify.app';
const FETCH_TIMEOUT_MS = 12000;
// CORS proxy used as last resort when direct fetch fails
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const state = {
  characters: [],
  stands: [],
  apiMode: 'loading',
  activeView: 'home',
  drawKind: null,
  tab: 'characters'
};

const KEY = 'standPocketData';
const rarityRates = [['N',0.45],['R',0.3],['SR',0.17],['SSR',0.07],['UR',0.01]];
const data = loadData();

init();

async function init() {
  bindUI();
  await loadApi();
  unlockAllCatalogCards();
  renderAll();
}

function today() { return new Date().toLocaleDateString('sv-SE'); }
function loadData() { return JSON.parse(localStorage.getItem(KEY) || '{"lastCharacterDrawDate":"","lastStandDrawDate":"","ownedCharacters":{},"ownedStands":{},"drawHistory":[]}'); }
function saveData() { localStorage.setItem(KEY, JSON.stringify(data)); }

function bindUI() {
  document.querySelectorAll('.bottom-nav button').forEach(b => b.onclick = () => switchView(b.dataset.view));
  document.getElementById('drawCharacterBtn').onclick = () => startDraw('character');
  document.getElementById('drawStandBtn').onclick = () => startDraw('stand');
  document.getElementById('resetAll').onclick = () => { localStorage.removeItem(KEY); location.reload(); };
  document.getElementById('resetDate').onclick = () => { data.lastCharacterDrawDate = ''; data.lastStandDrawDate = ''; saveData(); renderHome(); };
  document.getElementById('closeModal').onclick = () => document.getElementById('detailModal').close();
  document.getElementById('rarityFilter').onchange = renderCollection;
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    state.tab = t.dataset.tab;
    renderCollection();
  });
}

// ── API Fetching ────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Fetch all pages from a base URL, stopping gracefully on error
async function fetchAllPages(baseUrl) {
  const all = [];
  for (let page = 1; page <= 30; page++) {
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    let items;
    try {
      const payload = await fetchJson(url);
      items = extractItems(payload);
      if (!items.length) break;
      all.push(...items);
      if (!mightHaveMore(payload, page, items.length)) break;
    } catch (_) {
      break; // stop pagination on error, keep what we have
    }
  }
  return all;
}

function mightHaveMore(payload, page, itemCount) {
  if (!itemCount) return false;
  if (payload?.next || payload?.links?.next) return true;
  if (typeof payload?.totalPages === 'number') return page < payload.totalPages;
  if (typeof payload?.pagination?.totalPages === 'number') return page < payload.pagination.totalPages;
  if (typeof payload?.meta?.totalPages === 'number') return page < payload.meta.totalPages;
  return itemCount >= 10; // possibly paginated at 10/page
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  const keys = ['characters', 'stands', 'data', 'results', 'items'];
  for (const k of keys) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  return [];
}

async function tryFetchKind(kind) {
  const endpoints = [
    `${API_ROOT}/.netlify/functions/${kind}`,
    `${API_ROOT}/${kind}`,
    `${API_ROOT}/api/${kind}`,
  ];

  // 1. Try direct endpoints with pagination
  for (const url of endpoints) {
    try {
      const items = await fetchAllPages(url);
      if (items.length >= 3) return dedupeItems(items);
    } catch (_) {}
  }

  // 2. Try via CORS proxy as last resort
  try {
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(`${API_ROOT}/${kind}`)}`;
    const items = await fetchAllPages(proxyUrl);
    if (items.length >= 3) return dedupeItems(items);
  } catch (_) {}

  return [];
}

function dedupeItems(items) {
  const map = new Map();
  items.forEach((item, i) => {
    const key = String(item.id || item._id || item.name || `i${i}`);
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

async function loadApi() {
  try {
    const [chars, stands] = await Promise.all([
      tryFetchKind('characters'),
      tryFetchKind('stands'),
    ]);
    if (chars.length >= 3 && stands.length >= 3) {
      state.characters = normalize(chars, 'character');
      state.stands = normalize(stands, 'stand');
      state.apiMode = 'live';
      return;
    }
  } catch (_) {}
  state.characters = normalize(window.FALLBACK_DATA.characters, 'character');
  state.stands = normalize(window.FALLBACK_DATA.stands, 'stand');
  state.apiMode = 'fallback';
}

function normalize(arr, type) {
  return arr.map((x, i) => ({ ...x, id: String(x.id || x._id || `${type}-${i+1}`), type }));
}

function resolveImage(image) {
  if (!image) return '';
  if (/^https?:/.test(image)) return image;
  const clean = String(image).replace(/^\//, '');
  // If path already contains a directory, prepend API root directly
  if (clean.includes('/')) return `${API_ROOT}/${clean}`;
  // Otherwise assume it's a filename under /assets/
  return `${API_ROOT}/assets/${clean}`;
}

// ── Game Logic ──────────────────────────────────────────────────────────────

function unlockAllCatalogCards() {
  for (const item of state.characters) {
    if (!data.ownedCharacters[item.id]) {
      data.ownedCharacters[item.id] = { id: item.id, type: 'character', rarity: 'N', obtainedAt: new Date().toISOString(), duplicateCount: 0 };
    }
  }
  for (const item of state.stands) {
    if (!data.ownedStands[item.id]) {
      data.ownedStands[item.id] = { id: item.id, type: 'stand', rarity: 'N', obtainedAt: new Date().toISOString(), duplicateCount: 0 };
    }
  }
  saveData();
}

function canDraw(kind) { return kind === 'character' ? data.lastCharacterDrawDate !== today() : data.lastStandDrawDate !== today(); }

function pickRarity() {
  let r = Math.random(), acc = 0;
  for (const [k, v] of rarityRates) { acc += v; if (r <= acc) return k; }
  return 'N';
}

function selectCard(kind) {
  const pool = kind === 'character' ? state.characters : state.stands;
  const owned = kind === 'character' ? data.ownedCharacters : data.ownedStands;
  const target = pool[Math.floor(Math.random() * pool.length)];
  const existing = owned[target.id];
  const rarity = existing?.rarity || pickRarity();
  const duplicate = !!existing;
  if (existing) existing.duplicateCount = (existing.duplicateCount || 0) + 1;
  else owned[target.id] = { id: target.id, type: kind, rarity, obtainedAt: new Date().toISOString(), duplicateCount: 0 };
  if (kind === 'character') data.lastCharacterDrawDate = today();
  else data.lastStandDrawDate = today();
  data.drawHistory.unshift({ date: today(), kind, id: target.id, name: target.japaneseName || target.name || '???', rarity, duplicate });
  saveData();
  return { ...target, type: kind, rarity, duplicate };
}

// ── Card Rendering ──────────────────────────────────────────────────────────

function partBgColor(item) {
  const t = item.part || item.chapter || '';
  if (/Part 1|Phantom/i.test(t))   return 'linear-gradient(135deg,#5c2a10,#1a0a04)';
  if (/Part 2|Battle/i.test(t))    return 'linear-gradient(135deg,#2a4a10,#0a1a04)';
  if (/Part 3|Stardust/i.test(t))  return 'linear-gradient(135deg,#1a2a6e,#04081a)';
  if (/Part 4|Diamond/i.test(t))   return 'linear-gradient(135deg,#6e1a5c,#1a041a)';
  if (/Part 5|Golden/i.test(t))    return 'linear-gradient(135deg,#5c4a10,#1a1404)';
  if (/Part 6|Stone/i.test(t))     return 'linear-gradient(135deg,#10504a,#041410)';
  if (/Part 7|Steel/i.test(t))     return 'linear-gradient(135deg,#10346e,#040c1a)';
  if (/Part 8|JoJolion/i.test(t))  return 'linear-gradient(135deg,#1a1070,#04041a)';
  if (/Part 9|JoJoLands/i.test(t)) return 'linear-gradient(135deg,#2a104e,#080416)';
  return 'linear-gradient(135deg,#2d1a4a,#0f0922)';
}

function createCard(item, ownedInfo) {
  const card = document.createElement('article');
  const rarity = ownedInfo?.rarity || item.rarity || 'N';
  card.className = `card ${rarity}`;
  const imgSrc = resolveImage(item.image || item.img || item.avatar || item.imageUrl || '');
  const label = item.japaneseName || item.name || '?';
  const sub = item.name || '';
  const partInfo = item.part || item.chapter || 'Unknown';
  const kindLabel = item.type === 'stand' ? 'STAND' : 'CHARA';
  const bg = partBgColor(item);
  const initial = label.slice(0, 1);

  const placeholder = `<div class="placeholder" style="background:${bg}">${initial}</div>`;

  let mediaHtml;
  if (imgSrc) {
    mediaHtml = `<img src="${imgSrc}" alt="${label}" loading="lazy"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${placeholder.replace('display:flex', 'display:none').replace('style="', 'style="display:none;')}`;
  } else {
    mediaHtml = placeholder;
  }

  card.innerHTML = `
    <div class="badge">${rarity} ${kindLabel}</div>
    ${mediaHtml}
    <div class="card-body">
      <strong>${label}</strong>
      <p>${sub !== label ? sub : ''}</p>
      <small>${partInfo}</small>
    </div>`;
  card.onclick = () => openDetail(item, rarity);
  return card;
}

function startDraw(kind) {
  switchView('draw');
  if (!canDraw(kind)) {
    document.getElementById('drawHint').textContent = '今日は取得済みです。日付変更後に再挑戦！';
    return;
  }
  const item = selectCard(kind);
  const stage = document.getElementById('drawStage');
  stage.innerHTML = '';
  const back = document.createElement('div');
  back.className = 'card-back card';
  back.textContent = 'SP';
  stage.append(back);
  back.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
    { duration: 220, iterations: 4 }
  );
  setTimeout(() => {
    stage.innerHTML = '';
    stage.append(createCard(item, { rarity: item.rarity }));
    const kindJa = kind === 'character' ? 'キャラクター' : 'スタンド';
    document.getElementById('drawHint').textContent = `${kindJa}を獲得: ${item.japaneseName || item.name}${item.duplicate ? '　/ DUPLICATE' : ''}`;
    renderAll();
  }, 900);
}

// ── Render Functions ────────────────────────────────────────────────────────

function renderAll() { renderHome(); renderCollection(); renderHistory(); renderSettings(); }

function renderHome() {
  const pill = document.getElementById('apiStatus');
  if (state.apiMode === 'live') {
    pill.textContent = `API: ONLINE — キャラ ${state.characters.length}体 / スタンド ${state.stands.length}体`;
    pill.style.borderColor = '#2df4a7';
  } else if (state.apiMode === 'fallback') {
    pill.textContent = `ローカルデータ — キャラ ${state.characters.length}体 / スタンド ${state.stands.length}体`;
    pill.style.borderColor = '#ffd86b';
  } else {
    pill.textContent = 'データ読み込み中...';
  }
  document.getElementById('dailyState').textContent =
    `キャラ: ${canDraw('character') ? '未取得' : '今日は取得済み'} / スタンド: ${canDraw('stand') ? '未取得' : '今日は取得済み'}`;
  renderDestinyCards();
}

function renderDestinyCards() {
  const cd = data.drawHistory.find(x => x.date === today() && x.kind === 'character');
  const sd = data.drawHistory.find(x => x.date === today() && x.kind === 'stand');
  const charBox = document.getElementById('destinyCharacter');
  const standBox = document.getElementById('destinyStand');

  if (cd) {
    const item = state.characters.find(c => c.id === cd.id);
    charBox.innerHTML = '';
    charBox.className = '';
    if (item) charBox.appendChild(createCard(item, { rarity: cd.rarity }));
    else charBox.textContent = cd.name;
  } else {
    charBox.className = 'card-back mini';
    charBox.innerHTML = 'SP';
  }

  if (sd) {
    const item = state.stands.find(s => s.id === sd.id);
    standBox.innerHTML = '';
    standBox.className = '';
    if (item) standBox.appendChild(createCard(item, { rarity: sd.rarity }));
    else standBox.textContent = sd.name;
  } else {
    standBox.className = 'card-back mini';
    standBox.innerHTML = 'SP';
  }
}

function renderCollection() {
  const grid = document.getElementById('collectionGrid');
  const todayBox = document.getElementById('todayResult');
  const filter = document.getElementById('rarityFilter').value;
  grid.innerHTML = '';

  if (state.tab === 'today') {
    grid.classList.add('hidden');
    todayBox.classList.remove('hidden');
    const cd = data.drawHistory.find(x => x.date === today() && x.kind === 'character');
    const sd = data.drawHistory.find(x => x.date === today() && x.kind === 'stand');
    todayBox.innerHTML = `
      <h3>今日のジョジョ運命カード</h3>
      <p>キャラ: ${cd?.name || '---'} (${cd?.rarity || '-'})</p>
      <p>スタンド: ${sd?.name || '---'} (${sd?.rarity || '-'})</p>
      <button class="btn" id="copyShare">結果をコピー</button>`;
    document.getElementById('copyShare').onclick = () =>
      navigator.clipboard.writeText(`今日のStand Pocket\nキャラ: ${cd?.name || '---'}\nスタンド: ${sd?.name || '---'}\nレアリティ: ${cd?.rarity || '-'} / ${sd?.rarity || '-'}`);
    return;
  }

  todayBox.classList.add('hidden');
  grid.classList.remove('hidden');
  const src = state.tab === 'characters' ? state.characters : state.stands;
  const owned = state.tab === 'characters' ? data.ownedCharacters : data.ownedStands;
  let shown = 0;
  src.forEach(item => {
    const info = owned[item.id];
    if (filter !== 'ALL' && info?.rarity !== filter) return;
    grid.append(createCard(item, info));
    shown++;
  });
  document.getElementById('characterRate').textContent = `キャラ ${Object.keys(data.ownedCharacters).length} / ${state.characters.length}`;
  document.getElementById('standRate').textContent = `スタンド ${Object.keys(data.ownedStands).length} / ${state.stands.length}`;
}

function renderHistory() {
  document.getElementById('historyList').innerHTML = data.drawHistory.slice(0, 60).map(h =>
    `<div class="panel"><b>${h.date}</b> ${h.kind === 'character' ? 'キャラ' : 'スタンド'}: ${h.name} <span class="badge">${h.rarity}</span>${h.duplicate ? ' DUPLICATE' : ''}</div>`
  ).join('') || '<p>まだ履歴がありません。</p>';
}

function renderSettings() {
  document.getElementById('storageState').textContent =
    `保存件数: キャラ ${Object.keys(data.ownedCharacters).length} / スタンド ${Object.keys(data.ownedStands).length} / 履歴 ${data.drawHistory.length}`;
}

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(view).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  state.activeView = view;
}

function openDetail(item, rarity) {
  const d = document.getElementById('detailBody');
  const hideKeys = new Set(['id', '_id', 'image', 'img', 'avatar', 'imageUrl', 'type']);
  const imgSrc = resolveImage(item.image || item.img || item.avatar || item.imageUrl || '');
  const imgTag = imgSrc
    ? `<img src="${imgSrc}" style="width:100%;border-radius:10px;margin-bottom:12px;object-fit:contain;max-height:55vh;background:#0d0720" loading="lazy" onerror="this.remove()">`
    : '';

  const rows = Object.entries(item)
    .filter(([k, v]) => !hideKeys.has(k) && v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join('　/　') : String(v);
      return `<p><b>${labelFor(k)}:</b> ${val}</p>`;
    }).join('');

  d.innerHTML = `${imgTag}<h3>${item.japaneseName || item.name}</h3><p style="color:#c0b8d8">${item.name || ''}</p><p>RARITY: <b style="color:var(--gold)">${rarity}</b></p>${rows}`;
  document.getElementById('detailModal').showModal();
}

function labelFor(key) {
  const labels = {
    japaneseName:'日本語名', chapter:'登場作品', part:'Part',
    abilities:'能力', standUser:'スタンド使い', battlecry:'バトルクライ',
    catchphrase:'セリフ', nationality:'国籍', living:'生存', isHuman:'人間',
    destructivePower:'破壊力', speed:'スピード', range:'射程距離',
    durability:'持続力', precision:'精密動作性', developmentPotential:'成長性',
  };
  return labels[key] || key;
}
