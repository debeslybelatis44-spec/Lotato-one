// ==========================================
// LOTATO - Interface Agent (Version Complète)
// ==========================================

const API_BASE_URL = '';
let authToken = localStorage.getItem('lotato_token');
let currentUser = null;

let betTypes = {
    lotto3: { name: "LOTO 3", multiplier: 500, icon: "fas fa-list-ol", description: "3 chif (lot 1 + 1 chif devan)", category: "lotto" },
    grap: { name: "GRAP", multiplier: 500, icon: "fas fa-chart-line", description: "Grap boule paire (111, 222, ..., 000)", category: "special" },
    marriage: { name: "MARYAJ", multiplier: 1000, icon: "fas fa-link", description: "Maryaj 2 chif (ex: 12*34)", category: "special" },
    borlette: { name: "BORLETTE", multiplier: 60, multiplier2: 20, multiplier3: 10, icon: "fas fa-dice", description: "2 chif (1er lot ×60, 2e ×20, 3e ×10)", category: "borlette" },
    boulpe: { name: "BOUL PE", multiplier: 60, multiplier2: 20, multiplier3: 10, icon: "fas fa-circle", description: "Boul pe (00-99)", category: "borlette" },
    lotto4: { name: "LOTO 4", multiplier: 5000, icon: "fas fa-list-ol", description: "4 chif (lot 1+2 accumulate) - 3 opsyon", category: "lotto" },
    lotto5: { name: "LOTO 5", multiplier: 25000, icon: "fas fa-list-ol", description: "5 chif (lot 1+2+3 accumulate) - 3 opsyon", category: "lotto" },
    'auto-marriage': { name: "MARYAJ OTOMATIK", multiplier: 1000, icon: "fas fa-robot", description: "Marie boules otomatik", category: "special" },
    'auto-lotto4': { name: "LOTO 4 OTOMATIK", multiplier: 5000, icon: "fas fa-robot", description: "Lotto 4 otomatik", category: "special" }
};

const draws = {
    miami: { name: "Miami (Florida)", times: { morning: "1:30 PM", evening: "9:50 PM" } },
    georgia: { name: "Georgia", times: { morning: "12:30 PM", evening: "7:00 PM" } },
    newyork: { name: "New York", times: { morning: "2:30 PM", evening: "8:00 PM" } },
    texas: { name: "Texas", times: { morning: "12:00 PM", evening: "6:00 PM" } },
    tunisia: { name: "Tunisie", times: { morning: "10:30 AM", evening: "2:00 PM" } }
};

let currentDraw = null;
let currentDrawTime = null;
let activeBets = [];
let savedTickets = [];
let winningTickets = [];
let multiDrawTickets = [];
let resultsDatabase = {};
let companyInfo = { name: "Lotato", phone: "+509 32 53 49 58", address: "Cap Haïtien", slogan: "Chwazi yon Jwet", logo: "", agentCommission: 10 };
let selectedMultiDraws = new Set();
let selectedMultiGame = 'borlette';
let selectedBalls = [];
let currentMultiDrawTicket = { id: Date.now().toString(), bets: [], totalAmount: 0, draws: new Set(), createdAt: new Date().toISOString() };

// ========== API ==========
async function apiCall(url, method = 'GET', body = null) {
    const token = localStorage.getItem('lotato_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(url, options);
        if (response.status === 401) { logout(); return null; }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Erreur de connexion', 'error');
        return null;
    }
}

