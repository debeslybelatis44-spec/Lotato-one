// ==========================================
// LOTATO - Interface Agent (Version Complète)
// ==========================================

const API_BASE_URL = '';
let authToken = localStorage.getItem('lotato_token');
let currentUser = null;

// Types de paris (seront mis à jour depuis l'API)
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

// Données des tirages
const draws = {
    miami: { name: "Miami (Florida)", times: { morning: "1:30 PM", evening: "9:50 PM" } },
    georgia: { name: "Georgia", times: { morning: "12:30 PM", evening: "7:00 PM" } },
    newyork: { name: "New York", times: { morning: "2:30 PM", evening: "8:00 PM" } },
    texas: { name: "Texas", times: { morning: "12:00 PM", evening: "6:00 PM" } },
    tunisia: { name: "Tunisie", times: { morning: "10:30 AM", evening: "2:00 PM" } }
};

// Variables globales
let currentDraw = null;
let currentDrawTime = null;
let activeBets = [];
let savedTickets = [];
let pendingSyncTickets = [];
let winningTickets = [];
let multiDrawTickets = [];
let resultsDatabase = {};
let companyInfo = { name: "Lotato", phone: "+509 32 53 49 58", address: "Cap Haïtien", reportTitle: "Lotato", reportPhone: "40104585", slogan: "Chwazi yon Jwet", logo: "", agentCommission: 10, allowEditDelete: true, editDeleteDelay: 5 };
let selectedMultiDraws = new Set();
let selectedMultiGame = 'borlette';
let selectedBalls = [];
let currentMultiDrawTicket = { id: Date.now().toString(), bets: [], totalAmount: 0, draws: new Set(), createdAt: new Date().toISOString() };
let ticketNumber = 1;

// ==========================================
// API et utilitaires
// ==========================================
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
    document.getElementById('current-time').textContent = str;
}

// ==========================================
// Chargement initial
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
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
    document.getElementById('company-name').textContent = companyInfo.name;
    document.getElementById('company-slogan').textContent = companyInfo.slogan;
    if (companyInfo.logo) {
        document.getElementById('company-logo').src = companyInfo.logo;
    }
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
        if (s.allow_edit_delete !== undefined) companyInfo.allowEditDelete = s.allow_edit_delete;
        if (s.edit_delete_delay) companyInfo.editDeleteDelay = parseInt(s.edit_delete_delay);
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

// ==========================================
// Événements
// ==========================================
function setupEventListeners() {
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

    document.getElementById('back-button').addEventListener('click', closeBettingScreen);
    document.getElementById('save-print-ticket').addEventListener('click', () => {
        if (activeBets.length) saveAndPrintTicket();
        else showNotification("Pa gen parye", "warning");
    });
    document.getElementById('generate-report-btn').addEventListener('click', generateEndOfDrawReport);
    document.getElementById('open-results-check').addEventListener('click', openResultsCheckScreen);
    document.getElementById('check-winners-btn').addEventListener('click', checkWinningTickets);
    document.getElementById('back-from-results').addEventListener('click', () => { document.getElementById('results-check-screen').style.display = 'none'; document.querySelector('.container').style.display = 'block'; });
    document.getElementById('back-from-report').addEventListener('click', () => { document.getElementById('end-draw-report-screen').style.display = 'none'; document.querySelector('.container').style.display = 'block'; });
    document.getElementById('multi-draw-toggle').addEventListener('click', toggleMultiDrawPanel);
    document.getElementById('add-to-multi-draw').addEventListener('click', addToMultiDrawTicket);
    document.getElementById('view-current-multi-ticket').addEventListener('click', viewCurrentMultiDrawTicket);
    document.getElementById('save-print-multi-ticket').addEventListener('click', saveAndPrintMultiDrawTicket);
    document.getElementById('open-multi-tickets').addEventListener('click', openMultiTicketsScreen);
    document.getElementById('back-from-multi-tickets').addEventListener('click', () => { document.getElementById('multi-tickets-screen').style.display = 'none'; document.querySelector('.container').style.display = 'block'; });
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('show-results-btn').addEventListener('click', openResultsCheckScreen);

    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => showScreen(item.dataset.screen)));
    document.querySelectorAll('.back-button[data-screen]').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));

    document.getElementById('search-winning-btn').addEventListener('click', searchWinningTickets);
    document.getElementById('search-history-btn').addEventListener('click', searchHistory);
    
    // Filtres rapport
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const period = btn.dataset.period;
            if (period) loadReportByPeriod(period);
        });
    });
    document.getElementById('apply-custom').addEventListener('click', () => {
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
    document.querySelectorAll('.screen, .betting-screen, .container, .report-screen, .results-check-screen, .multi-tickets-screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.nav-item[data-screen="${screenId}"]`)?.classList.add('active');
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

// ==========================================
// Écran de pari
// ==========================================
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
            else if (gameType === 'nx') showNxGameForm();
            else showBetForm(gameType);
        });
    });
}

