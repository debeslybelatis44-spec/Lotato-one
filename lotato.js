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
  if (!token) { showLoginScreen(); return false; }
  try {
    const data = await apiCall('/api/auth/check');
    if (!data.success || data.user.role !== 'agent') {
      localStorage.removeItem('lotato_token');
      showLoginScreen();
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
    showLoginScreen();
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
  apiCall('/api/auth/logout', 'POST').catch(() => {});
  localStorage.removeItem('lotato_token');
  localStorage.removeItem('lotato_user');
  currentUser = null;
  activeBets  = [];
  showLoginScreen();
}

function showLoginScreen() {
  const ls = document.getElementById('login-screen');
  const ma = document.getElementById('main-app');
  if (ls) ls.style.display = 'flex';
  if (ma) ma.style.display = 'none';
}

function hideLoginScreen() {
  const ls = document.getElementById('login-screen');
  const ma = document.getElementById('main-app');
  if (ls) ls.style.display = 'none';
  if (ma) ma.style.display = 'block';
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
      // déjà affiché
      break;
    case 'history':
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('history-screen').style.display = 'block';
      updateHistoryScreen();
      break;
    case 'winning-tickets':
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('winning-tickets-screen').style.display = 'block';
      checkWinningTickets();
      break;
    case 'report':
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('report-screen').style.display = 'block';
      loadReportByPeriod('today');
      break;
    case 'results':
      if (mainContainer) mainContainer.style.display = 'none';
      document.getElementById('results-check-screen').style.display = 'block';
      updateResultsDisplay();
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
  const timeEl  = document.getElementById('betting-time');
  if (titleEl) titleEl.textContent = draw.name;
  if (timeEl)  timeEl.textContent  = time === 'morning' ? 'Maten' : 'Swè';

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

  let html = '';
  switch (gameType) {
    case 'borlette':
    case 'boulpe':
      html = `<h3>${betTypes[gameType].name}</h3>
        <div class="form-group"><label>Nimewo (2 chif)</label><input type="text" id="bet-number" maxlength="2" inputmode="numeric" placeholder="ex: 23"></div>
        <div class="form-group"><label>Kantite (HTG)</label><input type="number" id="bet-amount" min="1" placeholder="ex: 100"></div>`;
      break;
    case 'lotto3':
      html = `<h3>LOTTO 3</h3>
        <div class="form-group"><label>Nimewo (3 chif)</label><input type="text" id="bet-number" maxlength="3" inputmode="numeric" placeholder="ex: 456"></div>
        <div class="form-group"><label>Kantite (HTG)</label><input type="number" id="bet-amount" min="1" placeholder="ex: 50"></div>`;
      break;
    case 'marriage':
      html = `<h3>MARYAJ</h3>
        <div class="number-inputs">
          <input type="text" id="bet-num1" maxlength="2" inputmode="numeric" placeholder="1e boule (ex:12)" style="flex:1">
          <input type="text" id="bet-num2" maxlength="2" inputmode="numeric" placeholder="2e boule (ex:34)" style="flex:1">
        </div>
        <div class="form-group"><label>Kantite (HTG)</label><input type="number" id="bet-amount" min="1"></div>`;
      break;
    case 'grap':
      html = `<h3>GRAP (3 chif idantik)</h3>
        <div class="form-group"><label>Nimewo Grap (ex: 111, 222)</label><input type="text" id="bet-number" maxlength="3" inputmode="numeric"></div>
        <div class="form-group"><label>Kantite (HTG)</label><input type="number" id="bet-amount" min="1"></div>`;
      break;
    case 'lotto4':
    case 'lotto5': {
      const is5 = gameType === 'lotto5';
      html = `<h3>${is5 ? 'LOTTO 5' : 'LOTTO 4'}</h3>
        <div class="number-inputs">
          <input type="text" id="bet-num1" maxlength="${is5 ? 3 : 2}" inputmode="numeric" placeholder="${is5 ? '3 chif' : '2 chif'}" style="flex:1">
          <input type="text" id="bet-num2" maxlength="2" inputmode="numeric" placeholder="2 chif" style="flex:1">
        </div>
        <div class="options-container">
          <div class="option-checkbox"><input type="checkbox" id="opt1"><label for="opt1">Opsyon 1 <span class="option-multiplier">×${betTypes[gameType].multiplier}</span></label></div>
          <div class="option-checkbox"><input type="checkbox" id="opt2"><label for="opt2">Opsyon 2 <span class="option-multiplier">×${betTypes[gameType].multiplier}</span></label></div>
          <div class="option-checkbox"><input type="checkbox" id="opt3"><label for="opt3">Opsyon 3 (Anagram) <span class="option-multiplier">×${betTypes[gameType].multiplier}</span></label></div>
        </div>
        <div class="form-group"><label>Kantite pa opsyon (HTG)</label><input type="number" id="bet-amount" min="1"></div>`;
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
  currentTicketToShare = ticket;
  const modal = document.getElementById('send-ticket-modal');
  if (modal) modal.style.display = 'flex';
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

// ── Modal d'envoi ─────────────────────────────────────────────────
function initSendModal() {
  const modal     = document.getElementById('send-ticket-modal');
  const closeBtn  = document.getElementById('close-send-modal');
  const confirmBtn= document.getElementById('confirm-send-btn');
  if (!modal) return;

  document.querySelectorAll('.send-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.dataset.method;
      const phoneDiv = document.getElementById('phone-input-container');
      if (method === 'whatsapp' || method === 'sms') {
        if (phoneDiv) phoneDiv.style.display = 'block';
        if (confirmBtn) {
          confirmBtn.onclick = () => {
            const phone = document.getElementById('send-phone-number')?.value?.trim();
            if (!phone) { showNotification('Antre nimewo', 'warning'); return; }
            const text  = formatTicketText(currentTicketToShare);
            const url   = method === 'whatsapp'
              ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`
              : `sms:${phone}?body=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
            modal.style.display = 'none';
            showNotification('Ticket voye!', 'success');
          };
        }
      }
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
}

// ── Vérification des gagnants ─────────────────────────────────────
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
    container.innerHTML = '<p style="text-align:center;color:#94a3b8">Pa gen fiche gagnant</p>';
    if (summary) summary.innerHTML = '';
    return;
  }

  const totalGains = winningTickets.reduce((s, t) => s + t.totalWinnings, 0);
  if (summary) summary.innerHTML = `
    <div class="stat-card"><div class="stat-value">${winningTickets.length}</div><div class="stat-label">Fiche Gagnant</div></div>
    <div class="stat-card"><div class="stat-value">${totalGains.toLocaleString()} G</div><div class="stat-label">Total Gains</div></div>`;

  container.innerHTML = winningTickets.map(t => `
    <div class="winning-ticket">
      <strong>Fiche #${t.serverNumber || t.number}</strong> — ${draws[t.draw]?.name || t.draw} (${t.drawTime === 'morning' ? 'Maten' : 'Swè'})<br>
      Rezilta: ${t.result.lot1}${t.result.lot2 ? ' | ' + t.result.lot2 : ''}${t.result.lot3 ? ' | ' + t.result.lot3 : ''}<br>
      ${t.winningBets.map(b => `${b.name} ${b.number} → ${b.winType}: <strong>${b.winAmount.toLocaleString()} G</strong>`).join('<br>')}
      <div style="margin-top:8px;font-weight:bold;color:#27ae60">Total: ${t.totalWinnings.toLocaleString()} G</div>
    </div>`).join('');
}

// ── Historique ────────────────────────────────────────────────────
function updateHistoryScreen() {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (!savedTickets.length) { list.innerHTML = '<p style="color:#94a3b8;text-align:center">Pa gen fiche ki sove</p>'; return; }
  const sorted = [...savedTickets].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = sorted.map(t => `
    <div class="history-item">
      <div class="history-header">
        <span class="history-draw">#${t.serverNumber || String(t.number).padStart(4,'0')} — ${draws[t.draw]?.name || t.draw} (${t.drawTime === 'morning' ? 'Maten' : 'Swè'})</span>
        <span class="history-date">${new Date(t.date).toLocaleString('fr-FR')}</span>
      </div>
      <div>Total: <strong>${t.total} G</strong></div>
    </div>`).join('');
}

// ── Rapports ──────────────────────────────────────────────────────
function loadReportByPeriod(period) {
  const end   = new Date();
  let start   = new Date();
  switch (period) {
    case 'today':     start.setHours(0,0,0,0); break;
    case 'yesterday': start.setDate(end.getDate()-1); start.setHours(0,0,0,0); end.setDate(end.getDate()-1); end.setHours(23,59,59,999); break;
    case '7days':     start.setDate(end.getDate()-7); break;
    case '15days':    start.setDate(end.getDate()-15); break;
    case 'month':     start = new Date(end.getFullYear(), end.getMonth(), 1); break;
    default:          start.setDate(end.getDate()-15);
  }
  const sdEl = document.getElementById('start-date');
  const edEl = document.getElementById('end-date');
  if (sdEl) sdEl.value = start.toISOString().split('T')[0];
  if (edEl) edEl.value = end.toISOString().split('T')[0];
  renderReport(start, end);
}

function renderReport(start, end) {
  const filtered     = savedTickets.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
  const totalSales   = filtered.reduce((s, t) => s + t.total, 0);
  const commission   = companyInfo.agentCommission || 10;
  const commEarned   = totalSales * (commission / 100);
  const drawStats    = {};
  filtered.forEach(t => { drawStats[t.draw] = (drawStats[t.draw] || 0) + t.total; });

  const totalSalesEl  = document.getElementById('total-sales');
  const commRateEl    = document.getElementById('commission-rate');
  const commEarnedEl  = document.getElementById('commission-earned');
  const detailEl      = document.getElementById('report-detail-list');

  if (totalSalesEl) totalSalesEl.textContent = totalSales.toLocaleString() + ' G';
  if (commRateEl)   commRateEl.textContent   = commission + '%';
  if (commEarnedEl) commEarnedEl.textContent = commEarned.toFixed(2) + ' G';
  if (detailEl) {
    detailEl.innerHTML = Object.entries(drawStats).map(([d, amt]) =>
      `<div class="report-detail-item"><span>${draws[d]?.name || d}</span><span>${amt.toLocaleString()} G</span></div>`
    ).join('') || '<p>Pa gen done pou peryòd sa</p>';
  }
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

  // Afficher l'app
  hideLoginScreen();
  await initApp();

  // Infos utilisateur dans l'header
  const userNameEl = document.getElementById('user-name');
  if (userNameEl && currentUser) userNameEl.textContent = currentUser.full_name || currentUser.username;

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Navigation bas
  document.querySelectorAll('.nav-item[data-screen]').forEach(item =>
    item.addEventListener('click', () => showScreen(item.dataset.screen))
  );

  // Back buttons
  document.querySelectorAll('.back-button[data-target]').forEach(btn =>
    btn.addEventListener('click', () => showScreen(btn.dataset.target))
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

  // Boutons d'action ticket
  document.getElementById('print-ticket-btn')?.addEventListener('click', printTicket);
  document.getElementById('share-ticket-btn')?.addEventListener('click', shareTicketAfterSave);

  // Panier
  document.getElementById('cart-icon-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;
    const list  = document.getElementById('cart-bets-list');
    const total = document.getElementById('cart-total-amount');
    let t = 0;
    list.innerHTML = activeBets.map((b, i) => {
      t += b.amount;
      return `<div class="bet-item"><div><strong>${b.name}</strong> ${b.number}</div><div>${b.amount} G <span class="bet-remove" data-idx="${i}"><i class="fas fa-times"></i></span></div></div>`;
    }).join('') || '<p>Panier vide</p>';
    if (total) total.textContent = t;
    list.querySelectorAll('.bet-remove').forEach(btn =>
      btn.addEventListener('click', () => { activeBets.splice(parseInt(btn.dataset.idx), 1); updateBetsList(); modal.style.display = 'none'; })
    );
    modal.style.display = 'flex';
  });
  document.getElementById('close-cart-modal')?.addEventListener('click', () => { const m = document.getElementById('cart-modal'); if (m) m.style.display = 'none'; });
  document.getElementById('cart-print-btn')?.addEventListener('click', () => { const m = document.getElementById('cart-modal'); if (m) m.style.display = 'none'; printTicket(); });
  document.getElementById('cart-share-btn')?.addEventListener('click', () => { const m = document.getElementById('cart-modal'); if (m) m.style.display = 'none'; shareTicketAfterSave(); });

  // Vérification gagnants
  document.getElementById('check-winners-btn')?.addEventListener('click', checkWinningTickets);
  document.getElementById('open-results-check')?.addEventListener('click', () => showScreen('winning-tickets'));

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
