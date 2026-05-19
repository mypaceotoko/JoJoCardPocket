const API_ROOT = 'https://jojos-bizarre-api.netlify.app';
const FETCH_TIMEOUT_MS = 8000;

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

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function tryFetchKind(kind) {
  const endpoints = [
    `${API_ROOT}/.netlify/functions/${kind}`,
    `${API_ROOT}/${kind}`,
    `${API_ROOT}/api/${kind}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const payload = await res.json();
      const items = extractItems(payload, kind);
      if (items.length >= 3) return dedupeItems(items);
    } catch (_) {
      continue;
    }
  }
  return [];
}

function extractItems(payload, kind) {
  if (Array.isArray(payload)) return payload;
  const keys = [kind, 'data', 'results', 'items', 'characters', 'stands'];
  for (const k of keys) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
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
  if (clean.includes('/')) return `${API_ROOT}/${clean}`;
  return `${API_ROOT}/assets/${clean}`;
}

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

function partColor(item) {
  const text = item.part || item.chapter || '';
  if (/Part 1|Phantom/i.test(text)) return '#7b4a2d';
  if (/Part 2|Battle/i.test(text)) return '#5a7a2d';
  if (/Part 3|Stardust/i.test(text)) return '#2d3d7a';
  if (/Part 4|Diamond/i.test(text)) return '#7a2d6e';
  if (/Part 5|Golden/i.test(text)) return '#6e5a1a';
  if (/Part 6|Stone/i.test(text)) return '#1a6e4a';
  if (/Part 7|Steel/i.test(text)) return '#1a4a6e';
  if (/Part 8|JoJolion/i.test(text)) return '#2d1a6e';
  return '#2d1a4a';
}

function createCard(item, ownedInfo) {
  const card = document.createElement('article');
  const rarity = ownedInfo?.rarity || item.rarity || 'N';
  card.className = `card ${rarity}`;
  const imgSrc = resolveImage(item.image || item.img || item.avatar);
  const label = item.japaneseName || item.name || '?';
  const sub = item.name || '';
  const partInfo = item.part || item.chapter || 'Unknown';
  const kindLabel = item.type === 'stand' ? 'STAND' : 'CHARA';
  const bg = partColor(item);

  let mediaHtml;
  if (imgSrc) {
    mediaHtml = `<img src="${imgSrc}" alt="${label}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
<div class="placeholder" style="background:linear-gradient(135deg,${bg},#0f0922);display:none">${label.slice(0,1)}</div>`;
  } else {
    mediaHtml = `<div class="placeholder" style="background:linear-gradient(135deg,${bg},#0f0922)">${label.slice(0,1)}</div>`;
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
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
    { duration: 220, iterations: 4 }
  );
  setTimeout(() => {
    stage.innerHTML = '';
    stage.append(createCard(item, { rarity: item.rarity }));
    const kindJa = kind === 'character' ? 'キャラクター' : 'スタンド';
    const dupLabel = item.duplicate ? '　/ DUPLICATE' : '';
    document.getElementById('drawHint').textContent = `${kindJa}を獲得: ${item.japaneseName || item.name}${dupLabel}`;
    renderAll();
  }, 900);
}

function renderAll() { renderHome(); renderCollection(); renderHistory(); renderSettings(); }

function renderHome() {
  const pill = document.getElementById('apiStatus');
  if (state.apiMode === 'live') {
    pill.textContent = `API接続: ONLINE（キャラ ${state.characters.length}体 / スタンド ${state.stands.length}体）`;
    pill.style.borderColor = '#2df4a7';
  } else if (state.apiMode === 'fallback') {
    pill.textContent = `ローカルデータ使用中（キャラ ${state.characters.length}体 / スタンド ${state.stands.length}体）`;
    pill.style.borderColor = '#ffd86b';
  } else {
    pill.textContent = 'API接続中...';
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
    if (item) charBox.appendChild(createCard(item, { rarity: cd.rarity }));
    else charBox.textContent = cd.name;
  } else {
    charBox.className = 'card-back mini';
    charBox.textContent = 'SP';
  }
  if (sd) {
    const item = state.stands.find(s => s.id === sd.id);
    standBox.innerHTML = '';
    if (item) standBox.appendChild(createCard(item, { rarity: sd.rarity }));
    else standBox.textContent = sd.name;
  } else {
    standBox.className = 'card-back mini';
    standBox.textContent = 'SP';
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
  src.forEach(item => {
    const info = owned[item.id];
    if (filter !== 'ALL' && info?.rarity !== filter) return;
    grid.append(createCard(item, info));
  });
  document.getElementById('characterRate').textContent = `キャラ ${Object.keys(data.ownedCharacters).length} / ${state.characters.length}`;
  document.getElementById('standRate').textContent = `スタンド ${Object.keys(data.ownedStands).length} / ${state.stands.length}`;
}

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = data.drawHistory.slice(0, 60).map(h =>
    `<div class="panel"><b>${h.date}</b> ${h.kind === 'character' ? 'キャラ' : 'スタンド'}: ${h.name} <span>${h.rarity}</span>${h.duplicate ? ' DUPLICATE' : ''}</div>`
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
  const hideKeys = new Set(['id', '_id', 'image', 'img', 'avatar', 'type']);
  const rows = Object.entries(item)
    .filter(([k, v]) => !hideKeys.has(k) && v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join('　/　') : String(v);
      return `<p><b>${labelFor(k)}:</b> ${val}</p>`;
    }).join('');
  const imgSrc = resolveImage(item.image || item.img || item.avatar);
  const imgTag = imgSrc ? `<img src="${imgSrc}" style="width:100%;border-radius:10px;margin-bottom:10px" onerror="this.remove()">` : '';
  d.innerHTML = `${imgTag}<h3>${item.japaneseName || item.name}</h3><p>${item.name || ''}</p><p>RARITY: <b>${rarity}</b></p>${rows}`;
  document.getElementById('detailModal').showModal();
}

function labelFor(key) {
  const labels = {
    japaneseName: '日本語名', chapter: '登場作品', part: 'Part',
    abilities: '能力', standUser: 'スタンド使い', battlecry: 'バトルクライ',
    catchphrase: 'セリフ', nationality: '国籍', living: '生存',
    isHuman: '人間', destructivePower: '破壊力', speed: 'スピード',
    range: '射程距離', durability: '持続力', precision: '精密動作性',
    developmentPotential: '成長性',
  };
  return labels[key] || key;
}