function logout() {
    localStorage.removeItem('lotato_token');
    localStorage.removeItem('lotato_user');
    window.location.href = '/index.html';
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container') || document.body;
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i><span>${message}</span>`;
    container.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
}

function updateCurrentTime() {
    const now = new Date();
    const str = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) + ' - ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = str;
}

// ========== Chargement ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM chargé');
    const token = localStorage.getItem('lotato_token');
    if (!token) { window.location.href = '/index.html'; return; }
    const check = await apiCall('/api/auth/check');
    if (!check?.success) { logout(); return; }
    currentUser = check.user;

    await loadSettings();
    await loadResults();
    await loadMyTickets();
    await loadMultiDrawTickets();
    await loadWinningTickets();
    await loadLotteryConfig();

    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
    initMultiDrawPanel();
    setupEventListeners();
    initCategoryTabs();

    document.getElementById('main-container').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    console.log('Initialisation terminée');
});

async function loadLotteryConfig() {
    const res = await apiCall('/api/lottery/config');
    if (res?.success && res.config) {
        if (res.config.logo) companyInfo.logo = res.config.logo;
        if (res.config.slogan) companyInfo.slogan = res.config.slogan;
        if (res.config.name) companyInfo.name = res.config.name;
        if (res.config.address) companyInfo.address = res.config.address;
        updateCompanyDisplay();
    }
}

function updateCompanyDisplay() {
    const nameEl = document.getElementById('company-name');
    const sloganEl = document.getElementById('company-slogan');
    const logoEl = document.getElementById('company-logo');
    if (nameEl) nameEl.textContent = companyInfo.name;
    if (sloganEl) sloganEl.textContent = companyInfo.slogan;
    if (logoEl && companyInfo.logo) logoEl.src = companyInfo.logo;
}

async function loadSettings() {
    const res = await apiCall('/api/settings');
    if (res?.success) {
        const s = res.settings;
        if (s.borlette_first) betTypes.borlette.multiplier = parseInt(s.borlette_first);
        if (s.borlette_second) betTypes.borlette.multiplier2 = parseInt(s.borlette_second);
        if (s.borlette_third) betTypes.borlette.multiplier3 = parseInt(s.borlette_third);
        if (s.lotto3) betTypes.lotto3.multiplier = parseInt(s.lotto3);
        if (s.lotto4) betTypes.lotto4.multiplier = parseInt(s.lotto4);
        if (s.lotto5) betTypes.lotto5.multiplier = parseInt(s.lotto5);
        if (s.grap) betTypes.grap.multiplier = parseInt(s.grap);
        if (s.marriage) betTypes.marriage.multiplier = parseInt(s.marriage);
        if (s.company_name) companyInfo.name = s.company_name;
        if (s.company_phone) companyInfo.phone = s.company_phone;
        if (s.company_address) companyInfo.address = s.company_address;
        if (s.company_slogan) companyInfo.slogan = s.company_slogan;
        if (s.company_logo) companyInfo.logo = s.company_logo;
        if (s.agent_commission) companyInfo.agentCommission = parseFloat(s.agent_commission);
        updateCompanyDisplay();
    }
}

async function loadResults() {
    const res = await apiCall('/api/results');
    if (res?.success) resultsDatabase = res.results;
}

async function loadMyTickets() {
    const res = await apiCall('/api/tickets');
    if (res?.success) savedTickets = res.tickets;
}

async function loadMultiDrawTickets() {
    const res = await apiCall('/api/tickets/multi-draw');
    if (res?.success) multiDrawTickets = res.tickets;
}

async function loadWinningTickets() {
    const res = await apiCall('/api/tickets/winning');
    if (res?.success) winningTickets = res.tickets;
}

// ========== Événements ==========
function setupEventListeners() {
    console.log('Attachement des écouteurs');
    document.querySelectorAll('.draw-card').forEach(card => {
        card.addEventListener('click', () => openBettingScreen(card.dataset.draw, 'morning'));
    });
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const card = btn.closest('.draw-card');
            const drawId = card.dataset.draw;
            const time = btn.dataset.time;
            card.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            openBettingScreen(drawId, time);
        });
    });

    const backBtn = document.getElementById('back-button');
    if (backBtn) backBtn.addEventListener('click', closeBettingScreen);
    const savePrint = document.getElementById('save-print-ticket');
    if (savePrint) savePrint.addEventListener('click', () => { if (activeBets.length) saveAndPrintTicket(); else showNotification("Pa gen parye", "warning"); });
    const openResults = document.getElementById('open-results-check');
    if (openResults) openResults.addEventListener('click', openResultsCheckScreen);
    const checkWinners = document.getElementById('check-winners-btn');
    if (checkWinners) checkWinners.addEventListener('click', checkWinningTickets);
    const backResults = document.getElementById('back-from-results');
    if (backResults) backResults.addEventListener('click', () => { document.getElementById('results-check-screen').style.display = 'none'; document.querySelector('.container').style.display = 'block'; });
    const multiToggle = document.getElementById('multi-draw-toggle');
    if (multiToggle) multiToggle.addEventListener('click', toggleMultiDrawPanel);
    const addMulti = document.getElementById('add-to-multi-draw');
    if (addMulti) addMulti.addEventListener('click', addToMultiDrawTicket);
    const viewMulti = document.getElementById('view-current-multi-ticket');
    if (viewMulti) viewMulti.addEventListener('click', viewCurrentMultiDrawTicket);
    const saveMulti = document.getElementById('save-print-multi-ticket');
    if (saveMulti) saveMulti.addEventListener('click', saveAndPrintMultiDrawTicket);
    const openMultiTickets = document.getElementById('open-multi-tickets');
    if (openMultiTickets) openMultiTickets.addEventListener('click', openMultiTicketsScreen);
    const backMulti = document.getElementById('back-from-multi-tickets');
    if (backMulti) backMulti.addEventListener('click', () => { document.getElementById('multi-tickets-screen').style.display = 'none'; document.querySelector('.container').style.display = 'block'; });
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    const showResultsBtn = document.getElementById('show-results-btn');
    if (showResultsBtn) showResultsBtn.addEventListener('click', openResultsCheckScreen);

    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => showScreen(item.dataset.screen)));
    document.querySelectorAll('.back-button[data-screen]').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));

    const searchWinning = document.getElementById('search-winning-btn');
    if (searchWinning) searchWinning.addEventListener('click', searchWinningTickets);
    const searchHistoryBtn = document.getElementById('search-history-btn');
    if (searchHistoryBtn) searchHistoryBtn.addEventListener('click', searchHistory);
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const period = btn.dataset.period;
            if (period) loadReportByPeriod(period);
        });
    });
    const applyCustom = document.getElementById('apply-custom');
    if (applyCustom) applyCustom.addEventListener('click', () => {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        if (start && end) loadReportCustom(start, end);
        else showNotification("Chwazi de dat", "warning");
    });
}

function initCategoryTabs() {
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const category = tab.dataset.category;
            document.getElementById('borlette-category').style.display = category === 'borlette' ? 'block' : 'none';
            document.getElementById('lotto-category').style.display = category === 'lotto' ? 'block' : 'none';
            document.getElementById('special-category').style.display = category === 'special' ? 'block' : 'none';
        });
    });
}

function showScreen(screenId) {
    console.log('showScreen:', screenId);
    document.querySelectorAll('.screen, .betting-screen, .container, .report-screen, .results-check-screen, .multi-tickets-screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (screenId === 'home') {
        document.querySelector('.container').style.display = 'block';
    } else {
        const screen = document.getElementById(screenId + '-screen');
        if (screen) {
            screen.style.display = 'block';
            if (screenId === 'report') updateReportScreen();
            else if (screenId === 'history') updateHistoryScreen();
            else if (screenId === 'winning-tickets') updateWinningTicketsScreen();
        }
    }
}

// ========== Écran de pari ==========
function openBettingScreen(drawId, time) {
    currentDraw = drawId;
    currentDrawTime = time;
    const draw = draws[drawId];
    document.getElementById('betting-title').textContent = `${draw.name} (${time === 'morning' ? 'Maten' : 'Swè'})`;
    document.querySelector('.container').style.display = 'none';
    document.getElementById('betting-screen').style.display = 'block';
    document.getElementById('games-interface').style.display = 'block';
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('active-bets').style.display = 'block';
    setupGameSelection();
    updateBetsList();
}

function closeBettingScreen() {
    document.getElementById('betting-screen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
}

function setupGameSelection() {
    document.querySelectorAll('.game-item').forEach(item => {
        item.replaceWith(item.cloneNode(true));
    });
    document.querySelectorAll('.game-item').forEach(item => {
        item.addEventListener('click', function() {
            const gameType = this.dataset.game;
            if (gameType === 'auto-marriage' || gameType === 'auto-lotto4') showAutoGameForm(gameType);
            else showBetForm(gameType);
        });
    });
}

function showBetForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    const formDiv = document.getElementById('bet-form');
    formDiv.style.display = 'block';
    let html = `<h3>${bet.name} - ${bet.description}</h3>`;

    if (gameType === 'borlette' || gameType === 'boulpe') {
        html += `<div class="bulk-add-container">
                    <input type="text" id="bulk-numbers" class="bulk-numbers-input" placeholder="Eg: 12 23 45 67">
                    <button class="bulk-add-btn" id="bulk-add-bet">+ Ajoute tout</button>
                 </div>
                 <div class="quick-bet-form">
                    <input type="text" id="${gameType}-number" placeholder="00" maxlength="2" class="quick-number-input">
                    <input type="number" id="${gameType}-amount" value="1" class="quick-amount-input">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                 </div>
                 <div class="nx-button" id="show-nx-balls"><i class="fas fa-chart-simple"></i> Nx</div>
                 <div class="n-balls-container" id="n-balls-container">
                    ${[...Array(10)].map((_, i) => `<div class="n-ball" data-n="${i}">N${i}</div>`).join('')}
                 </div>`;
    } else if (gameType === 'lotto3' || gameType === 'grap') {
        html += `<div class="quick-bet-form">
                    <input type="text" id="${gameType}-number" placeholder="000" maxlength="3" class="quick-number-input">
                    <input type="number" id="${gameType}-amount" value="1" class="quick-amount-input">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                 </div>`;
        if (gameType === 'grap') {
            html += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px;">
                        ${['111','222','333','444','555','666','777','888','999','000'].map(p => `<div class="pair-ball" data-pair="${p}">${p}</div>`).join('')}
                     </div>`;
        }
    } else if (gameType === 'marriage') {
        html += `<div class="number-inputs"><input type="text" id="marriage-number1" placeholder="00" maxlength="2"><input type="text" id="marriage-number2" placeholder="00" maxlength="2"></div>
                 <div class="quick-bet-form"><input type="number" id="marriage-amount" value="1" class="quick-amount-input"><button class="btn-primary" id="add-bet">Ajoute</button></div>`;
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        const digits = gameType === 'lotto4' ? 2 : 3;
        html += `<div class="number-inputs"><input type="text" id="${gameType}-number1" placeholder="${'0'.repeat(digits)}" maxlength="${digits}"><input type="text" id="${gameType}-number2" placeholder="00" maxlength="2"></div>
                 <div class="options-container">
                    <div class="option-checkbox"><input type="checkbox" id="${gameType}-option1" checked> <label>Opsyon 1</label><span class="option-multiplier">×${bet.multiplier}</span></div>
                    <div class="option-checkbox"><input type="checkbox" id="${gameType}-option2" checked> <label>Opsyon 2</label><span class="option-multiplier">×${bet.multiplier}</span></div>
                    <div class="option-checkbox"><input type="checkbox" id="${gameType}-option3" checked> <label>Opsyon 3</label><span class="option-multiplier">×${bet.multiplier}</span></div>
                 </div>
                 <div class="quick-bet-form"><input type="number" id="${gameType}-amount" placeholder="Kantite pa opsyon" value="1" class="quick-amount-input"><button class="btn-primary" id="add-bet">Ajoute</button></div>`;
    }
    html += `<div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    formDiv.innerHTML = html;

    document.getElementById('return-to-types').addEventListener('click', () => { formDiv.style.display = 'none'; document.getElementById('games-interface').style.display = 'block'; });
    document.getElementById('add-bet').addEventListener('click', () => addBet(gameType));
    
    const bulkAdd = document.getElementById('bulk-add-bet');
    if (bulkAdd) {
        bulkAdd.addEventListener('click', () => {
            const bulkInput = document.getElementById('bulk-numbers').value;
            const amount = parseInt(document.getElementById(`${gameType}-amount`).value) || 1;
            const numbers = bulkInput.trim().split(/\s+/).filter(n => /^\d{2}$/.test(n));
            if (!numbers.length) return showNotification("Antre nimewo yo (eg: 12 23)", "warning");
            numbers.forEach(num => activeBets.push({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number: num, amount, multiplier: bet.multiplier }));
            updateBetsList();
            showNotification(`${numbers.length} parye ajoute`, "success");
            document.getElementById('bulk-numbers').value = '';
        });
    }
    
    const nxBtn = document.getElementById('show-nx-balls');
    if (nxBtn) nxBtn.addEventListener('click', () => document.getElementById('n-balls-container')?.classList.toggle('show'));
    document.querySelectorAll('.n-ball').forEach(ball => {
        ball.addEventListener('click', () => {
            const n = ball.dataset.n;
            const amount = parseInt(document.getElementById(`${gameType}-amount`).value) || 1;
            const numbers = Array.from({length:10}, (_,i) => String(i+parseInt(n)).padStart(2,'0'));
            activeBets.push({ id: Date.now()+Math.random(), type: gameType, name: bet.name + ` N${n}`, number: `${n}0-${n}9`, amount: amount*10, multiplier: bet.multiplier, isGroup: true });
            updateBetsList();
            showNotification(`10 boule N${n} ajoute`, "success");
        });
    });
    document.querySelectorAll('.pair-ball').forEach(ball => {
        ball.addEventListener('click', () => {
            const input = document.getElementById(`${gameType}-number`);
            if (input) input.value = ball.dataset.pair;
        });
    });
    setupAutoFocusInputs();
}

function showAutoGameForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    const formDiv = document.getElementById('bet-form');
    formDiv.style.display = 'block';
    selectedBalls = [];
    formDiv.innerHTML = `<h3>${bet.name}</h3>
        <div><button id="use-basket-balls">Itilize Boul nan Panye</button> <button id="enter-manual-balls">Antre Boul Manyèlman</button></div>
        <div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56"><button id="process-manual-balls">Proses</button></div>
        <div><strong>Boules sélectionnées:</strong> <span id="selected-balls-list">Pa gen</span></div>
        ${gameType === 'auto-lotto4' ? '<div><input type="checkbox" id="include-reverse" checked> Enkli renverse</div>' : ''}
        <div><label>Kantite pou chak</label><input type="number" id="auto-game-amount" value="1"></div>
        <div class="bet-actions"><button class="btn-primary" id="add-auto">Ajoute</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    document.getElementById('use-basket-balls').onclick = () => {
        selectedBalls = [...new Set(activeBets.filter(b=>b.type==='borlette' && !b.isGroup).map(b=>b.number))];
        document.getElementById('selected-balls-list').innerText = selectedBalls.join(', ') || 'Pa gen';
    };
    document.getElementById('enter-manual-balls').onclick = () => document.getElementById('manual-balls-input').style.display = 'block';
    document.getElementById('process-manual-balls').onclick = () => {
        const input = document.getElementById('manual-balls').value.trim();
        selectedBalls = [...new Set(input.split(/\s+/).filter(b=>/^\d{2}$/.test(b)))];
        document.getElementById('selected-balls-list').innerText = selectedBalls.join(', ') || 'Pa gen';
        document.getElementById('manual-balls-input').style.display = 'none';
    };
    document.getElementById('return-to-types').onclick = () => { formDiv.style.display = 'none'; document.getElementById('games-interface').style.display = 'block'; };
    document.getElementById('add-auto').onclick = () => {
        const amount = parseInt(document.getElementById('auto-game-amount').value);
        if (selectedBalls.length < 2) return showNotification("Fò gen omwen 2 boul", "warning");
        if (gameType === 'auto-marriage') {
            for (let i=0; i<selectedBalls.length; i++)
                for (let j=i+1; j<selectedBalls.length; j++)
                    activeBets.push({ id: Date.now()+Math.random(), type: 'marriage', name: bet.name, number: `${selectedBalls[i]}*${selectedBalls[j]}`, amount, multiplier: bet.multiplier });
        } else {
            const includeReverse = document.getElementById('include-reverse')?.checked;
            for (let i=0; i<selectedBalls.length; i++)
                for (let j=i+1; j<selectedBalls.length; j++) {
                    activeBets.push({ id: Date.now()+Math.random(), type: 'lotto4', name: bet.name, number: selectedBalls[i]+selectedBalls[j], amount, multiplier: bet.multiplier, options: {option1:false,option2:false,option3:true}, perOptionAmount: amount });
                    if (includeReverse) activeBets.push({ id: Date.now()+Math.random(), type: 'lotto4', name: bet.name+' (R)', number: selectedBalls[j]+selectedBalls[i], amount, multiplier: bet.multiplier, options: {option1:false,option2:false,option3:true}, perOptionAmount: amount });
                }
        }
        updateBetsList();
        showNotification("Parye otomatik ajoute!", "success");
        formDiv.style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    };
}

