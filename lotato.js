'use strict';
// ================================================================
// LOTATO — Interface Agent (lotato.js v6.0)
// ================================================================

// ── Base URL (serveur en ligne) ───────────────────────────────────
const API_BASE_URL = 'https://lotato-one.onrender.com';

// ── Tirages ───────────────────────────────────────────────────────
const draws = {
  miami:   { name: 'Miami (Florida)', icon: '🌴', color: '#e74c3c', times: { morning: '1:30 PM',  evening: '9:50 PM' } },
  georgia: { name: 'Georgia',          icon: '🍑', color: '#2980b9', times: { morning: '12:30 PM', evening: '7:00 PM' } },
  newyork: { name: 'New York',          icon: '🗽', color: '#f39c12', times: { morning: '2:30 PM',  evening: '8:00 PM' } },
  texas:   { name: 'Texas',             icon: '⭐', color: '#8e44ad', times: { morning: '12:00 PM', evening: '6:00 PM' } },
  tunisia: { name: 'Tunisie',           icon: '🌙', color: '#1abc9c', times: { morning: '10:30 AM', evening: '2:00 PM' } }
};

// ── Types de paris — Les multiplicateurs sont écrasés depuis l'API ─
let betTypes = {
  borlette: { name: 'BORLETTE',  multiplier: 60,    multiplier2: 20, multiplier3: 10 },
  boulpe:   { name: 'BOUL PE',   multiplier: 60,    multiplier2: 20, multiplier3: 10 },
  lotto3:   { name: 'LOTTO 3',   multiplier: 500 },
  marriage: { name: 'MARYAJ',    multiplier: 1000 },
  grap:     { name: 'GRAP',      multiplier: 500 },
  lotto4:   { name: 'LOTTO 4',   multiplier: 5000 },
  lotto5:   { name: 'LOTTO 5',   multiplier: 25000 }
};

// ── État global ───────────────────────────────────────────────────
let currentUser    = null;
let currentDraw    = null;
let currentDrawTime= null;
let activeBets     = [];
let savedTickets   = [];
let resultsDatabase= {};
let winningTickets = [];
let ticketCounter  = 1;
let companyInfo    = { name: 'Lotato', slogan: 'Chwazi yon Jwet', phone: '', address: '', logo: '', agentCommission: 10 };
let multiDrawBets  = [];
let selectedBalls  = [];
let currentTicketToShare = null;
let isOnline       = true;

// ── API Helper ────────────────────────────────────────────────────
async function apiCall(path, method = 'GET', body = null) {
  const token = localStorage.getItem('lotato_token');
  const url   = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const opts  = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { handleLogout(); throw new Error('Unauthorized'); }
  return res.json();
}

// ── Authentification ──────────────────────────────────────────────
async function checkAuth() {
  const token = localStorage.getItem('lotato_token');
  if (!token) { window.location.href = '/index.html'; return false; }
  try {
    const data = await apiCall('/api/auth/check');
    if (!data.success || data.user.role !== 'agent') {
      localStorage.removeItem('lotato_token');
      window.location.href = '/index.html';
      return false;
    }
    currentUser = data.user;
    return true;
  } catch {
    // En mode hors-ligne, utiliser les données stockées
    const stored = localStorage.getItem('lotato_user');
    if (stored) {
      currentUser = JSON.parse(stored);
      if (currentUser.role === 'agent') return true;
    }
    window.location.href = '/index.html';
    return false;
  }
}

async function handleLogin() {
  const username = (document.getElementById('admin-username') || document.getElementById('login-username'))?.value?.trim();
  const password = (document.getElementById('admin-password') || document.getElementById('login-password'))?.value;
  const errEl    = document.getElementById('login-error');
  if (!username || !password) { if (errEl) { errEl.textContent = 'Antre identifiant ak modpas'; errEl.style.display = 'block'; } return; }
  try {
    const data = await apiCall('/api/auth/login', 'POST', { username, password });
    if (data.success && data.user.role === 'agent') {
      localStorage.setItem('lotato_token', data.token);
      localStorage.setItem('lotato_user',  JSON.stringify(data.user));
      currentUser = data.user;
      hideLoginScreen();
      await initApp();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Identifiants incorrects ou accès refusé'; errEl.style.display = 'block'; }
    }
  } catch {
    if (errEl) { errEl.textContent = 'Serveur inaccessible'; errEl.style.display = 'block'; }
  }
}

function handleLogout() {
  // Nettoyer immédiatement AVANT toute requête réseau
  // (le serveur Render peut être en veille → ne jamais bloquer sur l'API)
  localStorage.removeItem('lotato_token');
  localStorage.removeItem('lotato_user');
  sessionStorage.clear();
  currentUser = null;
  activeBets  = [];
  multiDrawBets = [];

  // Informer le serveur en arrière-plan (fire & forget avec timeout 3s)
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {});
  } catch (_) {}

  // Redirection immédiate vers index.html
  window.location.replace('/index.html');
}

function showLoginScreen() {
  const ls = document.getElementById('login-screen');
  const ma = document.getElementById('main-app');
  if (ls) ls.style.display = 'flex';
  if (ma) ma.style.display = 'none';
}

function hideLoginScreen() {
  // Cacher l'écran de login
  const ls = document.getElementById('login-screen');
  if (ls) ls.style.display = 'none';

  // Cacher TOUS les écrans intermédiaires
  [
    'report-screen','results-check-screen','multi-tickets-screen',
    'report-stats-screen','betting-screen','ticket-management-screen',
    'tickets-screen','winning-tickets-screen','history-screen',
    'connection-check'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Afficher le conteneur principal et la barre de navigation
  const mainContainer = document.getElementById('main-container');
  const bottomNav     = document.getElementById('bottom-nav');
  if (mainContainer) mainContainer.style.display = 'block';
  if (bottomNav)     bottomNav.style.display     = 'flex';

  // Activer l'onglet Akèy
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[data-screen="home"]')?.classList.add('active');
}

// ── Chargement données depuis API ─────────────────────────────────
async function loadSettingsFromAPI() {
  try {
    const res = await apiCall('/api/company-info');
    if (!res) return;
    companyInfo = {
      name:            res.name            || 'Lotato',
      slogan:          res.slogan          || '',
      phone:           res.phone           || '',
      address:         res.address         || '',
      logo:            res.logo            || '',
      agentCommission: res.agentCommission || 10,
      footer:          res.footer          || ''
    };
    // Écraser les multiplicateurs depuis l'API
    if (res.multipliers) {
      const m = res.multipliers;
      if (m.borlette_first)  { betTypes.borlette.multiplier = m.borlette_first; betTypes.boulpe.multiplier = m.borlette_first; }
      if (m.borlette_second) { betTypes.borlette.multiplier2 = m.borlette_second; betTypes.boulpe.multiplier2 = m.borlette_second; }
      if (m.borlette_third)  { betTypes.borlette.multiplier3 = m.borlette_third; betTypes.boulpe.multiplier3 = m.borlette_third; }
      if (m.lotto3)   betTypes.lotto3.multiplier   = m.lotto3;
      if (m.marriage) betTypes.marriage.multiplier = m.marriage;
      if (m.grap)     betTypes.grap.multiplier     = m.grap;
      if (m.lotto4)   betTypes.lotto4.multiplier   = m.lotto4;
      if (m.lotto5)   betTypes.lotto5.multiplier   = m.lotto5;
    }
    updateCompanyDisplay();
  } catch { console.warn('loadSettingsFromAPI failed'); }
}

function updateCompanyDisplay() {
  const nameEl   = document.getElementById('company-name');
  const sloganEl = document.getElementById('company-slogan');
  const logoEl   = document.getElementById('company-logo');
  if (nameEl   && companyInfo.name)   nameEl.textContent = companyInfo.name;
  if (sloganEl && companyInfo.slogan) sloganEl.textContent = companyInfo.slogan;
  if (logoEl   && companyInfo.logo)   logoEl.src = companyInfo.logo;
}

// ── Résultats ─────────────────────────────────────────────────────
async function loadResults() {
  try {
    const res = await apiCall('/api/results');
    if (res?.success) { resultsDatabase = res.results || {}; updateResultsDisplay(); }
  } catch { console.warn('loadResults failed'); }
}

async function checkForNewResults() {
  if (!isOnline) return;
  try {
    const res = await apiCall('/api/results');
    if (res?.success && res.results) { resultsDatabase = res.results; updateResultsDisplay(); }
  } catch {}
}

function updateResultsDisplay() {
  const container = document.getElementById('latest-results');
  if (!container) return;
  container.innerHTML = '';
  Object.entries(draws).forEach(([drawId, drawInfo]) => {
    ['morning', 'evening'].forEach(time => {
      const result = resultsDatabase[drawId]?.[time];
      if (!result) return;
      const div = document.createElement('div');
      div.className = 'lot-result';
      div.innerHTML = `
        <div><strong>${drawInfo.name} — ${time === 'morning' ? 'Maten' : 'Swè'}</strong>
        <br><small>${result.date || ''}</small></div>
        <div style="text-align:right">
          <div class="lot-number" style="color:${drawInfo.color}">${result.lot1}</div>
          <div>${result.lot2 || ''} <small>(×${betTypes.borlette.multiplier2})</small></div>
          <div>${result.lot3 || ''} <small>(×${betTypes.borlette.multiplier3})</small></div>
        </div>`;
      container.appendChild(div);
    });
  });
}

// ── Historique tickets ────────────────────────────────────────────
async function loadTicketHistory() {
  try {
    const res = await apiCall('/api/history');
    if (res?.success && Array.isArray(res.tickets)) {
      // Normaliser le format : le serveur retourne { _id, ticket_number, total_amount, bets, draw, draw_time, created_at }
      savedTickets = res.tickets.map(t => ({
        id:          t._id?.toString()        || t.id,
        number:      t.ticket_number          || t.number,
        date:        t.created_at             || t.date,
        draw:        t.draw,
        drawTime:    t.draw_time              || t.drawTime,
        bets:        (t.bets || []).map(b => ({
          type:       b.bet_type   || b.type,
          name:       betTypes[b.bet_type || b.type]?.name || (b.bet_type || b.type).toUpperCase(),
          number:     b.numbers    || b.number,
          amount:     b.amount,
          multiplier: b.multiplier,
          options:    b.options    || null,
          perOptionAmount: b.options ? (b.amount / Object.values(b.options).filter(Boolean).length || b.amount) : b.amount
        })),
        total:        t.total_amount          || t.total  || 0,
        agentName:    t.agent_id?.full_name   || currentUser?.full_name || 'Agent'
      }));
      updateHistoryScreen();
    }
  } catch { console.warn('loadTicketHistory failed'); }
}

// ── Horloge ───────────────────────────────────────────────────────
function updateCurrentTime() {
  const el = document.getElementById('current-time');
  if (!el) return;
  const now  = new Date();
  const days = ['Dimanch', 'Lendi', 'Madi', 'Mèkredi', 'Jedi', 'Vandredi', 'Samdi'];
  el.textContent = `${days[now.getDay()]} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Navigation principal ──────────────────────────────────────────
function showScreen(screenName) {
  // Masquer tous les écrans flottants
  document.querySelectorAll('.screen, #betting-screen, #report-screen, #results-check-screen, #history-screen, #multi-tickets-screen, #winning-tickets-screen').forEach(el => {
    if (el) el.style.display = 'none';
  });
  const mainContainer = document.getElementById('main-container');
  if (mainContainer) mainContainer.style.display = 'block';

  // Nav
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-screen="${screenName}"]`)?.classList.add('active');

  switch (screenName) {
    case 'home':
      break;

    case 'history':
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('history-screen').style.display = 'block';
      // Recharger depuis l'API puis afficher groupé par tirage
      loadTicketHistory();
      break;

    case 'winning-tickets':
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('winning-tickets-screen').style.display = 'block';
      loadAndCheckWinners();
      break;

    case 'report':
    case 'report-stats':
      // Le rapport s'affiche dans report-stats-screen (lotato.html)
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('report-stats-screen').style.display = 'block';
      loadReportByPeriod('today');
      break;

    case 'results':
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('results-check-screen').style.display = 'block';
      loadResults().then(() => updateResultsDisplay());
      break;
  }
}

