const API_BASE = 'https://jojos-bizarre-api.netlify.app/.netlify/functions';
const state = { characters: [], stands: [], apiMode: 'loading', activeView: 'home', drawKind: null, tab: 'characters' };
const KEY = 'standPocketData';
const rarityRates = [['N',0.45],['R',0.3],['SR',0.17],['SSR',0.07],['UR',0.01]];
const data = loadData();

init();
async function init(){ bindUI(); await loadApi(); renderAll(); }
function today(){ return new Date().toLocaleDateString('sv-SE'); }
function loadData(){ return JSON.parse(localStorage.getItem(KEY) || '{"lastCharacterDrawDate":"","lastStandDrawDate":"","ownedCharacters":{},"ownedStands":{},"drawHistory":[]}'); }
function saveData(){ localStorage.setItem(KEY, JSON.stringify(data)); }
function bindUI(){
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  document.getElementById('drawCharacterBtn').onclick=()=>startDraw('character');
  document.getElementById('drawStandBtn').onclick=()=>startDraw('stand');
  document.getElementById('resetAll').onclick=()=>{localStorage.removeItem(KEY); location.reload();};
  document.getElementById('resetDate').onclick=()=>{data.lastCharacterDrawDate='';data.lastStandDrawDate='';saveData();renderHome();};
  document.getElementById('closeModal').onclick=()=>document.getElementById('detailModal').close();
  document.getElementById('rarityFilter').onchange=renderCollection;
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');state.tab=t.dataset.tab;renderCollection();});
}
async function loadApi(){
  try{
    const [c,s] = await Promise.all([fetch(`${API_BASE}/characters`).then(r=>r.json()),fetch(`${API_BASE}/stands`).then(r=>r.json())]);
    state.characters = normalize(c); state.stands = normalize(s); state.apiMode='live';
  }catch(e){ state.characters = window.FALLBACK_DATA.characters; state.stands = window.FALLBACK_DATA.stands; state.apiMode='fallback'; }
}
function normalize(payload){ const arr = Array.isArray(payload)?payload:(payload?.data||payload?.results||[]); return arr.map((x,i)=>({...x,id:String(x.id||i+1)})); }
function canDraw(kind){ return kind==='character' ? data.lastCharacterDrawDate!==today() : data.lastStandDrawDate!==today(); }
function pickRarity(){ let r=Math.random(),acc=0; for(const [k,v] of rarityRates){acc+=v;if(r<=acc) return k;} return 'N'; }
function selectCard(kind){ const pool = kind==='character'?state.characters:state.stands; const owned = kind==='character'?data.ownedCharacters:data.ownedStands; const unowned = pool.filter(c=>!owned[c.id]); const target = (unowned.length?unowned:pool)[Math.floor(Math.random()*((unowned.length?unowned:pool).length))];
  const existing = owned[target.id]; const rarity = existing?existing.rarity:pickRarity(); const duplicate = !!existing;
  if(existing) existing.duplicateCount = (existing.duplicateCount||0)+1;
  else owned[target.id] = { id: target.id, type: kind, rarity, obtainedAt: new Date().toISOString(), duplicateCount: 0 };
  if(kind==='character') data.lastCharacterDrawDate=today(); else data.lastStandDrawDate=today();
  data.drawHistory.unshift({ date:today(), kind, id:target.id, name:target.name||'???', rarity, duplicate }); saveData();
  return { ...target, type:kind, rarity, duplicate };
}
function createCard(item, ownedInfo){
  const card = document.createElement('article'); card.className=`card ${ownedInfo?.rarity||item.rarity||'N'}`;
  const imgSrc = resolveImage(item.image);
  card.innerHTML=`<div class='badge'>${ownedInfo?.rarity||item.rarity||'N'} ${item.type==='stand'?'STAND':'CHARA'}</div>${imgSrc?`<img src='${imgSrc}' onerror='this.remove();this.parentNode.insertAdjacentHTML("afterbegin","<div class=\"placeholder\">？</div>")'>`:`<div class='placeholder'>${(item.japaneseName||item.name||'?').slice(0,1)}</div>`}<div class='card-body'><strong>${item.japaneseName||item.name||'???'}</strong><p>${item.name||''}</p><small>${item.chapter||'Unknown'}</small></div>`;
  card.onclick=()=>openDetail(item, ownedInfo?.rarity || item.rarity);
  return card;
}
function resolveImage(image){ if(!image) return ''; if(/^https?:/.test(image)) return image; return `https://jojos-bizarre-api.netlify.app/${image.replace(/^\//,'')}`; }
function startDraw(kind){ switchView('draw'); if(!canDraw(kind)){document.getElementById('drawHint').textContent='今日は取得済みです。日付変更後に再挑戦！'; return;} const item=selectCard(kind); const stage=document.getElementById('drawStage'); stage.innerHTML=''; const back=document.createElement('div'); back.className='card-back card'; back.textContent='SP'; stage.append(back); back.animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:220,iterations:4}); setTimeout(()=>{stage.innerHTML=''; stage.append(createCard(item,{rarity:item.rarity})); document.getElementById('drawHint').textContent=`${kind==='character'?'キャラクター':'スタンド'}を獲得: ${item.japaneseName||item.name} ${item.duplicate?' / DUPLICATE':''}`; renderAll();},900); }
function renderAll(){ renderHome(); renderCollection(); renderHistory(); renderSettings(); }
function renderHome(){ document.getElementById('apiStatus').textContent = state.apiMode==='live'?'API接続: ONLINE':'API取得に失敗しました。ローカルデータで起動中。'; document.getElementById('dailyState').textContent=`キャラ:${canDraw('character')?'未取得':'今日は取得済み'} / スタンド:${canDraw('stand')?'未取得':'今日は取得済み'}`; }
function renderCollection(){ const grid=document.getElementById('collectionGrid'); const todayBox=document.getElementById('todayResult'); const filter=document.getElementById('rarityFilter').value; grid.innerHTML='';
  if(state.tab==='today'){grid.classList.add('hidden');todayBox.classList.remove('hidden'); const cd=data.drawHistory.find(x=>x.date===today()&&x.kind==='character'); const sd=data.drawHistory.find(x=>x.date===today()&&x.kind==='stand'); todayBox.innerHTML=`<h3>今日のジョジョ運命カード</h3><p>キャラ: ${cd?.name||'---'} (${cd?.rarity||'-'})</p><p>スタンド: ${sd?.name||'---'} (${sd?.rarity||'-'})</p><button class='btn' id='copyShare'>結果をコピー</button>`; document.getElementById('copyShare').onclick=()=>navigator.clipboard.writeText(`今日のStand Pocket\nキャラ: ${cd?.name||'---'}\nスタンド: ${sd?.name||'---'}\nレアリティ: ${cd?.rarity||'-'} / ${sd?.rarity||'-'}`); return; }
  todayBox.classList.add('hidden');grid.classList.remove('hidden');
  const src = state.tab==='characters'?state.characters:state.stands; const owned = state.tab==='characters'?data.ownedCharacters:data.ownedStands;
  src.forEach(item=>{ const info=owned[item.id]; if(filter!=='ALL' && info?.rarity!==filter) return; if(info) grid.append(createCard({...item,type:state.tab==='characters'?'character':'stand'}, info)); else { const u=document.createElement('div'); u.className='card'; u.innerHTML="<div class='placeholder'>???</div><div class='card-body'><strong>UNOPENED</strong></div>"; grid.append(u);} });
  document.getElementById('characterRate').textContent=`キャラ ${Object.keys(data.ownedCharacters).length} / ${state.characters.length}`;
  document.getElementById('standRate').textContent=`スタンド ${Object.keys(data.ownedStands).length} / ${state.stands.length}`;
}
function renderHistory(){ document.getElementById('historyList').innerHTML = data.drawHistory.slice(0,60).map(h=>`<div class='panel'><b>${h.date}</b> ${h.kind==='character'?'キャラ':'スタンド'}: ${h.name} <span>${h.rarity}</span> ${h.duplicate?'DUPLICATE':''}</div>`).join('') || '<p>まだ履歴がありません。</p>'; }
function renderSettings(){ document.getElementById('storageState').textContent=`保存件数: キャラ ${Object.keys(data.ownedCharacters).length} / スタンド ${Object.keys(data.ownedStands).length} / 履歴 ${data.drawHistory.length}`; }
function switchView(view){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); document.getElementById(view).classList.add('active'); document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); }
function openDetail(item, rarity){ const d=document.getElementById('detailBody'); const isStand=!!item.standUser || item.type==='stand'; d.innerHTML=`<h3>${item.japaneseName||item.name}</h3><p>${item.name||''}</p><p>RARITY: ${rarity}</p><p>登場部: ${item.chapter||'-'}</p><p>能力: ${item.abilities||'-'}</p>${isStand?`<p>スタンド使い: ${item.standUser||'-'}</p><p>バトルクライ: ${item.battlecry||'-'}</p>`:`<p>国籍: ${item.nationality||'-'}</p><p>キャッチ: ${item.catchphrase||'-'}</p><p>生存: ${item.living ?? '-'}</p><p>人間: ${item.isHuman ?? '-'}</p>`}`; document.getElementById('detailModal').showModal(); }