function addBet(gameType) {
    const bet = betTypes[gameType];
    let number, amount;
    if (gameType === 'marriage') {
        const n1 = document.getElementById('marriage-number1').value;
        const n2 = document.getElementById('marriage-number2').value;
        if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) return showNotification("Chak chif dwe 2 chif", "warning");
        number = `${n1}*${n2}`;
        amount = parseInt(document.getElementById('marriage-amount').value);
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        const n1 = document.getElementById(`${gameType}-number1`).value;
        const n2 = document.getElementById(`${gameType}-number2`).value;
        const opt1 = document.getElementById(`${gameType}-option1`).checked;
        const opt2 = document.getElementById(`${gameType}-option2`).checked;
        const opt3 = document.getElementById(`${gameType}-option3`).checked;
        const optCount = [opt1, opt2, opt3].filter(Boolean).length;
        if (optCount === 0) return showNotification("Chwazi omwen yon opsyon", "warning");
        number = n1 + n2;
        const perAmount = parseInt(document.getElementById(`${gameType}-amount`).value);
        amount = perAmount * optCount;
        activeBets.push({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number, amount, multiplier: bet.multiplier, options: { option1: opt1, option2: opt2, option3: opt3 }, perOptionAmount: perAmount });
        updateBetsList();
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
        return;
    } else {
        number = document.getElementById(`${gameType}-number`).value;
        amount = parseInt(document.getElementById(`${gameType}-amount`).value);
        const pattern = (gameType === 'lotto3' || gameType === 'grap') ? /^\d{3}$/ : /^\d{2}$/;
        if (!pattern.test(number)) return showNotification(`Dwe gen ${pattern===/^\d{3}$/?3:2} chif`, "warning");
    }
    if (!amount || amount <= 0) return showNotification("Kantite valab obligatwa", "warning");
    activeBets.push({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number, amount, multiplier: bet.multiplier });
    updateBetsList();
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('games-interface').style.display = 'block';
}