// ── Écran de pari ─────────────────────────────────────────────────
function openBettingScreen(drawId, time = 'morning') {
  currentDraw     = drawId;
  currentDrawTime = time;
  const draw      = draws[drawId];
  if (!draw) return;

  const bs = document.getElementById('betting-screen');
  if (!bs) return;

  document.getElementById('main-container').style.display = 'none';
  bs.style.display = 'block';

  const titleEl = document.getElementById('betting-title');
  if (titleEl) {
    const seance = time === 'morning' ? '☀️ Maten' : '🌙 Swè';
    titleEl.innerHTML = `${draw.icon || ''} ${draw.name} <span style="font-size:.85em;opacity:.85;margin-left:6px">${seance}</span>`;
  }

  renderGamesInterface();
  updateBetsList();
}

function closeBettingScreen() {
  document.getElementById('betting-screen').style.display = 'none';
  document.getElementById('main-container').style.display = 'block';
}

function renderGamesInterface() {
  const gi = document.getElementById('games-interface');
  if (!gi) return;
  gi.innerHTML = `
    <div class="game-category">
      <div class="game-category-title">Borlette ak Lotto</div>
      <div class="game-category-grid">
        ${[
          ['borlette', 'BORLETTE',  `×${betTypes.borlette.multiplier}/${betTypes.borlette.multiplier2}/${betTypes.borlette.multiplier3}`, 'borlette'],
          ['boulpe',   'BOUL PE',   `×${betTypes.boulpe.multiplier}`, 'borlette'],
          ['lotto3',   'LOTTO 3',   `×${betTypes.lotto3.multiplier}`, 'lotto'],
          ['marriage', 'MARYAJ',    `×${betTypes.marriage.multiplier}`, 'special'],
          ['grap',     'GRAP',      `×${betTypes.grap.multiplier}`, 'special'],
          ['lotto4',   'LOTTO 4',   `×${betTypes.lotto4.multiplier}`, 'lotto'],
          ['lotto5',   'LOTTO 5',   `×${betTypes.lotto5.multiplier}`, 'lotto']
        ].map(([type, name, multi, cls]) => `
          <div class="game-item ${cls}" data-game="${type}">
            <div class="game-name">${name}</div>
            <div class="game-multiplier">${multi}</div>
          </div>`).join('')}
      </div>
    </div>`;
  gi.querySelectorAll('.game-item').forEach(el =>
    el.addEventListener('click', () => showBetForm(el.dataset.game))
  );
}

// ── Formulaires de pari ───────────────────────────────────────────
function showBetForm(gameType) {
  const bf = document.getElementById('bet-form');
  if (!bf) return;
  bf.style.display = 'block';
  document.getElementById('games-interface').style.display = 'none';

  // Style commun inline partagé par tous les types
  const ROW = `style="display:flex;gap:10px;align-items:flex-end;margin-bottom:10px"`;
  const INP = `style="font-size:1.4rem;font-weight:800;text-align:center;letter-spacing:3px;width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:10px"`;
  const AMT = `style="font-size:1.3rem;font-weight:700;text-align:center;width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:10px"`;

  let html = '';
  switch (gameType) {
    case 'borlette':
    case 'boulpe':
      html = `<h3>${betTypes[gameType].name} <small style="font-size:.7em;color:#94a3b8">×${betTypes[gameType].multiplier}/${betTypes[gameType].multiplier2}/${betTypes[gameType].multiplier3}</small></h3>
        <div ${ROW}>
          <div style="flex:1.2"><label style="font-size:.8rem;font-weight:700;color:#475569">Nimewo (2 chif)</label>
            <input type="text" id="bet-number" maxlength="2" inputmode="numeric" placeholder="23" ${INP}></div>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">Kantite (G)</label>
            <input type="number" id="bet-amount" min="1" placeholder="100" ${AMT}></div>
        </div>`;
      break;

    case 'lotto3':
      html = `<h3>LOTTO 3 <small style="font-size:.7em;color:#94a3b8">×${betTypes.lotto3.multiplier}</small></h3>
        <div ${ROW}>
          <div style="flex:1.2"><label style="font-size:.8rem;font-weight:700;color:#475569">Nimewo (3 chif)</label>
            <input type="text" id="bet-number" maxlength="3" inputmode="numeric" placeholder="456" ${INP}></div>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">Kantite (G)</label>
            <input type="number" id="bet-amount" min="1" placeholder="50" ${AMT}></div>
        </div>`;
      break;

    case 'marriage':
      html = `<h3>MARYAJ <small style="font-size:.7em;color:#94a3b8">×${betTypes.marriage.multiplier}</small></h3>
        <div ${ROW}>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">1e Boule</label>
            <input type="text" id="bet-num1" maxlength="2" inputmode="numeric" placeholder="12" ${INP}></div>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">2e Boule</label>
            <input type="text" id="bet-num2" maxlength="2" inputmode="numeric" placeholder="34" ${INP}></div>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">Kantite (G)</label>
            <input type="number" id="bet-amount" min="1" placeholder="50" ${AMT}></div>
        </div>`;
      break;

    case 'grap':
      html = `<h3>GRAP <small style="font-size:.7em;color:#94a3b8">×${betTypes.grap.multiplier} — 3 chif idantik</small></h3>
        <div ${ROW}>
          <div style="flex:1.2"><label style="font-size:.8rem;font-weight:700;color:#475569">Nimewo (ex: 111)</label>
            <input type="text" id="bet-number" maxlength="3" inputmode="numeric" placeholder="111" ${INP}></div>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">Kantite (G)</label>
            <input type="number" id="bet-amount" min="1" placeholder="50" ${AMT}></div>
        </div>`;
      break;

    case 'lotto4':
    case 'lotto5': {
      const is5 = gameType === 'lotto5';
      html = `<h3>${is5 ? 'LOTTO 5' : 'LOTTO 4'} <small style="font-size:.7em;color:#94a3b8">×${betTypes[gameType].multiplier}</small></h3>
        <div ${ROW}>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">${is5 ? '1e (3 chif)' : '1e (2 chif)'}</label>
            <input type="text" id="bet-num1" maxlength="${is5 ? 3 : 2}" inputmode="numeric" placeholder="${is5 ? '456' : '23'}" ${INP}></div>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">2e (2 chif)</label>
            <input type="text" id="bet-num2" maxlength="2" inputmode="numeric" placeholder="78" ${INP}></div>
          <div style="flex:1"><label style="font-size:.8rem;font-weight:700;color:#475569">Kantite/Opsyon (G)</label>
            <input type="number" id="bet-amount" min="1" placeholder="50" ${AMT}></div>
        </div>
        <div class="options-container" style="margin-top:8px">
          <div class="option-checkbox"><input type="checkbox" id="opt1"><label for="opt1">Opsyon 1 <span class="option-multiplier">×${betTypes[gameType].multiplier}</span></label></div>
          <div class="option-checkbox"><input type="checkbox" id="opt2"><label for="opt2">Opsyon 2 <span class="option-multiplier">×${betTypes[gameType].multiplier}</span></label></div>
          <div class="option-checkbox"><input type="checkbox" id="opt3"><label for="opt3">Opsyon 3 Anagram <span class="option-multiplier">×${betTypes[gameType].multiplier}</span></label></div>
        </div>`;
      break;
    }
  }
  html += `<div class="bet-actions">
    <button class="btn-primary" id="add-bet-btn">+ Ajoute Parye</button>
    <button class="btn-secondary" id="back-to-games-btn">Retounen</button>
  </div>`;
  bf.innerHTML = html;

  // Auto-focus
  const firstInput = bf.querySelector('input');
  if (firstInput) firstInput.focus();

  // Auto-tab
  bf.querySelectorAll('input[maxlength]').forEach(inp => {
    inp.addEventListener('input', () => {
      if (inp.value.length >= parseInt(inp.maxLength)) {
        const allInputs = [...bf.querySelectorAll('input[maxlength], input[type="number"]')];
        const idx = allInputs.indexOf(inp);
        if (idx >= 0 && idx < allInputs.length - 1) allInputs[idx + 1].focus();
      }
    });
  });

  document.getElementById('add-bet-btn').addEventListener('click', () => addBet(gameType));
  document.getElementById('back-to-games-btn').addEventListener('click', () => {
    bf.style.display = 'none';
    document.getElementById('games-interface').style.display = 'block';
  });
}