// ==========================================
// Formulaires de paris (versions complètes)
// ==========================================
function showBetForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    const form = document.getElementById('bet-form');
    form.style.display = 'block';
    let html = `<h3>${bet.name} - ${bet.description}</h3>`;

    if (gameType === 'borlette' || gameType === 'boulpe') {
        html += `<div class="bulk-add-container">
                    <input type="text" id="bulk-numbers" class="bulk-numbers-input" placeholder="Eg: 12 23 45 67 (separe pa espas)">
                    <button class="bulk-add-btn" id="bulk-add-bet">+ Ajoute tout</button>
                 </div>
                 <div class="quick-bet-form">
                    <input type="text" id="${gameType}-number" placeholder="00" maxlength="2" class="quick-number-input">
                    <input type="number" id="${gameType}-amount" placeholder="Kantite" min="1" value="1" class="quick-amount-input">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                 </div>
                 <div class="nx-button" id="show-nx-balls"><i class="fas fa-chart-simple"></i> Nx</div>
                 <div class="n-balls-container" id="n-balls-container">
                    ${[...Array(10)].map((_, i) => `<div class="n-ball" data-n="${i}">N${i}</div>`).join('')}
                 </div>`;
    } else if (gameType === 'lotto3' || gameType === 'grap') {
        html += `<div class="quick-bet-form">
                    <input type="text" id="${gameType}-number" placeholder="${gameType === 'grap' ? '000' : '000'}" maxlength="3" class="quick-number-input">
                    <input type="number" id="${gameType}-amount" placeholder="Kantite" min="1" value="1" class="quick-amount-input">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                 </div>`;
        if (gameType === 'grap') {
            html += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px;">
                        ${['111','222','333','444','555','666','777','888','999','000'].map(p => `<div class="pair-ball" data-pair="${p}">${p}</div>`).join('')}
                     </div>`;
        }
    } else if (gameType === 'marriage') {
        html += `<div class="number-inputs"><input type="text" id="marriage-number1" placeholder="00" maxlength="2"><input type="text" id="marriage-number2" placeholder="00" maxlength="2"></div>
                 <div class="quick-bet-form"><input type="number" id="marriage-amount" placeholder="Kantite" min="1" value="1" class="quick-amount-input"><button class="btn-primary" id="add-bet">Ajoute</button></div>`;
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        const digits = gameType === 'lotto4' ? 2 : 3;
        html += `<div class="number-inputs"><input type="text" id="${gameType}-number1" placeholder="${'0'.repeat(digits)}" maxlength="${digits}"><input type="text" id="${gameType}-number2" placeholder="00" maxlength="2"></div>`;
        html += `<div class="options-container">
                    <div class="option-checkbox"><input type="checkbox" id="${gameType}-option1" checked> <label>Opsyon 1</label><span class="option-multiplier">×${bet.multiplier}</span></div>
                    <div class="option-checkbox"><input type="checkbox" id="${gameType}-option2" checked> <label>Opsyon 2</label><span class="option-multiplier">×${bet.multiplier}</span></div>
                    <div class="option-checkbox"><input type="checkbox" id="${gameType}-option3" checked> <label>Opsyon 3</label><span class="option-multiplier">×${bet.multiplier}</span></div>
                 </div>`;
        html += `<div class="quick-bet-form"><input type="number" id="${gameType}-amount" placeholder="Kantite pa opsyon" min="1" value="1" class="quick-amount-input"><button class="btn-primary" id="add-bet">Ajoute</button></div>`;
    }
    html += `<div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    form.innerHTML = html;

    document.getElementById('return-to-types').addEventListener('click', () => { form.style.display = 'none'; document.getElementById('games-interface').style.display = 'block'; });
    document.getElementById('add-bet').addEventListener('click', () => addBet(gameType));
    
    // Ajout groupé
    const bulkAddBtn = document.getElementById('bulk-add-bet');
    if (bulkAddBtn) {
        bulkAddBtn.addEventListener('click', () => {
            const bulkInput = document.getElementById('bulk-numbers').value;
            const amountInput = document.getElementById(`${gameType}-amount`);
            const amount = amountInput ? parseInt(amountInput.value) : 1;
            if (!bulkInput.trim()) return showNotification("Antre nimewo yo", "warning");
            const numbers = bulkInput.trim().split(/\s+/).filter(n => /^\d{2}$/.test(n));
            if (numbers.length === 0) return showNotification("Nimewo dwe 2 chif", "warning");
            numbers.forEach(num => {
                activeBets.push({ type: gameType, name: bet.name, number: num, amount: amount, multiplier: bet.multiplier });
            });
            updateBetsList();
            showNotification(`${numbers.length} parye ajoute!`, "success");
            document.getElementById('bulk-numbers').value = '';
        });
    }
    
    // Bouton Nx
    const nxBtn = document.getElementById('show-nx-balls');
    if (nxBtn) {
        nxBtn.addEventListener('click', () => {
            const container = document.getElementById('n-balls-container');
            container.classList.toggle('show');
        });
    }
    
    // Boules Nx individuelles
    if (gameType === 'borlette' || gameType === 'boulpe') {
        document.querySelectorAll('.n-ball').forEach(ball => {
            ball.addEventListener('click', () => {
                const n = ball.dataset.n;
                const amountInput = document.getElementById(`${gameType}-amount`);
                const amount = amountInput ? parseInt(amountInput.value) : 1;
                if (!amount || amount <= 0) return showNotification("Kantite valab obligatwa", "warning");
                const numbers = Array.from({ length: 10 }, (_, i) => String(i + parseInt(n)).padStart(2, '0'));
                activeBets.push({ type: gameType, name: bet.name + ` N${n}`, number: `${n}0-${n}9`, amount: amount * 10, multiplier: bet.multiplier, isGroup: true, details: numbers.map(num => ({ number: num, amount: amount })) });
                updateBetsList();
                showNotification(`10 boule N${n} ajoute!`, "success");
            });
        });
    }
    
    if (gameType === 'grap') {
        document.querySelectorAll('.pair-ball').forEach(ball => {
            ball.addEventListener('click', () => {
                document.getElementById('grap-number').value = ball.dataset.pair;
                document.getElementById('grap-amount').focus();
            });
        });
    }
    setupAutoFocusInputs();
}

function showNxGameForm() {
    const bet = { name: "NX (Boul N0-N9)", multiplier: 60 };
    document.getElementById('games-interface').style.display = 'none';
    const form = document.getElementById('bet-form');
    form.style.display = 'block';
    let html = `<h3>${bet.name}</h3>
                <div class="bulk-add-container">
                    <input type="text" id="nx-bulk-numbers" class="bulk-numbers-input" placeholder="Eg: N0,N1,N2 ou N0,N1,N2,N3,N4,N5,N6,N7,N8,N9">
                    <button class="bulk-add-btn" id="bulk-add-nx">+ Ajoute tout</button>
                </div>
                <div class="n-balls-container show" id="n-balls-container-nx">
                    ${[...Array(10)].map((_, i) => `<div class="n-ball" data-n="${i}">N${i}</div>`).join('')}
                </div>
                <div class="quick-bet-form">
                    <label>Kantite pou chak boule</label>
                    <input type="number" id="nx-amount" placeholder="Kantite" min="1" value="1">
                </div>
                <div class="bet-actions">
                    <button class="btn-primary" id="add-nx-bet">Ajoute seleksyon</button>
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>`;
    form.innerHTML = html;

    document.getElementById('return-to-types').addEventListener('click', () => { form.style.display = 'none'; document.getElementById('games-interface').style.display = 'block'; });
    document.getElementById('bulk-add-nx').addEventListener('click', () => {
        const input = document.getElementById('nx-bulk-numbers').value;
        const amount = parseInt(document.getElementById('nx-amount').value);
        if (!amount || amount <= 0) return showNotification("Kantite valab obligatwa", "warning");
        const matches = input.match(/N(\d)/gi);
        if (matches) {
            const numbers = matches.map(m => parseInt(m.replace('N',''))).filter(n => !isNaN(n) && n >=0 && n <=9);
            const unique = [...new Set(numbers)];
            if (unique.length) {
                unique.forEach(n => {
                    const numbersList = Array.from({ length: 10 }, (_, i) => String(i + n).padStart(2, '0'));
                    activeBets.push({ type: 'borlette', name: `NX N${n}`, number: `${n}0-${n}9`, amount: amount * 10, multiplier: bet.multiplier, isGroup: true, details: numbersList.map(num => ({ number: num, amount: amount })) });
                });
                updateBetsList();
                showNotification(`${unique.length} seri Nx ajoute!`, "success");
            }
        }
    });
    document.querySelectorAll('#n-balls-container-nx .n-ball').forEach(ball => {
        ball.addEventListener('click', () => {
            const n = ball.dataset.n;
            const amount = parseInt(document.getElementById('nx-amount').value);
            if (!amount || amount <= 0) return showNotification("Kantite valab obligatwa", "warning");
            const numbers = Array.from({ length: 10 }, (_, i) => String(i + parseInt(n)).padStart(2, '0'));
            activeBets.push({ type: 'borlette', name: `NX N${n}`, number: `${n}0-${n}9`, amount: amount * 10, multiplier: bet.multiplier, isGroup: true, details: numbers.map(num => ({ number: num, amount: amount })) });
            updateBetsList();
            showNotification(`10 boule N${n} ajoute!`, "success");
        });
    });
    document.getElementById('add-nx-bet').addEventListener('click', () => {
        showNotification("Klike sou boule Nx pou ajoute", "info");
    });
}

function showAutoGameForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    const form = document.getElementById('bet-form');
    form.style.display = 'block';
    selectedBalls = [];
    let html = `<h3>${bet.name}</h3>
                <div class="options-container">
                    <div class="all-graps-btn" id="use-basket-balls"><i class="fas fa-shopping-basket"></i> Itilize Boul nan Panye</div>
                    <div class="all-graps-btn" id="enter-manual-balls"><i class="fas fa-keyboard"></i> Antre Boul Manyèlman</div>
                    <div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56"><button class="btn-primary" id="process-manual-balls">Proses</button></div>
                    <div><strong>Boules sélectionnées:</strong> <span id="selected-balls-list">Pa gen boul</span></div>`;
    if (gameType === 'auto-lotto4') html += `<div class="option-checkbox"><input type="checkbox" id="include-reverse" checked> Enkli renverse</div>`;
    html += `</div>
            <div class="form-group"><label>Kantite pou chak</label><input type="number" id="auto-game-amount" min="1" value="1"></div>
            <div class="bet-actions"><button class="btn-primary" id="add-auto">Ajoute</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    form.innerHTML = html;

    document.getElementById('use-basket-balls').addEventListener('click', () => {
        const balls = activeBets.filter(b => (b.type === 'borlette' || b.type === 'boulpe') && !b.isGroup).map(b => b.number);
        selectedBalls = [...new Set(balls)];
        updateSelectedBallsDisplay();
    });
    document.getElementById('enter-manual-balls').addEventListener('click', () => document.getElementById('manual-balls-input').style.display = 'block');
    document.getElementById('process-manual-balls').addEventListener('click', () => {
        const input = document.getElementById('manual-balls').value.trim();
        const balls = input.split(/\s+/).filter(b => /^\d{2}$/.test(b));
        selectedBalls = [...new Set(balls)];
        updateSelectedBallsDisplay();
        document.getElementById('manual-balls-input').style.display = 'none';
    });
    document.getElementById('return-to-types').addEventListener('click', () => { form.style.display = 'none'; document.getElementById('games-interface').style.display = 'block'; });
    document.getElementById('add-auto').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('auto-game-amount').value);
        if (selectedBalls.length < 2) return showNotification("Fò gen omwen 2 boul", "warning");
        if (gameType === 'auto-marriage') {
            for (let i = 0; i < selectedBalls.length; i++) {
                for (let j = i + 1; j < selectedBalls.length; j++) {
                    activeBets.push({ type: 'marriage', name: bet.name, number: `${selectedBalls[i]}*${selectedBalls[j]}`, amount, multiplier: bet.multiplier });
                }
            }
        } else {
            const includeReverse = document.getElementById('include-reverse')?.checked;
            for (let i = 0; i < selectedBalls.length; i++) {
                for (let j = i + 1; j < selectedBalls.length; j++) {
                    const b1 = selectedBalls[i], b2 = selectedBalls[j];
                    activeBets.push({ type: 'lotto4', name: bet.name, number: b1 + b2, amount, multiplier: bet.multiplier, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
                    if (includeReverse) activeBets.push({ type: 'lotto4', name: bet.name + ' (R)', number: b2 + b1, amount, multiplier: bet.multiplier, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
                }
            }
        }
        updateBetsList();
        showNotification("Parye otomatik ajoute!", "success");
        form.style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    });
}

function updateSelectedBallsDisplay() {
    const span = document.getElementById('selected-balls-list');
    if (span) span.textContent = selectedBalls.length ? selectedBalls.join(', ') : 'Pa gen boul';
}

function addBet(gameType) {
    const bet = betTypes[gameType];
    let number, amount;

    if (gameType === 'marriage') {
        const n1 = document.getElementById('marriage-number1').value, n2 = document.getElementById('marriage-number2').value;
        if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) return showNotification("Chak chif dwe 2 chif", "warning");
        number = `${n1}*${n2}`;
        amount = parseInt(document.getElementById('marriage-amount').value);
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        const n1 = document.getElementById(`${gameType}-number1`).value, n2 = document.getElementById(`${gameType}-number2`).value;
        const opt1 = document.getElementById(`${gameType}-option1`).checked, opt2 = document.getElementById(`${gameType}-option2`).checked, opt3 = document.getElementById(`${gameType}-option3`).checked;
        const optCount = [opt1, opt2, opt3].filter(Boolean).length;
        if (optCount === 0) return showNotification("Chwazi omwen yon opsyon", "warning");
        number = n1 + n2;
        const perAmount = parseInt(document.getElementById(`${gameType}-amount`).value);
        amount = perAmount * optCount;
        activeBets.push({ type: gameType, name: bet.name, number, amount, multiplier: bet.multiplier, options: { option1: opt1, option2: opt2, option3: opt3 }, perOptionAmount: perAmount, [`is${gameType.charAt(0).toUpperCase() + gameType.slice(1)}`]: true });
        updateBetsList();
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
        return;
    } else {
        number = document.getElementById(`${gameType}-number`).value;
        amount = parseInt(document.getElementById(`${gameType}-amount`).value);
        const pattern = (gameType === 'lotto3' || gameType === 'grap') ? /^\d{3}$/ : /^\d{2}$/;
        if (!pattern.test(number)) return showNotification(`Dwe gen ${pattern === /^\d{3}$/ ? '3' : '2'} chif`, "warning");
    }
    if (!amount || amount <= 0) return showNotification("Kantite valab obligatwa", "warning");
    activeBets.push({ type: gameType, name: bet.name, number, amount, multiplier: bet.multiplier });
    updateBetsList();
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('games-interface').style.display = 'block';
}

function updateBetsList() {
    const container = document.getElementById('bets-list'), totalEl = document.getElementById('bet-total');
    if (!activeBets.length) {
        container.innerHTML = '<p>Pa gen parye aktif.</p>';
        totalEl.textContent = '0 goud';
        return;
    }
    const grouped = {};
    activeBets.forEach((bet, i) => {
        const key = `${bet.type}_${bet.number}_${JSON.stringify(bet.options || {})}`;
        if (!grouped[key]) grouped[key] = { bet, count: 1, total: bet.amount, indexes: [i] };
        else { grouped[key].count++; grouped[key].total += bet.amount; grouped[key].indexes.push(i); }
    });
    container.innerHTML = '';
    Object.values(grouped).forEach(g => {
        const div = document.createElement('div');
        div.className = 'bet-item';
        let opts = '';
        if (g.bet.options) {
            const o = [];
            if (g.bet.options.option1) o.push('O1');
            if (g.bet.options.option2) o.push('O2');
            if (g.bet.options.option3) o.push('O3');
            if (o.length) opts = ` (${o.join(',')})`;
        }
        div.innerHTML = `<div class="bet-details"><strong>${g.bet.name}</strong><br>${g.bet.number}${opts}</div><div class="bet-amount">${g.total} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        div.querySelector('.bet-remove').addEventListener('click', function() {
            const idx = this.dataset.indexes.split(',').map(Number).sort((a, b) => b - a);
            idx.forEach(i => activeBets.splice(i, 1));
            updateBetsList();
        });
        container.appendChild(div);
    });
    totalEl.textContent = `${activeBets.reduce((s, b) => s + b.amount, 0)} goud`;
}