function updateBetsList() {
    const container = document.getElementById('bets-list');
    const totalEl = document.getElementById('bet-total');
    if (!activeBets.length) {
        container.innerHTML = '<p>Pa gen parye aktif.</p>';
        totalEl.textContent = '0 goud';
        return;
    }
    let total = 0;
    container.innerHTML = activeBets.map(bet => {
        total += bet.amount;
        return `<div class="bet-item"><div class="bet-details"><strong>${bet.name}</strong><br>${bet.number}</div><div class="bet-amount">${bet.amount} goud <span class="bet-remove" data-id="${bet.id}"><i class="fas fa-times"></i></span></div></div>`;
    }).join('');
    totalEl.textContent = total + ' goud';
    document.querySelectorAll('.bet-remove').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const id = parseFloat(icon.dataset.id);
            activeBets = activeBets.filter(b => b.id !== id);
            updateBetsList();
        });
    });
}

// ========== Sauvegarde et impression ==========
async function saveTicket() {
    if (!activeBets.length) return;
    const ticket = { draw: currentDraw, draw_time: currentDrawTime, bets: activeBets.map(b => ({ type: b.type, number: b.number, amount: b.amount, multiplier: b.multiplier, options: b.options || null })), total: activeBets.reduce((s,b)=>s+b.amount,0) };
    const res = await apiCall('/api/tickets', 'POST', { ticket });
    if (res?.success) {
        showNotification(`Fiche #${res.ticketNumber} sove!`, "success");
        await loadMyTickets();
        return res;
    }
    throw new Error('Erreur sauvegarde');
}