function addBet(gameType) {
  const bt     = betTypes[gameType];
  let number   = '';
  let amount   = 0;
  let options  = null;

  switch (gameType) {
    case 'borlette':
    case 'boulpe': {
      number = document.getElementById('bet-number')?.value?.trim() || '';
      amount = parseInt(document.getElementById('bet-amount')?.value || '0');
      if (!/^\d{2}$/.test(number)) return showNotification('Borlette/Boul Pe: 2 chif obligatwa', 'warning');
      if (gameType === 'boulpe' && number[0] !== number[1]) return showNotification('Boul Pe: de chif yo dwe menm (ex: 11, 22)', 'warning');
      break;
    }
    case 'lotto3': {
      number = document.getElementById('bet-number')?.value?.trim() || '';
      amount = parseInt(document.getElementById('bet-amount')?.value || '0');
      if (!/^\d{3}$/.test(number)) return showNotification('Lotto 3: 3 chif obligatwa', 'warning');
      break;
    }
    case 'marriage': {
      const n1 = document.getElementById('bet-num1')?.value?.trim() || '';
      const n2 = document.getElementById('bet-num2')?.value?.trim() || '';
      amount = parseInt(document.getElementById('bet-amount')?.value || '0');
      if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) return showNotification('Maryaj: 2 boule de 2 chif chak', 'warning');
      number = `${n1}*${n2}`;
      break;
    }
    case 'grap': {
      number = document.getElementById('bet-number')?.value?.trim() || '';
      amount = parseInt(document.getElementById('bet-amount')?.value || '0');
      if (!/^\d{3}$/.test(number) || !(number[0] === number[1] && number[1] === number[2]))
        return showNotification('Grap: 3 chif idantik (ex: 111, 555)', 'warning');
      break;
    }
    case 'lotto4':
    case 'lotto5': {
      const n1     = document.getElementById('bet-num1')?.value?.trim() || '';
      const n2     = document.getElementById('bet-num2')?.value?.trim() || '';
      const is5    = gameType === 'lotto5';
      const o1     = document.getElementById('opt1')?.checked || false;
      const o2     = document.getElementById('opt2')?.checked || false;
      const o3     = document.getElementById('opt3')?.checked || false;
      const optCnt = [o1, o2, o3].filter(Boolean).length;
      const perAmt = parseInt(document.getElementById('bet-amount')?.value || '0');
      if (is5 ? !/^\d{3}$/.test(n1) : !/^\d{2}$/.test(n1)) return showNotification(`${is5 ? 'Lotto 5: 1e boule 3 chif' : 'Lotto 4: 1e boule 2 chif'}`, 'warning');
      if (!/^\d{2}$/.test(n2)) return showNotification('2e boule: 2 chif obligatwa', 'warning');
      if (optCnt === 0) return showNotification('Chwazi omwen yon opsyon', 'warning');
      if (isNaN(perAmt) || perAmt <= 0) return showNotification('Kantite valab obligatwa', 'warning');
      number  = n1 + n2;
      amount  = perAmt * optCnt;
      options = { option1: o1, option2: o2, option3: o3 };
      activeBets.push({ id: Date.now() + Math.random(), type: gameType, name: bt.name, number, amount, multiplier: bt.multiplier, options, perOptionAmount: perAmt });
      updateBetsList();
      showNotification(`${bt.name} ajoute!`, 'success');
      clearBetForm();
      return;
    }
  }

  if (isNaN(amount) || amount <= 0) return showNotification('Kantite valab obligatwa', 'warning');
  activeBets.push({ id: Date.now() + Math.random(), type: gameType, name: bt.name, number, amount, multiplier: bt.multiplier });
  updateBetsList();
  showNotification(`${bt.name} ajoute!`, 'success');
  clearBetForm();
}

function clearBetForm() {
  document.getElementById('bet-form')?.querySelectorAll('input').forEach(i => { i.value = ''; if (i.type === 'checkbox') i.checked = false; });
  const firstInput = document.getElementById('bet-form')?.querySelector('input');
  if (firstInput) firstInput.focus();
}

// ── Liste des paris ───────────────────────────────────────────────
function updateBetsList() {
  const list    = document.getElementById('bets-list');
  const totalEl = document.getElementById('bet-total');
  if (!list) return;

  if (activeBets.length === 0) {
    list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px">Pa gen okenn parye aktif</p>';
    if (totalEl) totalEl.textContent = '0 G';
    updateCartBadge();
    return;
  }

  let total = 0;
  list.innerHTML = activeBets.map((bet, idx) => {
    total += bet.amount;
    let opts = '';
    if (bet.options) {
      const ks = [];
      if (bet.options.option1) ks.push('O1');
      if (bet.options.option2) ks.push('O2');
      if (bet.options.option3) ks.push('O3');
      if (ks.length) opts = ` (${ks.join(',')})`;
    }
    return `<div class="bet-item">
      <div class="bet-details"><strong>${bet.name}</strong><br>${bet.number}${opts}</div>
      <div class="bet-amount">${bet.amount} G
        <span class="bet-remove" data-idx="${idx}"><i class="fas fa-times"></i></span>
      </div>
    </div>`;
  }).join('');

  if (totalEl) totalEl.textContent = `${total} G`;
  updateCartBadge();

  list.querySelectorAll('.bet-remove').forEach(btn =>
    btn.addEventListener('click', () => {
      activeBets.splice(parseInt(btn.dataset.idx), 1);
      updateBetsList();
    })
  );
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) badge.textContent = activeBets.length;
}

// ── Sauvegarde + Impression ───────────────────────────────────────
async function saveTicket() {
  if (activeBets.length === 0) { showNotification('Pa gen parye pou sove', 'warning'); return null; }

  const total  = activeBets.reduce((s, b) => s + b.amount, 0);
  const ticket = {
    number:   ticketCounter,
    date:     new Date().toISOString(),
    draw:     currentDraw,
    drawTime: currentDrawTime,
    bets:     [...activeBets],
    total,
    agentName: currentUser?.full_name || 'Agent'
  };

  try {
    const res = await apiCall('/api/tickets', 'POST', {
      draw:     currentDraw,
      drawTime: currentDrawTime,
      bets:     activeBets.map(b => ({
        type:       b.type,
        number:     b.number,
        amount:     b.amount,
        multiplier: b.multiplier,
        options:    b.options || null
      })),
      total
    });
    if (res?.ticketNumber) ticket.serverNumber = res.ticketNumber;
  } catch { /* hors-ligne, on continue */ }

  savedTickets.push(ticket);
  ticketCounter++;
  activeBets = []; // ← vider le panier après sauvegarde
  updateBetsList();
  showNotification('Fiche sove avèk siksè!', 'success');
  return ticket;
}