// ==========================================
// Gestion des tickets
// ==========================================
async function saveTicket() {
    if (!activeBets.length) return;
    const ticket = { draw: currentDraw, draw_time: currentDrawTime, bets: activeBets.map(b => ({ type: b.type, number: b.number, amount: b.amount, multiplier: b.multiplier, options: b.options || null })), total: activeBets.reduce((s, b) => s + b.amount, 0) };
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
    } catch (e) {}
}

function printTicket(ticketId, ticketNumber) {
    const ticket = savedTickets.find(t => t.ticket_number === ticketNumber);
    if (!ticket) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head><title>Ticket ${ticketNumber}</title>
        <style>
            body{font-family:Arial;padding:20px} 
            .ticket{border:2px solid #000;padding:20px;max-width:400px;margin:0 auto;text-align:center}
            .company-logo-print{max-width:80px;margin-bottom:10px}
            h2{margin:5px 0}
            .slogan{color:#666;font-size:12px}
            .total{font-size:1.2em;font-weight:bold;margin-top:15px}
            .address{font-size:10px;color:#999;margin-top:10px}
        </style>
        </head>
        <body>
        <div class="ticket print-ticket">
            ${companyInfo.logo ? `<img src="${companyInfo.logo}" class="company-logo-print">` : ''}
            <h2>${companyInfo.name}</h2>
            <div class="slogan">${companyInfo.slogan || ''}</div>
            <p>Ticket #${ticketNumber}</p>
            <p>${new Date(ticket.created_at).toLocaleString()}</p>
            <hr>
            ${ticket.bets.map(b => `<div>${b.bet_type}: ${b.numbers} - ${b.amount} HTG</div>`).join('')}
            <hr>
            <div class="total">Total: ${ticket.total_amount} HTG</div>
            <div class="address">${companyInfo.address || ''}</div>
        </div>
        </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ==========================================
// Multi-tirages (complet)
// ==========================================
function initMultiDrawPanel() {
    const opts = document.getElementById('multi-draw-options');
    Object.keys(draws).forEach(drawId => {
        const div = document.createElement('div');
        div.className = 'multi-draw-option';
        div.dataset.draw = drawId;
        div.textContent = draws[drawId].name;
        div.addEventListener('click', function() {
            this.classList.toggle('selected');
            this.classList.contains('selected') ? selectedMultiDraws.add(drawId) : selectedMultiDraws.delete(drawId);
        });
        opts.appendChild(div);
    });
    const gameSel = document.getElementById('multi-game-select');
    Object.keys(betTypes).filter(k => !k.startsWith('auto') && k !== 'nx').forEach(key => {
        const div = document.createElement('div');
        div.className = 'multi-game-option' + (key === 'borlette' ? ' selected' : '');
        div.dataset.game = key;
        div.textContent = betTypes[key].name;
        div.addEventListener('click', function() {
            document.querySelectorAll('.multi-game-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            selectedMultiGame = key;
            updateMultiGameForm(key);
        });
        gameSel.appendChild(div);
    });
    updateMultiGameForm('borlette');
}

function updateMultiGameForm(gameType) {
    const container = document.getElementById('multi-number-inputs');
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
        const n1 = document.getElementById('multi-n1').value, n2 = document.getElementById('multi-n2').value;
        number = selectedMultiGame === 'marriage' ? `${n1}*${n2}` : n1 + n2;
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
    const info = document.getElementById('current-multi-ticket-info'), summary = document.getElementById('multi-ticket-summary');
    if (!currentMultiDrawTicket.bets.length) { info.style.display = 'none'; return; }
    info.style.display = 'block';
    summary.innerHTML = currentMultiDrawTicket.bets.map(b => `<div>${b.name}: ${b.number} (${b.draws.length} tiraj) - ${b.amount * b.draws.length} G</div>`).join('') + `<div style="font-weight:bold;margin-top:10px;">Total: ${currentMultiDrawTicket.totalAmount} G</div>`;
}

function viewCurrentMultiDrawTicket() {
    if (!currentMultiDrawTicket.bets.length) return showNotification("Fiche vid", "warning");
    const preview = window.open('', '_blank');
    preview.document.write(`<html><head><title>Fiche Multi-Tirages</title></head><body><pre>${JSON.stringify(currentMultiDrawTicket, null, 2)}</pre></body></html>`);
}

async function saveAndPrintMultiDrawTicket() {
    if (!currentMultiDrawTicket.bets.length) return showNotification("Fiche vid", "warning");
    const ticket = { bets: currentMultiDrawTicket.bets, draws: Array.from(currentMultiDrawTicket.draws), total: currentMultiDrawTicket.totalAmount };
    const res = await apiCall('/api/tickets/multi-draw', 'POST', ticket);
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

// ==========================================
// Vérification des résultats
// ==========================================
function openResultsCheckScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('results-check-screen').style.display = 'block';
    const latest = document.getElementById('latest-results');
    latest.innerHTML = '';
    Object.keys(draws).forEach(drawId => {
        Object.keys(draws[drawId].times).forEach(time => {
            const r = resultsDatabase[drawId]?.[time];
            if (r) latest.innerHTML += `<div class="lot-result-3"><div>${draws[drawId].name} ${time}</div><div class="lot-numbers">${r.lot1 || '---'} | ${r.lot2 || '---'} | ${r.lot3 || '---'}</div></div>`;
        });
    });
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

// ==========================================
// Écrans de gestion
// ==========================================
function updateHistoryScreen() {
    const list = document.getElementById('history-list');
    if (!savedTickets.length) {
        list.innerHTML = '<p>Pa gen fich pou montre</p>';
        return;
    }
    list.innerHTML = savedTickets.map(t => `<div class="ticket-item"><strong>#${t.ticket_number}</strong> - ${t.total_amount} HTG (${new Date(t.created_at).toLocaleString()})</div>`).join('');
}

function updateWinningTicketsScreen() {
    const list = document.getElementById('winning-tickets-list');
    list.innerHTML = winningTickets.length ? winningTickets.map(w => `<div class="winning-ticket"><strong>#${w.ticket_number}</strong> - ${w.winning_amount} HTG</div>`).join('') : '<p>Pa gen fiche gagnant</p>';
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

function generateEndOfDrawReport() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('end-draw-report-screen').style.display = 'block';
    const total = savedTickets.reduce((s, t) => s + t.total_amount, 0);
    document.getElementById('report-content').innerHTML = `<h3>Rapò Fin Tiraj</h3><p>Total tickets: ${savedTickets.length}</p><p>Total montant: ${total} HTG</p>`;
}

function setupAutoFocusInputs() {
    document.querySelectorAll('input[type="text"]').forEach(i => {
        i.addEventListener('input', function() {
            if (this.value.length >= this.maxLength) {
                const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
                const idx = inputs.indexOf(this);
                if (idx < inputs.length - 1) inputs[idx + 1].focus();
            }
        });
    });
}

// ==========================================
// Rapport et commission
// ==========================================
function updateReportScreen() {
    loadReportByPeriod('15days');
}

function loadReportByPeriod(period) {
    const end = new Date();
    let start = new Date();
    switch(period) {
        case 'today': start.setHours(0,0,0,0); break;
        case '7days': start.setDate(end.getDate() - 7); break;
        case '15days': start.setDate(end.getDate() - 15); break;
        case 'month': start = new Date(end.getFullYear(), end.getMonth(), 1); break;
        default: start.setDate(end.getDate() - 15);
    }
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    document.getElementById('start-date').value = startStr;
    document.getElementById('end-date').value = endStr;
    loadReportData(start, end);
}

function loadReportCustom(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23,59,59,999);
    loadReportData(start, end);
}

function loadReportData(startDate, endDate) {
    const filteredTickets = savedTickets.filter(t => {
        const createdAt = new Date(t.created_at);
        return createdAt >= startDate && createdAt <= endDate;
    });
    const totalSales = filteredTickets.reduce((sum, t) => sum + t.total_amount, 0);
    const commissionRate = companyInfo.agentCommission;
    const commissionEarned = totalSales * (commissionRate / 100);
    const filteredWinnings = winningTickets.filter(w => {
        const createdAt = new Date(w.created_at);
        return createdAt >= startDate && createdAt <= endDate;
    });
    const totalPayouts = filteredWinnings.reduce((sum, w) => sum + (w.winning_amount || 0), 0);
    const netProfit = totalSales - totalPayouts;
    
    document.getElementById('total-sales').textContent = totalSales.toLocaleString() + ' G';
    document.getElementById('commission-rate').textContent = commissionRate + '%';
    document.getElementById('commission-earned').textContent = commissionEarned.toLocaleString() + ' G';
    document.getElementById('total-payouts').textContent = totalPayouts.toLocaleString() + ' G';
    document.getElementById('net-profit').textContent = netProfit.toLocaleString() + ' G';
    
    const detailList = document.getElementById('report-detail-list');
    const drawStats = {};
    filteredTickets.forEach(t => {
        const drawKey = `${t.draw} (${t.draw_time})`;
        if (!drawStats[drawKey]) drawStats[drawKey] = { count: 0, total: 0 };
        drawStats[drawKey].count++;
        drawStats[drawKey].total += t.total_amount;
    });
    detailList.innerHTML = Object.entries(drawStats).map(([draw, stats]) => 
        `<div class="report-detail-item"><span>${draw}</span><span>${stats.count} fich - ${stats.total} G</span></div>`
    ).join('');
    if (Object.keys(drawStats).length === 0) detailList.innerHTML = '<p>Pa gen done pou peryòd sa a</p>';
}