async function saveAndPrintTicket() {
    if (!activeBets.length) return showNotification("Pa gen parye", "warning");
    try {
        const res = await saveTicket();
        if (res) {
            activeBets = [];
            updateBetsList();
            closeBettingScreen();
            printTicket(res.ticketId, res.ticketNumber);
        }
    } catch(e) {}
}

function printTicket(ticketId, ticketNumber) {
    const ticket = savedTickets.find(t => t.ticket_number == ticketNumber);
    if (!ticket) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Ticket ${ticketNumber}</title><style>body{font-family:monospace;padding:20px}.ticket{border:2px solid #000;padding:20px;max-width:400px;margin:0 auto;text-align:center}.company-logo-print{max-width:80px}.total{font-weight:bold;margin-top:15px}</style></head><body><div class="ticket">${companyInfo.logo ? `<img src="${companyInfo.logo}" class="company-logo-print">` : ''}<h2>${companyInfo.name}</h2><div>${companyInfo.slogan || ''}</div><p>Ticket #${ticketNumber}</p><p>${new Date(ticket.created_at).toLocaleString()}</p><hr>${ticket.bets.map(b=>`<div>${b.bet_type}: ${b.numbers} - ${b.amount} G</div>`).join('')}<hr><div class="total">Total: ${ticket.total_amount} G</div><div>${companyInfo.address || ''}</div></div></body></html>`);
    win.document.close();
    win.print();
}

// ========== Multi-tirages ==========
function initMultiDrawPanel() {
    const opts = document.getElementById('multi-draw-options');
    if (!opts) return;
    opts.innerHTML = '';
    for (const [id, draw] of Object.entries(draws)) {
        const div = document.createElement('div');
        div.className = 'multi-draw-option';
        div.dataset.draw = id;
        div.textContent = draw.name;
        div.onclick = () => { div.classList.toggle('selected'); div.classList.contains('selected') ? selectedMultiDraws.add(id) : selectedMultiDraws.delete(id); };
        opts.appendChild(div);
    }
    const gameSel = document.getElementById('multi-game-select');
    if (gameSel) {
        gameSel.innerHTML = '';
        for (const [key, bet] of Object.entries(betTypes)) {
            if (key.startsWith('auto')) continue;
            const div = document.createElement('div');
            div.className = 'multi-game-option' + (key === 'borlette' ? ' selected' : '');
            div.dataset.game = key;
            div.textContent = bet.name;
            div.onclick = () => { document.querySelectorAll('.multi-game-option').forEach(o=>o.classList.remove('selected')); div.classList.add('selected'); selectedMultiGame = key; updateMultiGameForm(key); };
            gameSel.appendChild(div);
        }
    }
    updateMultiGameForm('borlette');
}

function updateMultiGameForm(gameType) {
    const container = document.getElementById('multi-number-inputs');
    if (!container) return;
    let html = `<label>Nimewo</label>`;
    if (['borlette','boulpe','lotto3','grap'].includes(gameType)) {
        const len = (gameType === 'lotto3' || gameType === 'grap') ? 3 : 2;
        html += `<input type="text" id="multi-draw-number" placeholder="${'0'.repeat(len)}" maxlength="${len}">`;
    } else if (gameType === 'marriage' || gameType === 'lotto4') {
        html += `<div class="number-inputs"><input id="multi-n1" placeholder="00" maxlength="2"><input id="multi-n2" placeholder="00" maxlength="2"></div>`;
    } else if (gameType === 'lotto5') {
        html += `<div class="number-inputs"><input id="multi-n1" placeholder="000" maxlength="3"><input id="multi-n2" placeholder="00" maxlength="2"></div>`;
    }
    container.innerHTML = html;
}

function addToMultiDrawTicket() {
    const amount = parseInt(document.getElementById('multi-draw-amount').value);
    if (selectedMultiDraws.size === 0) return showNotification("Chwazi tiraj", "warning");
    let number;
    if (['marriage','lotto4','lotto5'].includes(selectedMultiGame)) {
        const n1 = document.getElementById('multi-n1').value;
        const n2 = document.getElementById('multi-n2').value;
        number = selectedMultiGame === 'marriage' ? `${n1}*${n2}` : n1+n2;
    } else {
        number = document.getElementById('multi-draw-number').value;
    }
    const bet = { id: Date.now().toString(), gameType: selectedMultiGame, name: betTypes[selectedMultiGame].name, number, amount, multiplier: betTypes[selectedMultiGame].multiplier, draws: Array.from(selectedMultiDraws) };
    currentMultiDrawTicket.bets.push(bet);
    selectedMultiDraws.forEach(d => currentMultiDrawTicket.draws.add(d));
    currentMultiDrawTicket.totalAmount += amount * selectedMultiDraws.size;
    updateMultiDrawTicketDisplay();
    showNotification("Ajoute!", "success");
}

function updateMultiDrawTicketDisplay() {
    const info = document.getElementById('current-multi-ticket-info');
    const summary = document.getElementById('multi-ticket-summary');
    if (!currentMultiDrawTicket.bets.length) { if(info) info.style.display = 'none'; return; }
    if(info) info.style.display = 'block';
    if(summary) summary.innerHTML = currentMultiDrawTicket.bets.map(b => `<div>${b.name}: ${b.number} (${b.draws.length} tiraj) - ${b.amount * b.draws.length} G</div>`).join('') + `<div style="font-weight:bold;margin-top:10px;">Total: ${currentMultiDrawTicket.totalAmount} G</div>`;
}

function viewCurrentMultiDrawTicket() {
    if (!currentMultiDrawTicket.bets.length) return showNotification("Fiche vid", "warning");
    const win = window.open('', '_blank');
    win.document.write(`<pre>${JSON.stringify(currentMultiDrawTicket,null,2)}</pre>`);
}

async function saveAndPrintMultiDrawTicket() {
    if (!currentMultiDrawTicket.bets.length) return showNotification("Fiche vid", "warning");
    const res = await apiCall('/api/tickets/multi-draw', 'POST', { bets: currentMultiDrawTicket.bets, draws: Array.from(currentMultiDrawTicket.draws), total: currentMultiDrawTicket.totalAmount });
    if (res?.success) {
        showNotification("Fiche multi-tirages sove!", "success");
        currentMultiDrawTicket = { id: Date.now().toString(), bets: [], totalAmount: 0, draws: new Set(), createdAt: new Date().toISOString() };
        updateMultiDrawTicketDisplay();
        await loadMultiDrawTickets();
    }
}

function toggleMultiDrawPanel() {
    document.getElementById('multi-draw-content').classList.toggle('expanded');
}

function openMultiTicketsScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('multi-tickets-screen').style.display = 'block';
    const list = document.getElementById('multi-tickets-list');
    list.innerHTML = multiDrawTickets.length ? multiDrawTickets.map(t => `<div class="multi-ticket-item">Fiche #${t.id} - ${t.total} G</div>`).join('') : '<p>Pa gen fiche multi-tirages</p>';
}