function buildTicketHTML(ticket) {
  const drawInfo = draws[ticket.draw] || { name: ticket.draw };
  const betsRows = ticket.bets.map(b => {
    let opts = '';
    if (b.options) {
      const ks = [];
      if (b.options.option1) ks.push('O1');
      if (b.options.option2) ks.push('O2');
      if (b.options.option3) ks.push('O3');
      if (ks.length) opts = ` (${ks.join(',')})`;
    }
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;">
      <strong>${b.name}</strong><span>${b.number}${opts}</span><span>${b.amount} G</span>
    </div>`;
  }).join('');

  return `<html><head><title>Ticket</title>
    <style>body{font-family:Arial,sans-serif;max-width:320px;margin:0 auto;padding:20px;font-size:12px}
    .header{text-align:center;margin-bottom:10px} h2{font-size:16px;margin:5px 0} .total{font-weight:bold;font-size:14px;text-align:right;margin-top:8px}
    @media print{@page{margin:0;size:80mm auto}body{max-width:100%}}</style></head>
    <body>
    <div class="header">
      ${companyInfo.logo ? `<img src="${companyInfo.logo}" style="max-width:60px"><br>` : ''}
      <h2>${companyInfo.name.toUpperCase()}</h2>
      ${companyInfo.slogan ? `<small>${companyInfo.slogan}</small><br>` : ''}
    </div>
    <div>Fiche #${ticket.serverNumber || String(ticket.number).padStart(6,'0')}</div>
    <div>${new Date(ticket.date).toLocaleString('fr-FR')}</div>
    <div><strong>Tiraj:</strong> ${drawInfo.name} — ${ticket.drawTime === 'morning' ? 'Maten' : 'Swè'}</div>
    <hr>
    ${betsRows}
    <div class="total">Total: ${ticket.total} G</div>
    <hr>
    <div style="text-align:center">${companyInfo.footer || 'Mèsi pou konfyans ou!'}</div>
    ${companyInfo.phone ? `<div style="text-align:center">📞 ${companyInfo.phone}</div>` : ''}
    </body></html>`;
}

async function printTicket() {
  if (activeBets.length === 0) { showNotification('Pa gen parye pou enprime', 'warning'); return; }
  const ticket = await saveTicket();
  if (!ticket) return;
  const w = window.open('', '_blank');
  w.document.write(buildTicketHTML(ticket));
  w.document.close();
  w.print();
}

async function shareTicketAfterSave() {
  if (activeBets.length === 0) { showNotification('Pa gen parye pou voye', 'warning'); return; }
  const ticket = await saveTicket();
  if (!ticket) return;
  await openShareModal(ticket);
}

function formatTicketText(ticket) {
  const drawInfo = draws[ticket.draw] || { name: ticket.draw };
  const lines = [
    `═══════════════════════════`,
    `🏢 ${companyInfo.name.toUpperCase()}`,
    `🎫 TICKET #${ticket.serverNumber || String(ticket.number).padStart(6,'0')}`,
    `📅 ${new Date(ticket.date).toLocaleString('fr-FR')}`,
    `🎲 ${drawInfo.name} — ${ticket.drawTime === 'morning' ? 'MATEN' : 'SWÈ'}`,
    `───────────────────────────`
  ];
  ticket.bets.forEach(b => lines.push(`🔸 ${b.name} ${b.number}  ${b.amount} G`));
  lines.push(`───────────────────────────`);
  lines.push(`💰 TOTAL: ${ticket.total} G`);
  if (companyInfo.phone) lines.push(`📞 ${companyInfo.phone}`);
  lines.push(`🙏 ${companyInfo.footer || 'Mèsi pou konfyans ou!'}`);
  lines.push(`═══════════════════════════`);
  return lines.join('\n');
}

// ── Modal d'envoi multi-canal ─────────────────────────────────────
function initSendModal() {
  // Le modal est créé dynamiquement dans openShareModal()
}

async function openShareModal(ticket) {
  currentTicketToShare = ticket;
  const text = formatTicketText(ticket);

  // Supprimer l'ancien modal s'il existe (évite les doublons de listeners)
  const oldModal = document.getElementById('dynamic-share-modal');
  if (oldModal) oldModal.remove();

  // Créer le modal à chaque fois pour avoir des listeners propres
  const modal = document.createElement('div');
  modal.id = 'dynamic-share-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  document.body.appendChild(modal);

  modal.innerHTML = `
    <div style="background:white;border-radius:20px 20px 0 0;padding:22px;width:100%;max-width:480px;
      animation:slideUp .25s ease-out">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-weight:800;font-size:1rem"><i class="fas fa-share-alt" style="color:#8e44ad"></i> Voye Ticket</h3>
        <button id="sm-close" style="background:none;border:none;font-size:1.5rem;color:#94a3b8;cursor:pointer;line-height:1">×</button>
      </div>

      <!-- Aperçu du ticket -->
      <div style="background:#f8fafc;border-radius:8px;padding:10px;font-size:.75rem;font-family:monospace;
        white-space:pre-wrap;max-height:120px;overflow-y:auto;margin-bottom:14px;color:#2c3e50;border:1px solid #e2e8f0"
      >${text}</div>

      <!-- Champ téléphone (caché par défaut) -->
      <div id="sm-phone-row" style="display:none;margin-bottom:14px">
        <label style="font-size:.82rem;font-weight:700;color:#475569;display:block;margin-bottom:6px">
          <i class="fas fa-phone"></i> Nimewo telefòn
        </label>
        <div style="display:flex;gap:8px">
          <input type="tel" id="sm-phone" placeholder="+509 XXXX XXXX" inputmode="tel"
            style="flex:1;padding:11px;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;outline:none">
          <button id="sm-send" style="background:#25D366;color:white;border:none;
            border-radius:8px;padding:11px 16px;font-weight:800;cursor:pointer;font-size:.9rem;white-space:nowrap">
            <i class="fas fa-paper-plane"></i> Voye
          </button>
        </div>
      </div>

      <!-- Grille des méthodes -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <button id="sm-wa"
          style="background:#25D366;color:white;border:none;border-radius:12px;padding:13px;
          font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.9rem">
          <i class="fab fa-whatsapp" style="font-size:1.2rem"></i> WhatsApp
        </button>
        <button id="sm-sms"
          style="background:#3498db;color:white;border:none;border-radius:12px;padding:13px;
          font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.9rem">
          <i class="fas fa-comment-sms" style="font-size:1.1rem"></i> SMS
        </button>
        <button id="sm-native"
          style="background:#8e44ad;color:white;border:none;border-radius:12px;padding:13px;
          font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.9rem">
          <i class="fas fa-share-alt" style="font-size:1.1rem"></i> Pataje
        </button>
        <button id="sm-copy"
          style="background:#f39c12;color:white;border:none;border-radius:12px;padding:13px;
          font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.9rem">
          <i class="fas fa-copy" style="font-size:1.1rem"></i> Kopye
        </button>
      </div>

      <button id="sm-cancel"
        style="width:100%;padding:12px;background:#f1f5f9;border:none;border-radius:10px;
        font-weight:700;color:#475569;cursor:pointer">Anile</button>
    </div>
    <style>@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}</style>`;

  // ── Helpers ──────────────────────────────────────
  function closeModal() { modal.remove(); }

  let pendingMethod = null;

  function showPhoneInput(method) {
    pendingMethod = method;
    const phoneRow = modal.querySelector('#sm-phone-row');
    const phoneInp = modal.querySelector('#sm-phone');
    phoneRow.style.display = 'block';
    // Changer couleur du bouton Voye selon la méthode
    const sendBtn = modal.querySelector('#sm-send');
    sendBtn.style.background = method === 'whatsapp' ? '#25D366' : '#3498db';
    phoneInp.focus();
  }

  function doSend() {
    const raw    = modal.querySelector('#sm-phone')?.value?.trim() || '';
    if (!raw) { showNotification('Antre nimewo telefòn', 'warning'); return; }
    const digits = raw.replace(/\D/g, '');
    if (pendingMethod === 'whatsapp') {
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank');
      showNotification('Voye sou WhatsApp!', 'success');
    } else {
      window.location.href = `sms:${raw}?body=${encodeURIComponent(text)}`;
    }
    closeModal();
  }

  // ── Listeners — tous attachés une seule fois ──────
  modal.querySelector('#sm-close').addEventListener('click', closeModal);
  modal.querySelector('#sm-cancel').addEventListener('click', closeModal);

  modal.querySelector('#sm-wa').addEventListener('click', () => showPhoneInput('whatsapp'));
  modal.querySelector('#sm-sms').addEventListener('click', () => showPhoneInput('sms'));

  modal.querySelector('#sm-send').addEventListener('click', doSend);
  modal.querySelector('#sm-phone').addEventListener('keypress', e => { if (e.key === 'Enter') doSend(); });

  // Web Share API natif (Bluetooth, NFC, autres apps installées)
  modal.querySelector('#sm-native').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Ticket #${ticket.serverNumber || ticket.number}`, text });
        closeModal();
        showNotification('Ticket pataje!', 'success');
      } catch (e) {
        if (e.name !== 'AbortError') {
          // Fallback : copier
          try { await navigator.clipboard.writeText(text); } catch (_) {}
          showNotification('Kopye! Kole nan aplikasyon ou vle.', 'info');
          closeModal();
        }
      }
    } else {
      showNotification('Fonksyon sa pa disponib — ap kopye a la place', 'info');
      try { await navigator.clipboard.writeText(text); } catch (_) {}
      closeModal();
    }
  });

  // Copier dans le presse-papier
  modal.querySelector('#sm-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    showNotification('Ticket kopye! Kole kote ou vle.', 'success');
    closeModal();
  });

  // Fermer en cliquant l'arrière-plan
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

// ── Vérification des gagnants ─────────────────────────────────────

// Charger tickets + résultats depuis l'API puis vérifier
async function loadAndCheckWinners() {
  showNotification('Ap chèche fich gagnant…', 'info');
  await Promise.all([loadTicketHistory(), loadResults()]);
  checkWinningTickets();
}