// ========== Résultats ==========
function openResultsCheckScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('results-check-screen').style.display = 'block';
    const latest = document.getElementById('latest-results');
    latest.innerHTML = '';
    for (const [drawId, draw] of Object.entries(draws)) {
        for (const [time, label] of Object.entries(draw.times)) {
            const r = resultsDatabase[drawId]?.[time];
            if (r) latest.innerHTML += `<div class="lot-result-3"><div>${draw.name} ${time}</div><div class="lot-numbers">${r.lot1||'---'} | ${r.lot2||'---'} | ${r.lot3||'---'}</div></div>`;
        }
    }
}

async function checkWinningTickets() {
    const res = await apiCall('/api/tickets/winning');
    const container = document.getElementById('winning-tickets-container');
    if (res?.success && res.tickets.length) {
        container.innerHTML = res.tickets.map(w => `<div class="winning-ticket"><strong>#${w.ticket_number}</strong> - ${w.winning_amount} HTG</div>`).join('');
    } else {
        container.innerHTML = '<p>Pa gen fiche gagnant</p>';
    }
}

// ========== Historique ==========
function updateHistoryScreen() {
    const list = document.getElementById('history-list');
    if (!savedTickets.length) { list.innerHTML = '<p>Pa gen fich</p>'; return; }
    list.innerHTML = savedTickets.map(ticket => `
        <div class="ticket-item" data-id="${ticket.id}">
            <div class="ticket-header">
                <span class="ticket-number">#${ticket.ticket_number}</span>
                <span class="ticket-date">${new Date(ticket.created_at).toLocaleString()}</span>
                <span class="ticket-amount">${ticket.total_amount} G</span>
            </div>
            <div class="ticket-actions">
                <button class="ticket-action print" data-id="${ticket.id}"><i class="fas fa-print"></i> Enprime</button>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.ticket-action.print').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const ticket = savedTickets.find(t => t.id == id);
            if (ticket) printTicketFromHistory(ticket);
        });
    });
}

function printTicketFromHistory(ticket) {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Ticket ${ticket.ticket_number}</title><style>body{font-family:monospace;padding:20px}.ticket{border:2px solid #000;padding:20px;max-width:400px;margin:0 auto;text-align:center}</style></head><body><div class="ticket">${companyInfo.logo ? `<img src="${companyInfo.logo}" style="max-width:80px">` : ''}<h2>${companyInfo.name}</h2><div>${companyInfo.slogan || ''}</div><p>Ticket #${ticket.ticket_number}</p><p>${new Date(ticket.created_at).toLocaleString()}</p><hr>${ticket.bets.map(b=>`<div>${b.bet_type}: ${b.numbers} - ${b.amount} G</div>`).join('')}<hr><div class="total">Total: ${ticket.total_amount} G</div><div>${companyInfo.address || ''}</div></div></body></html>`);
    win.document.close();
    win.print();
}

function updateWinningTicketsScreen() {
    const list = document.getElementById('winning-tickets-list');
    list.innerHTML = winningTickets.length ? winningTickets.map(w => `<div class="winning-ticket"><strong>#${w.ticket_number}</strong> - ${w.winning_amount} G</div>`).join('') : '<p>Pa gen fiche gagnant</p>';
}

function searchWinningTickets() {
    const term = document.getElementById('search-winning-tickets').value.toLowerCase();
    const filtered = winningTickets.filter(w => w.ticket_number.toLowerCase().includes(term));
    const list = document.getElementById('winning-tickets-list');
    list.innerHTML = filtered.length ? filtered.map(w => `<div>${w.ticket_number}</div>`).join('') : '<p>Aucun résultat</p>';
}

function searchHistory() {
    const term = document.getElementById('search-history').value.toLowerCase();
    const filtered = savedTickets.filter(t => t.ticket_number.toLowerCase().includes(term));
    const list = document.getElementById('history-list');
    list.innerHTML = filtered.length ? filtered.map(t => `<div>${t.ticket_number}</div>`).join('') : '<p>Aucun résultat</p>';
}

function setupAutoFocusInputs() {
    document.querySelectorAll('input[type="text"]').forEach(i => {
        i.addEventListener('input', function() {
            if (this.value.length >= this.maxLength) {
                const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
                const idx = inputs.indexOf(this);
                if (idx < inputs.length-1) inputs[idx+1].focus();
            }
        });
    });
}