function checkBetAgainstResult(bet, result) {
  const lot1 = result.lot1, lot2 = result.lot2 || '', lot3 = result.lot3 || '';
  const lot1Last2 = lot1.length >= 2 ? lot1.slice(-2) : lot1;

  switch (bet.type) {
    case 'borlette':
    case 'boulpe':
      if (bet.number === lot1Last2) return { isWinner: true, winAmount: bet.amount * betTypes.borlette.multiplier,  winType: '1e Lot' };
      if (bet.number === lot2)      return { isWinner: true, winAmount: bet.amount * betTypes.borlette.multiplier2, winType: '2e Lot' };
      if (bet.number === lot3)      return { isWinner: true, winAmount: bet.amount * betTypes.borlette.multiplier3, winType: '3e Lot' };
      break;
    case 'lotto3':
      if (bet.number === lot1) return { isWinner: true, winAmount: bet.amount * betTypes.lotto3.multiplier, winType: 'Lotto 3' };
      break;
    case 'marriage': {
      const [n1, n2] = bet.number.split('*');
      if ([lot1Last2, lot2, lot3].includes(n1) && [lot1Last2, lot2, lot3].includes(n2))
        return { isWinner: true, winAmount: bet.amount * betTypes.marriage.multiplier, winType: 'Maryaj' };
      break;
    }
    case 'grap':
      if (lot1 === lot1[0].repeat(3) && bet.number === lot1)
        return { isWinner: true, winAmount: bet.amount * betTypes.grap.multiplier, winType: 'Grap' };
      break;
    case 'lotto4': {
      let win = 0;
      const per = bet.perOptionAmount || bet.amount;
      if (bet.options?.option1 && bet.number === lot2 + lot3)       win += per * betTypes.lotto4.multiplier;
      if (bet.options?.option2 && bet.number === lot1Last2 + lot2)   win += per * betTypes.lotto4.multiplier;
      if (bet.options?.option3) {
        const tmp = (lot2 + lot3).split('');
        let ok = true;
        for (const d of bet.number.split('')) { const i = tmp.indexOf(d); if (i === -1) { ok = false; break; } tmp.splice(i, 1); }
        if (ok) win += per * betTypes.lotto4.multiplier;
      }
      if (win > 0) return { isWinner: true, winAmount: win, winType: 'Lotto 4' };
      break;
    }
    case 'lotto5': {
      let win5 = 0;
      const per5 = bet.perOptionAmount || bet.amount;
      if (bet.options?.option1 && bet.number === lot1 + lot2) win5 += per5 * betTypes.lotto5.multiplier;
      if (bet.options?.option2 && bet.number === lot1 + lot3) win5 += per5 * betTypes.lotto5.multiplier;
      if (bet.options?.option3) {
        const all = (lot1 + lot2 + lot3).split('');
        let ok = true;
        for (const d of bet.number.split('')) { const i = all.indexOf(d); if (i === -1) { ok = false; break; } all.splice(i, 1); }
        if (ok) win5 += per5 * betTypes.lotto5.multiplier;
      }
      if (win5 > 0) return { isWinner: true, winAmount: win5, winType: 'Lotto 5' };
      break;
    }
  }
  return { isWinner: false, winAmount: 0, winType: '' };
}

function checkWinningTickets() {
  winningTickets = [];
  savedTickets.forEach(ticket => {
    // Accès au résultat : resultsDatabase[draw][drawTime] contient { lot1, lot2, lot3 }
    const drawResults = resultsDatabase[ticket.draw];
    if (!drawResults) return;

    // Chercher dans toutes les dates disponibles pour ce tirage et cette séance
    let result = null;
    Object.entries(drawResults).forEach(([time, r]) => {
      if (time === ticket.drawTime) result = r;
    });
    if (!result) return;

    let totalWinnings = 0;
    const winBets = [];
    (ticket.bets || []).forEach(bet => {
      const info = checkBetAgainstResult(bet, result);
      if (info.isWinner) { winBets.push({ ...bet, winAmount: info.winAmount, winType: info.winType }); totalWinnings += info.winAmount; }
    });
    if (winBets.length > 0) winningTickets.push({ ...ticket, winningBets: winBets, totalWinnings, result });
  });

  displayWinningTickets();
  showNotification(winningTickets.length > 0 ? `${winningTickets.length} fiche gagnant!` : 'Pa gen fiche gagnant pou moman sa', winningTickets.length > 0 ? 'success' : 'info');
}