// ========== Rapports ==========
function updateReportScreen() {
    loadReportByPeriod('15days');
}

function loadReportByPeriod(period) {
    const end = new Date();
    let start = new Date();
    switch(period) {
        case 'today': start.setHours(0,0,0,0); break;
        case '7days': start.setDate(end.getDate()-7); break;
        case '15days': start.setDate(end.getDate()-15); break;
        case 'month': start = new Date(end.getFullYear(), end.getMonth(), 1); break;
        default: start.setDate(end.getDate()-15);
    }
    document.getElementById('start-date').value = start.toISOString().split('T')[0];
    document.getElementById('end-date').value = end.toISOString().split('T')[0];
    loadReportData(start, end);
}

function loadReportCustom(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23,59,59,999);
    loadReportData(start, end);
}

function loadReportData(start, end) {
    const filtered = savedTickets.filter(t => new Date(t.created_at) >= start && new Date(t.created_at) <= end);
    const totalSales = filtered.reduce((s,t)=>s+t.total_amount,0);
    const commission = totalSales * (companyInfo.agentCommission/100);
    const payouts = filtered.filter(t=>t.winning_amount).reduce((s,t)=>s+(t.winning_amount||0),0);
    document.getElementById('total-sales').innerText = totalSales + ' G';
    document.getElementById('commission-rate').innerText = companyInfo.agentCommission + '%';
    document.getElementById('commission-earned').innerText = commission.toFixed(2) + ' G';
    document.getElementById('total-payouts').innerText = payouts + ' G';
    document.getElementById('net-profit').innerText = (totalSales - payouts) + ' G';
    const detail = document.getElementById('report-detail-list');
    const drawStats = {};
    filtered.forEach(t => { drawStats[t.draw] = (drawStats[t.draw]||0) + t.total_amount; });
    detail.innerHTML = Object.entries(drawStats).map(([d,a]) => `<div class="report-detail-item"><span>${d}</span><span>${a} G</span></div>`).join('');
    if (!Object.keys(drawStats).length) detail.innerHTML = '<p>Pa gen done</p>';
}