function displayWinningTickets() {
  const container = document.getElementById('winning-tickets-container');
  const summary   = document.getElementById('winning-summary');
  if (!container) return;

  if (!winningTickets.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px;color:#94a3b8">
        <i class="fas fa-trophy" style="font-size:2.5rem;margin-bottom:12px;display:block"></i>
        <p>Pa gen fiche gagnant pou moman sa</p>
        <small>Rezilta yo dwe pibliye anvan wè fiche gagnant</small>
      </div>`;
    if (summary) summary.innerHTML = '';
    return;
  }

  const totalGains = winningTickets.reduce((s, t) => s + t.totalWinnings, 0);

  // Résumé
  if (summary) summary.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:linear-gradient(135deg,#f39c12,#e67e22);color:white;border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800">${winningTickets.length}</div>
        <div style="font-size:.8rem;opacity:.9">Fiche Gagnant</div>
      </div>
      <div style="background:linear-gradient(135deg,#27ae60,#1e8449);color:white;border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800">${totalGains.toLocaleString()}</div>
        <div style="font-size:.8rem;opacity:.9">Total Gains (G)</div>
      </div>
    </div>`;

  // Détail de chaque ticket gagnant
  container.innerHTML = winningTickets.map(t => {
    const drawInfo = draws[t.draw] || { name: t.draw, icon: '' };
    const seance   = t.drawTime === 'morning' ? '☀️ Maten' : '🌙 Swè';

    // Résultat du tirage
    const resRow = `
      <div style="background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:10px;font-size:.88rem">
        <strong>Rezilta Tiraj:</strong>
        <span style="margin-left:8px">
          <span style="background:#e74c3c;color:white;padding:3px 10px;border-radius:20px;font-weight:800;font-size:1rem">${t.result.lot1}</span>
          ${t.result.lot2 ? `<span style="background:#3498db;color:white;padding:3px 10px;border-radius:20px;font-weight:800;margin-left:4px">${t.result.lot2}</span>` : ''}
          ${t.result.lot3 ? `<span style="background:#8e44ad;color:white;padding:3px 10px;border-radius:20px;font-weight:800;margin-left:4px">${t.result.lot3}</span>` : ''}
        </span>
      </div>`;

    // Bets gagnants avec détail
    const winRows = t.winningBets.map(b => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:8px 10px;background:#f0fdf4;border-radius:8px;margin-bottom:6px;border-left:3px solid #27ae60">
        <div>
          <span style="font-weight:800;color:#2c3e50">${b.name}</span>
          <span style="background:#27ae60;color:white;padding:2px 8px;border-radius:12px;margin-left:6px;font-weight:800">${b.number}</span>
          <span style="color:#64748b;font-size:.8rem;margin-left:6px">${b.winType} (mise: ${b.amount} G × ${b.multiplier})</span>
        </div>
        <span style="font-weight:800;color:#27ae60;font-size:1.1rem">+${b.winAmount.toLocaleString()} G</span>
      </div>`).join('');

    // Bets non-gagnants (pour transparence)
    const loseRows = (t.bets || [])
      .filter(b => !t.winningBets.find(w => w.number === b.number && w.type === b.type))
      .map(b => `
        <div style="display:flex;justify-content:space-between;padding:6px 10px;
          color:#94a3b8;font-size:.82rem;border-left:3px solid #e2e8f0;margin-bottom:4px">
          <span>${b.name} <strong>${b.number}</strong> — ${b.amount} G</span>
          <span>❌</span>
        </div>`).join('');

    return `
      <div style="background:white;border-radius:14px;padding:16px;margin-bottom:16px;
        box-shadow:0 4px 16px rgba(39,174,96,.15);border:2px solid #d1fae5">
        <!-- Header ticket -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <span style="font-weight:800;font-size:1rem">${drawInfo.icon||''} ${drawInfo.name}</span>
            <span style="color:#64748b;font-size:.82rem;margin-left:6px">${seance}</span>
          </div>
          <div style="text-align:right">
            <div style="font-size:.75rem;color:#94a3b8">Fiche #${t.serverNumber || String(t.number).padStart(4,'0')}</div>
            <div style="font-size:.75rem;color:#94a3b8">${new Date(t.date).toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
        ${resRow}
        <div style="font-weight:700;font-size:.85rem;color:#27ae60;margin-bottom:6px">✅ Parye Gagnant:</div>
        ${winRows}
        ${loseRows ? `<div style="font-weight:700;font-size:.82rem;color:#94a3b8;margin:8px 0 4px">Parye pa genyen:</div>${loseRows}` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;
          margin-top:12px;padding-top:10px;border-top:2px solid #d1fae5">
          <span style="color:#64748b;font-size:.85rem">Total mise: ${(t.total||0).toLocaleString()} G</span>
          <span style="font-weight:800;font-size:1.2rem;color:#27ae60">Genyen: ${t.totalWinnings.toLocaleString()} G</span>
        </div>
      </div>`;
  }).join('');
}

// ── Historique groupé par tirage ─────────────────────────────────
function updateHistoryScreen() {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (!savedTickets.length) {
    list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:24px">Pa gen fiche ki sove</p>';
    return;
  }

  // Grouper par tirage + séance
  const groups = {};
  [...savedTickets]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(t => {
      const key = `${t.draw}__${t.drawTime}`;
      if (!groups[key]) groups[key] = { draw: t.draw, drawTime: t.drawTime, tickets: [] };
      groups[key].tickets.push(t);
    });

  list.innerHTML = Object.values(groups).map(g => {
    const drawInfo = draws[g.draw] || { name: g.draw, icon: '' };
    const seance   = g.drawTime === 'morning' ? '☀️ Maten' : '🌙 Swè';
    const total    = g.tickets.reduce((s, t) => s + (t.total || 0), 0);
    const rows     = g.tickets.map(t => `
      <div class="history-item" style="border-left:3px solid #e2e8f0;padding-left:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700">#${t.serverNumber || String(t.number).padStart(4,'0')}</span>
          <span style="color:#64748b;font-size:.8rem">${new Date(t.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <div style="font-size:.85rem;color:#475569">
          ${(t.bets || []).map(b => `${b.name} <strong>${b.number}</strong> — ${b.amount} G`).join(' &nbsp;|&nbsp; ')}
        </div>
        <div style="text-align:right;font-weight:800;color:#2c3e50">Total: ${t.total} G</div>
      </div>`).join('');

    return `
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;
          background:linear-gradient(135deg,#1e293b,#334155);color:white;
          padding:12px 16px;border-radius:10px;margin-bottom:10px;cursor:pointer"
          onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none'?'block':'none'">
          <span style="font-weight:800;font-size:1rem">${drawInfo.icon || ''} ${drawInfo.name} — ${seance}</span>
          <div style="text-align:right">
            <div style="font-size:.8rem;opacity:.8">${g.tickets.length} fiche</div>
            <div style="font-weight:800">${total.toLocaleString()} G</div>
          </div>
        </div>
        <div style="display:block">${rows}</div>
      </div>`;
  }).join('');
}

// ── Rapports complets par tirage + période ───────────────────────
function loadReportByPeriod(period) {
  const end = new Date();
  let start = new Date();
  switch (period) {
    case 'today':     start.setHours(0,0,0,0); break;
    case 'yesterday': start.setDate(end.getDate()-1); start.setHours(0,0,0,0); end.setDate(end.getDate()-1); end.setHours(23,59,59,999); break;
    case 'week':      start.setDate(end.getDate()-7); break;
    case 'month':     start = new Date(end.getFullYear(), end.getMonth(), 1); break;
    default:          start.setHours(0,0,0,0);
  }
  renderReport(start, end, period);
}

function renderReport(start, end, period = 'custom') {
  // Récupérer le container du rapport
  // Le rapport s'affiche dans report-stats-screen (lotato.html)
  const screen = document.getElementById('report-stats-screen');
  if (!screen) return;

  const filtered  = savedTickets.filter(t => {
    const d = new Date(t.date); return d >= start && d <= end;
  });
  const totalSales  = filtered.reduce((s, t) => s + (t.total || 0), 0);
  const commission  = companyInfo.agentCommission || 10;
  const commEarned  = totalSales * (commission / 100);

  // Stats par tirage + séance
  const drawStats = {};
  filtered.forEach(t => {
    const key = `${t.draw}__${t.drawTime}`;
    if (!drawStats[key]) drawStats[key] = { draw: t.draw, drawTime: t.drawTime, count: 0, total: 0 };
    drawStats[key].count++;
    drawStats[key].total += t.total || 0;
  });

  // Période label
  const periodLabels = { today:'Jodi a', yesterday:'Ayè', week:'7 dènye jou', month:'Mwa sa a', custom:'Peryòd pèsonèl' };

  screen.innerHTML = `
    <div style="padding:16px;max-width:480px;margin:0 auto">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button onclick="showScreen('home')"
          style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#8e44ad">
          <i class="fas fa-arrow-left"></i>
        </button>
        <h2 style="font-size:1.2rem;font-weight:800;color:#2c3e50">
          <i class="fas fa-chart-bar" style="color:#8e44ad"></i> Rapò Vant
        </h2>
      </div>

      <!-- Filtres période -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
        ${[['today','Jodi a'],['yesterday','Ayè'],['week','Semèn'],['month','Mwa'],['custom','Pèsonèl']].map(([p, label]) => `
          <button onclick="handleReportFilter('${p}')"
            style="padding:7px 14px;border-radius:20px;border:2px solid #8e44ad;font-weight:700;font-size:.8rem;cursor:pointer;
              background:${period===p?'#8e44ad':'white'};color:${period===p?'white':'#8e44ad'};transition:.2s">
            ${label}
          </button>`).join('')}
      </div>

      <!-- Dates personnalisées -->
      <div id="custom-date-inputs" style="display:${period==='custom'?'flex':'none'};gap:8px;margin-bottom:16px;align-items:center">
        <input type="date" id="rp-start" value="${start.toISOString().split('T')[0]}"
          style="flex:1;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:.88rem">
        <span style="color:#94a3b8">→</span>
        <input type="date" id="rp-end" value="${end.toISOString().split('T')[0]}"
          style="flex:1;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:.88rem">
        <button onclick="applyCustomReport()"
          style="padding:8px 14px;background:#8e44ad;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer">
          OK
        </button>
      </div>

      <!-- Résumé global -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:linear-gradient(135deg,#8e44ad,#6c3483);color:white;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800">${filtered.length}</div>
          <div style="font-size:.8rem;opacity:.9">Total Fiche</div>
        </div>
        <div style="background:linear-gradient(135deg,#27ae60,#1e8449);color:white;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800">${totalSales.toLocaleString()}</div>
          <div style="font-size:.8rem;opacity:.9">Total Vant (G)</div>
        </div>
        <div style="background:linear-gradient(135deg,#f39c12,#d68910);color:white;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800">${commission}%</div>
          <div style="font-size:.8rem;opacity:.9">Komisyon</div>
        </div>
        <div style="background:linear-gradient(135deg,#3498db,#2980b9);color:white;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800">${commEarned.toLocaleString('fr-FR',{maximumFractionDigits:0})}</div>
          <div style="font-size:.8rem;opacity:.9">Komisyon Ou (G)</div>
        </div>
      </div>

      <!-- Détail par tirage -->
      <div style="background:white;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.07)">
        <div style="font-weight:800;font-size:.95rem;margin-bottom:14px;color:#2c3e50">
          <i class="fas fa-trophy" style="color:#8e44ad"></i> Detay pa Tiraj
        </div>
        ${Object.values(drawStats).length === 0
          ? '<p style="color:#94a3b8;text-align:center;padding:16px">Pa gen done pou peryòd sa</p>'
          : Object.values(drawStats)
              .sort((a, b) => b.total - a.total)
              .map(s => {
                const di     = draws[s.draw] || { name: s.draw, icon: '' };
                const seance = s.drawTime === 'morning' ? '☀️ Maten' : '🌙 Swè';
                const pct    = totalSales > 0 ? Math.round(s.total / totalSales * 100) : 0;
                return `
                  <div style="margin-bottom:12px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                      <span style="font-weight:700">${di.icon||''} ${di.name} <small style="color:#94a3b8">${seance}</small></span>
                      <span style="font-weight:800">${s.total.toLocaleString()} G</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="flex:1;background:#f1f5f9;border-radius:20px;height:8px;overflow:hidden">
                        <div style="width:${pct}%;background:linear-gradient(90deg,#8e44ad,#f39c12);height:100%;border-radius:20px"></div>
                      </div>
                      <span style="font-size:.78rem;color:#64748b;min-width:50px">${s.count} fiche (${pct}%)</span>
                    </div>
                  </div>`;
              }).join('')
        }
      </div>
    </div>`;
}

// Handlers rapport (appelés depuis le HTML généré)
window.handleReportFilter = function(period) {
  if (period === 'custom') {
    renderReport(new Date(), new Date(), 'custom');
    return;
  }
  loadReportByPeriod(period);
};

window.applyCustomReport = function() {
  const s = document.getElementById('rp-start')?.value;
  const e = document.getElementById('rp-end')?.value;
  if (s && e) renderReport(new Date(s), new Date(e + 'T23:59:59'), 'custom');
};

// ── Multi-Tirages : jouer le même pari sur plusieurs tirages ──────

let multiSelectedDraws = [];   // ['miami', 'georgia', ...]
let multiSelectedTime  = 'morning';
let multiSelectedGame  = 'borlette';

function initMultiDrawPanel() {
  renderMultiDrawOptions();
  renderMultiGameSelect();
  renderMultiNumberInputs();

  // Toggle ouvrir/fermer le panneau
  document.getElementById('multi-draw-toggle')?.addEventListener('click', () => {
    const content = document.getElementById('multi-draw-content');
    const icon    = document.querySelector('#multi-draw-toggle i');
    if (!content) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    if (icon) icon.className = isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
  });

  document.getElementById('add-to-multi-draw')?.addEventListener('click', addToMultiDraw);
  document.getElementById('view-current-multi-ticket')?.addEventListener('click', toggleMultiTicketSummary);
  document.getElementById('save-print-multi-ticket')?.addEventListener('click', savePrintMultiTicket);

  document.getElementById('open-multi-tickets')?.addEventListener('click', () => {
    document.getElementById('main-container').style.display = 'none';
    document.getElementById('multi-tickets-screen').style.display = 'block';
    renderMultiTicketsList();
  });
  document.getElementById('back-from-multi-tickets')?.addEventListener('click', () => {
    document.getElementById('multi-tickets-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
  });
}

// Cases à cocher : tirages disponibles + séance
function renderMultiDrawOptions() {
  const container = document.getElementById('multi-draw-options');
  if (!container) return;

  const timeBtns = `
    <div style="display:flex;gap:8px;margin-bottom:12px;grid-column:1/-1">
      <button type="button" class="multi-time-btn" data-time="morning"
        style="flex:1;padding:9px;border-radius:8px;border:2px solid #f39c12;font-weight:700;cursor:pointer;
          background:${multiSelectedTime==='morning'?'#f39c12':'white'};color:${multiSelectedTime==='morning'?'white':'#f39c12'}">
        ☀️ Maten
      </button>
      <button type="button" class="multi-time-btn" data-time="evening"
        style="flex:1;padding:9px;border-radius:8px;border:2px solid #8e44ad;font-weight:700;cursor:pointer;
          background:${multiSelectedTime==='evening'?'#8e44ad':'white'};color:${multiSelectedTime==='evening'?'white':'#8e44ad'}">
        🌙 Swè
      </button>
    </div>`;

  const drawCards = Object.entries(draws).map(([id, d]) => {
    const checked = multiSelectedDraws.includes(id);
    return `
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:2px solid ${checked ? d.color : '#e2e8f0'};
        border-radius:10px;cursor:pointer;background:${checked ? d.color + '15' : 'white'}">
        <input type="checkbox" class="multi-draw-check" value="${id}" ${checked ? 'checked' : ''}
          style="width:18px;height:18px;accent-color:${d.color}">
        <span style="font-weight:700;font-size:.88rem">${d.icon} ${d.name}</span>
      </label>`;
  }).join('');

  container.innerHTML = timeBtns + drawCards;

  // Listeners séance
  container.querySelectorAll('.multi-time-btn').forEach(btn =>
    btn.addEventListener('click', () => { multiSelectedTime = btn.dataset.time; renderMultiDrawOptions(); })
  );

  // Listeners tirages
  container.querySelectorAll('.multi-draw-check').forEach(chk =>
    chk.addEventListener('change', () => {
      if (chk.checked) { if (!multiSelectedDraws.includes(chk.value)) multiSelectedDraws.push(chk.value); }
      else { multiSelectedDraws = multiSelectedDraws.filter(d => d !== chk.value); }
      renderMultiDrawOptions();
    })
  );
}

// Sélecteur de jeu (borlette, lotto3, etc.)
function renderMultiGameSelect() {
  const container = document.getElementById('multi-game-select');
  if (!container) return;

  const games = [
    ['borlette', 'BORLETTE'], ['boulpe', 'BOUL PE'], ['lotto3', 'LOTTO 3'],
    ['marriage', 'MARYAJ'], ['grap', 'GRAP'], ['lotto4', 'LOTTO 4'], ['lotto5', 'LOTTO 5']
  ];

  container.innerHTML = `
    <label style="font-size:.85rem;font-weight:700;color:#475569;display:block;margin-bottom:6px">Chwazi jwèt</label>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${games.map(([id, name]) => `
        <button type="button" class="multi-game-btn" data-game="${id}"
          style="padding:7px 12px;border-radius:8px;border:2px solid #8e44ad;font-weight:700;font-size:.78rem;cursor:pointer;
            background:${multiSelectedGame===id?'#8e44ad':'white'};color:${multiSelectedGame===id?'white':'#8e44ad'}">
          ${name}
        </button>`).join('')}
    </div>`;

  container.querySelectorAll('.multi-game-btn').forEach(btn =>
    btn.addEventListener('click', () => { multiSelectedGame = btn.dataset.game; renderMultiGameSelect(); renderMultiNumberInputs(); })
  );
}

// Champs de saisie de numéro selon le jeu choisi
function renderMultiNumberInputs() {
  const container = document.getElementById('multi-number-inputs');
  if (!container) return;

  const INP = `style="font-size:1.2rem;font-weight:800;text-align:center;letter-spacing:2px;width:100%;padding:9px;border:2px solid #e2e8f0;border-radius:8px"`;

  switch (multiSelectedGame) {
    case 'borlette':
    case 'boulpe':
      container.innerHTML = `<label>Nimewo (2 chif)</label><input type="text" id="multi-number" maxlength="2" inputmode="numeric" placeholder="23" ${INP}>`;
      break;
    case 'lotto3':
      container.innerHTML = `<label>Nimewo (3 chif)</label><input type="text" id="multi-number" maxlength="3" inputmode="numeric" placeholder="456" ${INP}>`;
      break;
    case 'grap':
      container.innerHTML = `<label>Nimewo Grap (ex: 111)</label><input type="text" id="multi-number" maxlength="3" inputmode="numeric" placeholder="111" ${INP}>`;
      break;
    case 'marriage':
      container.innerHTML = `
        <label>Maryaj (2 boule)</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="multi-num1" maxlength="2" inputmode="numeric" placeholder="12" ${INP}>
          <input type="text" id="multi-num2" maxlength="2" inputmode="numeric" placeholder="34" ${INP}>
        </div>`;
      break;
    case 'lotto4':
    case 'lotto5': {
      const is5 = multiSelectedGame === 'lotto5';
      container.innerHTML = `
        <label>${is5 ? 'Lotto 5' : 'Lotto 4'}</label>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="text" id="multi-num1" maxlength="${is5 ? 3 : 2}" inputmode="numeric" placeholder="${is5 ? '456' : '23'}" ${INP}>
          <input type="text" id="multi-num2" maxlength="2" inputmode="numeric" placeholder="78" ${INP}>
        </div>
        <div class="options-container">
          <div class="option-checkbox"><input type="checkbox" id="multi-opt1"><label for="multi-opt1">Opsyon 1</label></div>
          <div class="option-checkbox"><input type="checkbox" id="multi-opt2"><label for="multi-opt2">Opsyon 2</label></div>
          <div class="option-checkbox"><input type="checkbox" id="multi-opt3"><label for="multi-opt3">Opsyon 3</label></div>
        </div>`;
      break;
    }
  }
}

// Ajouter le pari courant à tous les tirages sélectionnés
function addToMultiDraw() {
  if (multiSelectedDraws.length === 0) return showNotification('Chwazi omwen yon tiraj', 'warning');

  const bt = betTypes[multiSelectedGame];
  const amountInput = parseInt(document.getElementById('multi-draw-amount')?.value || '0');
  if (isNaN(amountInput) || amountInput <= 0) return showNotification('Antre yon kantite valab', 'warning');

  let number = '', options = null, perOptionAmount = amountInput;

  switch (multiSelectedGame) {
    case 'borlette':
    case 'boulpe': {
      number = document.getElementById('multi-number')?.value?.trim() || '';
      if (!/^\d{2}$/.test(number)) return showNotification('2 chif obligatwa', 'warning');
      if (multiSelectedGame === 'boulpe' && number[0] !== number[1]) return showNotification('Boul Pe: de chif idantik', 'warning');
      break;
    }
    case 'lotto3':
      number = document.getElementById('multi-number')?.value?.trim() || '';
      if (!/^\d{3}$/.test(number)) return showNotification('3 chif obligatwa', 'warning');
      break;
    case 'grap':
      number = document.getElementById('multi-number')?.value?.trim() || '';
      if (!/^\d{3}$/.test(number) || !(number[0]===number[1] && number[1]===number[2]))
        return showNotification('Grap: 3 chif idantik', 'warning');
      break;
    case 'marriage': {
      const n1 = document.getElementById('multi-num1')?.value?.trim() || '';
      const n2 = document.getElementById('multi-num2')?.value?.trim() || '';
      if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) return showNotification('2 boule de 2 chif obligatwa', 'warning');
      number = `${n1}*${n2}`;
      break;
    }
    case 'lotto4':
    case 'lotto5': {
      const is5 = multiSelectedGame === 'lotto5';
      const n1  = document.getElementById('multi-num1')?.value?.trim() || '';
      const n2  = document.getElementById('multi-num2')?.value?.trim() || '';
      const o1  = document.getElementById('multi-opt1')?.checked || false;
      const o2  = document.getElementById('multi-opt2')?.checked || false;
      const o3  = document.getElementById('multi-opt3')?.checked || false;
      const cnt = [o1,o2,o3].filter(Boolean).length;
      if (is5 ? !/^\d{3}$/.test(n1) : !/^\d{2}$/.test(n1)) return showNotification('1e boule envalid', 'warning');
      if (!/^\d{2}$/.test(n2)) return showNotification('2e boule envalid', 'warning');
      if (cnt === 0) return showNotification('Chwazi omwen yon opsyon', 'warning');
      number  = n1 + n2;
      options = { option1: o1, option2: o2, option3: o3 };
      perOptionAmount = amountInput;
      break;
    }
  }

  // Ajouter le pari pour chaque tirage sélectionné
  multiSelectedDraws.forEach(drawId => {
    const totalAmt = options ? amountInput * Object.values(options).filter(Boolean).length : amountInput;
    multiDrawBets.push({
      id: Date.now() + Math.random(),
      draw: drawId,
      drawTime: multiSelectedTime,
      type: multiSelectedGame,
      name: bt.name,
      number,
      amount: totalAmt,
      multiplier: bt.multiplier,
      options,
      perOptionAmount
    });
  });

  showNotification(`${bt.name} ${number} ajoute nan ${multiSelectedDraws.length} tiraj!`, 'success');
  updateMultiTicketSummary();

  // Reset le formulaire de numéro
  document.querySelectorAll('#multi-number-inputs input').forEach(i => { i.value = ''; if (i.type === 'checkbox') i.checked = false; });
}

function toggleMultiTicketSummary() {
  const info = document.getElementById('current-multi-ticket-info');
  if (!info) return;
  const isHidden = info.style.display === 'none';
  info.style.display = isHidden ? 'block' : 'none';
  if (isHidden) updateMultiTicketSummary();
}

function updateMultiTicketSummary() {
  const summary = document.getElementById('multi-ticket-summary');
  const info     = document.getElementById('current-multi-ticket-info');
  if (!summary) return;

  if (multiDrawBets.length === 0) {
    summary.innerHTML = '<p style="color:#94a3b8;text-align:center">Pa gen parye nan fiche multi-tirages la</p>';
    return;
  }

  if (info) info.style.display = 'block';

  // Grouper par tirage
  const byDraw = {};
  multiDrawBets.forEach(b => {
    const key = `${b.draw}__${b.drawTime}`;
    if (!byDraw[key]) byDraw[key] = { draw: b.draw, drawTime: b.drawTime, bets: [] };
    byDraw[key].bets.push(b);
  });

  const total = multiDrawBets.reduce((s, b) => s + b.amount, 0);

  summary.innerHTML = Object.values(byDraw).map(g => {
    const di = draws[g.draw] || { name: g.draw, icon: '' };
    const seance = g.drawTime === 'morning' ? '☀️ Maten' : '🌙 Swè';
    const sub = g.bets.reduce((s,b)=>s+b.amount,0);
    return `
      <div style="margin-bottom:10px;padding:8px;background:white;border-radius:8px;border-left:3px solid #8e44ad">
        <div style="font-weight:700;font-size:.85rem">${di.icon} ${di.name} <small style="color:#94a3b8">${seance}</small></div>
        ${g.bets.map(b => `
          <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:3px 0">
            <span>${b.name} ${b.number}</span>
            <span>${b.amount} G <span class="remove-multi-bet" data-id="${b.id}" style="color:#e74c3c;cursor:pointer;margin-left:6px"><i class="fas fa-times"></i></span></span>
          </div>`).join('')}
        <div style="text-align:right;font-weight:700;font-size:.8rem;color:#8e44ad;margin-top:4px">Sou-total: ${sub} G</div>
      </div>`;
  }).join('') + `<div style="text-align:right;font-weight:800;font-size:1rem;margin-top:8px">TOTAL: ${total} G</div>`;

  summary.querySelectorAll('.remove-multi-bet').forEach(btn =>
    btn.addEventListener('click', () => {
      multiDrawBets = multiDrawBets.filter(b => b.id != btn.dataset.id);
      updateMultiTicketSummary();
    })
  );
}

// Sauvegarder + imprimer la fiche multi-tirages (un ticket serveur par tirage)
async function savePrintMultiTicket() {
  if (multiDrawBets.length === 0) return showNotification('Pa gen parye nan fiche a', 'warning');

  // Grouper par tirage+séance pour créer un ticket serveur distinct par tirage
  const byDraw = {};
  multiDrawBets.forEach(b => {
    const key = `${b.draw}__${b.drawTime}`;
    if (!byDraw[key]) byDraw[key] = { draw: b.draw, drawTime: b.drawTime, bets: [] };
    byDraw[key].bets.push(b);
  });

  const createdTickets = [];
  for (const group of Object.values(byDraw)) {
    const total = group.bets.reduce((s, b) => s + b.amount, 0);
    const ticket = {
      number: ticketCounter,
      date: new Date().toISOString(),
      draw: group.draw,
      drawTime: group.drawTime,
      bets: group.bets,
      total,
      agentName: currentUser?.full_name || 'Agent',
      isMultiDraw: true
    };
    try {
      const res = await apiCall('/api/tickets', 'POST', {
        draw: group.draw,
        drawTime: group.drawTime,
        bets: group.bets.map(b => ({ type: b.type, number: b.number, amount: b.amount, multiplier: b.multiplier, options: b.options || null })),
        total
      });
      if (res?.ticketNumber) ticket.serverNumber = res.ticketNumber;
    } catch { /* hors-ligne */ }

    savedTickets.push(ticket);
    createdTickets.push(ticket);
    ticketCounter++;
  }

  showNotification(`${createdTickets.length} fiche kreye pou ${Object.keys(byDraw).length} tiraj!`, 'success');

  // Imprimer toutes les fiches d'un coup
  createdTickets.forEach(t => {
    const w = window.open('', '_blank');
    if (w) { w.document.write(buildTicketHTML(t)); w.document.close(); w.print(); }
  });

  multiDrawBets = [];
  multiSelectedDraws = [];
  updateMultiTicketSummary();
  renderMultiDrawOptions();
  document.getElementById('current-multi-ticket-info').style.display = 'none';
}

// Liste des fiches multi-tirages déjà sauvegardées (écran dédié)
function renderMultiTicketsList() {
  const container = document.getElementById('multi-tickets-list');
  if (!container) return;

  const multiTickets = savedTickets.filter(t => t.isMultiDraw);
  if (!multiTickets.length) {
    container.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:24px">Pa gen fiche multi-tirages</p>';
    return;
  }

  const sorted = [...multiTickets].sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = sorted.map(t => {
    const di = draws[t.draw] || { name: t.draw, icon: '' };
    return `
      <div class="history-item" style="margin-bottom:10px">
        <div class="history-header">
          <span class="history-draw">#${t.serverNumber || t.number} — ${di.icon} ${di.name} (${t.drawTime === 'morning' ? 'Maten' : 'Swè'})</span>
          <span class="history-date">${new Date(t.date).toLocaleString('fr-FR')}</span>
        </div>
        <div>Total: <strong>${t.total} G</strong></div>
      </div>`;
  }).join('');
}

// ── Notification ──────────────────────────────────────────────────
function showNotification(msg, type = 'info') {
  const old = document.querySelector('.notification');
  if (old) old.remove();
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  const icons = { success:'check-circle', warning:'exclamation-triangle', error:'times-circle', info:'info-circle' };
  n.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i> ${msg}`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 4000);
}

// ── Commandes vocales (stub) ──────────────────────────────────────
function initVoiceCommands() { /* Implémenté si besoin */ }
function startListening()    { showNotification('Kòmand vwa pa disponib', 'info'); }

// ── Init principale ───────────────────────────────────────────────
async function initApp() {
  updateCurrentTime();
  updateCompanyDisplay();
  await loadSettingsFromAPI();
  await loadResults();
  await loadTicketHistory();
  updateBetsList();
  initMultiDrawPanel();
}

document.addEventListener('DOMContentLoaded', async () => {
  // Boutons de login
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  const loginPwd = document.getElementById('admin-password') || document.getElementById('login-password');
  if (loginPwd) loginPwd.addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });
  const loginUser = document.getElementById('admin-username') || document.getElementById('login-username');
  if (loginUser) loginUser.addEventListener('keypress', e => { if (e.key === 'Enter') loginPwd?.focus(); });

  // Vérifier l'auth (async)
  const authed = await checkAuth();
  if (!authed) return;

  // Afficher l'app + bottom-nav (caché par défaut dans lotato.html)
  hideLoginScreen();
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) bottomNav.style.display = 'flex';
  await initApp();

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Navigation bas — supporte data-screen="report-stats" (lotato.html) ET "report"
  document.querySelectorAll('.nav-item[data-screen]').forEach(item =>
    item.addEventListener('click', () => {
      const screen = item.dataset.screen === 'report-stats' ? 'report' : item.dataset.screen;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      showScreen(screen);
    })
  );

  // Back buttons — supporte data-screen (lotato.html) ET data-target
  document.querySelectorAll('.back-button[data-screen], .back-button[data-target]').forEach(btn =>
    btn.addEventListener('click', () => showScreen(btn.dataset.screen || btn.dataset.target || 'home'))
  );
  document.getElementById('back-button')?.addEventListener('click', closeBettingScreen);

  // Draw cards
  document.querySelectorAll('.draw-card[data-draw]').forEach(card =>
    card.addEventListener('click', () => openBettingScreen(card.dataset.draw, 'morning'))
  );
  document.querySelectorAll('.draw-btn[data-time]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openBettingScreen(btn.closest('.draw-card').dataset.draw, btn.dataset.time);
    })
  );

  // Boutons impression/partage — supporte les deux IDs (lotato.html = save-print-ticket)
  document.getElementById('save-print-ticket')?.addEventListener('click', printTicket);
  document.getElementById('print-ticket-btn')?.addEventListener('click', printTicket);
  document.getElementById('share-ticket-btn')?.addEventListener('click', shareTicketAfterSave);
  document.getElementById('print-ticket-only')?.addEventListener('click', printTicket);
  document.getElementById('save-ticket-only')?.addEventListener('click', async () => { await saveTicket(); showNotification('Fiche sove!', 'success'); });

  // Vérification gagnants
  document.getElementById('check-winners-btn')?.addEventListener('click', checkWinningTickets);
  document.getElementById('open-results-check')?.addEventListener('click', () => showScreen('results'));

  // Rapport
  document.querySelectorAll('.filter-btn[data-period]').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadReportByPeriod(btn.dataset.period);
    })
  );
  document.getElementById('apply-custom')?.addEventListener('click', () => {
    const s = document.getElementById('start-date')?.value;
    const e = document.getElementById('end-date')?.value;
    if (s && e) renderReport(new Date(s), new Date(e));
  });

  // Modal d'envoi
  initSendModal();

  // Horloge + polling résultats
  setInterval(updateCurrentTime, 60000);
  setInterval(checkForNewResults, 300000);

  // Commande vocale
  document.getElementById('voice-command-btn')?.addEventListener('click', startListening);

  console.log('✅ Lotato Agent v6.0 prêt');
});
