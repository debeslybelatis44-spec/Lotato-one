// ==========================================
// LOTATO - Interface Agent (Version Complète)
// ==========================================

// Configuration de base
const API_BASE_URL = 'https://lotatonova-fv0b.onrender.com';
const APP_CONFIG = {
    health: `${API_BASE_URL}/api/health`,
    login: `${API_BASE_URL}/api/auth/login`,
    results: `${API_BASE_URL}/api/results`,
    checkWinners: `${API_BASE_URL}/api/check-winners`,
    tickets: `${API_BASE_URL}/api/tickets`,
    ticketsPending: `${API_BASE_URL}/api/tickets/pending`,
    winningTickets: `${API_BASE_URL}/api/tickets/winning`,
    history: `${API_BASE_URL}/api/history`,
    multiDrawTickets: `${API_BASE_URL}/api/tickets/multi-draw`,
    companyInfo: `${API_BASE_URL}/api/company-info`,
    logo: `${API_BASE_URL}/api/logo`
};

// Variables globales
let resultsDatabase = {};
const draws = {
    miami: { name: "Miami (Florida)", times: { morning: "1:30 PM", evening: "9:50 PM" }, date: "Sam, 29 Nov", countdown: "18 h 30 min" },
    georgia: { name: "Georgia", times: { morning: "12:30 PM", evening: "7:00 PM" }, date: "Sam, 29 Nov", countdown: "17 h 29 min" },
    newyork: { name: "New York", times: { morning: "2:30 PM", evening: "8:00 PM" }, date: "Sam, 29 Nov", countdown: "19 h 30 min" },
    texas: { name: "Texas", times: { morning: "12:00 PM", evening: "6:00 PM" }, date: "Sam, 29 Nov", countdown: "18 h 27 min" },
    tunisia: { name: "Tunisie", times: { morning: "10:30 AM", evening: "2:00 PM" }, date: "Sam, 29 Nov", countdown: "8 h 30 min" }
};

const betTypes = {
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

let currentDraw = null;
let currentDrawTime = null;
let activeBets = [];
let ticketNumber = 1;
let savedTickets = [];
let currentAdmin = null;
let pendingSyncTickets = [];
let isOnline = navigator.onLine;
let companyLogo = "logo-borlette.jpg";
let selectedMultiDraws = new Set();
let selectedMultiGame = 'borlette';
let selectedBalls = [];
let currentMultiDrawTicket = { id: Date.now().toString(), bets: [], totalAmount: 0, draws: new Set(), createdAt: new Date().toISOString() };
let multiDrawTickets = [];
let companyInfo = { name: "Nova Lotto", phone: "+509 32 53 49 58", address: "Cap Haïtien", slogan: "Chwazi yon Jwet", agentCommission: 10, logo: "" };
let winningTickets = [];
let authToken = null;
let currentTicketToSend = null;
let recognition = null;
let isListening = false;

// ==========================================
// 1. API Helper
// ==========================================
async function apiCall(url, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        headers['x-auth-token'] = authToken;
    }
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            localStorage.removeItem('lotato_token');
            authToken = null;
            checkAuth();
            return null;
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return { success: response.ok };
        }
    } catch (error) {
        console.error('Erreur API:', error);
        return null;
    }
}

// ==========================================
// 2. Authentification
// ==========================================
function checkAuth() {
    // Recherche du token dans l'ordre : lotato_token (utilisé par index.html) puis les anciens noms
    let token = localStorage.getItem('lotato_token');
    if (!token) token = localStorage.getItem('nova_token');
    if (!token) token = localStorage.getItem('token');
    if (!token) token = localStorage.getItem('auth_token');
    
    if (!token) {
        // Aucun token : afficher l'écran de connexion intégré
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-container').style.display = 'none';
        document.getElementById('bottom-nav').style.display = 'none';
        document.getElementById('sync-status').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
        return false;
    }
    
    // Token trouvé : le stocker sous le nom unifié
    authToken = token;
    localStorage.setItem('lotato_token', token); // uniformisation
    // Afficher l'application principale
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('sync-status').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'block';
    return true;
}

async function handleLogin() {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');
    if (!username || !password) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = "Antre non itilizatè ak modpas";
        return;
    }
    try {
        const response = await fetch(APP_CONFIG.login, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success && data.token) {
            localStorage.setItem('lotato_token', data.token);
            authToken = data.token;
            showMainApp();
            errorDiv.style.display = 'none';
            loadDataFromAPI();
            loadResultsFromDatabase();
            updateCurrentTime();
            updateLogoDisplay();
            showScreen('home');
        } else {
            errorDiv.style.display = 'block';
            errorDiv.textContent = data.message || "Idantifyan ou modpas pa bon";
        }
    } catch (err) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = "Erè koneksyon, eseye ankò";
    }
}

function handleLogout() {
    localStorage.removeItem('lotato_token');
    authToken = null;
    checkAuth();
}

function showMainApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('sync-status').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'block';
    const screens = ['report-screen', 'report-stats-screen', 'results-check-screen', 'multi-tickets-screen', 'ticket-management-screen', 'winning-tickets-screen', 'history-screen', 'betting-screen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.querySelector('.container').style.display = 'block';
}

// ==========================================
// 3. Navigation (CORRIGÉE)
// ==========================================
function showScreen(screenName) {
    // Masquer tous les écrans principaux
    document.querySelector('.container').style.display = screenName === 'home' ? 'block' : 'none';
    document.getElementById('winning-tickets-screen').style.display = screenName === 'winning-tickets' ? 'block' : 'none';
    document.getElementById('history-screen').style.display = screenName === 'history' ? 'block' : 'none';
    document.getElementById('report-stats-screen').style.display = screenName === 'report-stats' ? 'block' : 'none';
    document.getElementById('betting-screen').style.display = 'none';
    document.getElementById('results-check-screen').style.display = 'none';
    document.getElementById('multi-tickets-screen').style.display = 'none';
    document.getElementById('report-screen').style.display = 'none';
    document.getElementById('ticket-management-screen').style.display = 'none';
    document.getElementById('tickets-screen').style.display = 'none';
    
    // Mettre à jour la navigation active
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-screen') === screenName) item.classList.add('active');
        else item.classList.remove('active');
    });
    
    // Charger les données si nécessaire
    if (screenName === 'winning-tickets') updateWinningTicketsScreen();
    if (screenName === 'history') updateHistoryScreen();
    if (screenName === 'report-stats') updateReportScreen();
}

// ==========================================
// 4. Utilitaires
// ==========================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    let icon = 'fas fa-info-circle';
    if (type === 'success') icon = 'fas fa-check-circle';
    if (type === 'warning') icon = 'fas fa-exclamation-triangle';
    if (type === 'error') icon = 'fas fa-times-circle';
    notification.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => notification.parentNode?.removeChild(notification), 300);
    }, 5000);
}

function updateCurrentTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const dateString = now.toLocaleDateString('fr-FR', options);
    const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = `${dateString} - ${timeString}`;
    const ticketDateEl = document.getElementById('ticket-date');
    if (ticketDateEl) ticketDateEl.textContent = `${dateString} - ${timeString}`;
}

function updateLogoDisplay() {
    const logoElements = document.querySelectorAll('#company-logo, #ticket-logo');
    logoElements.forEach(logo => {
        if(companyInfo.logo) logo.src = companyInfo.logo;
        else logo.src = companyLogo;
        logo.onerror = function() { this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YzOWMxMiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Qk9STEVUVEU8L3RleHQ+PC9zdmc+'; };
    });
    const nameEl = document.getElementById('company-name');
    const sloganEl = document.getElementById('company-slogan');
    if (nameEl && companyInfo.name) nameEl.textContent = companyInfo.name;
    if (sloganEl && companyInfo.slogan) sloganEl.textContent = companyInfo.slogan;
}

function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
}

// ==========================================
// 5. Chargement des données
// ==========================================
async function loadDataFromAPI() {
    try {
        const ticketsData = await apiCall(APP_CONFIG.tickets);
        savedTickets = ticketsData.tickets || [];
        ticketNumber = ticketsData.nextTicketNumber || 1;
        const pendingData = await apiCall(APP_CONFIG.ticketsPending);
        pendingSyncTickets = pendingData.tickets || [];
        const winningData = await apiCall(APP_CONFIG.winningTickets);
        winningTickets = winningData.tickets || [];
        const multiDrawData = await apiCall(APP_CONFIG.multiDrawTickets);
        multiDrawTickets = multiDrawData.tickets || [];
        const companyData = await apiCall(APP_CONFIG.companyInfo);
        if (companyData) companyInfo = { ...companyInfo, ...companyData };
        const logoData = await apiCall(APP_CONFIG.logo);
        if (logoData && logoData.logoUrl) companyLogo = logoData.logoUrl;
        updateCompanyDisplay();
    } catch (error) {
        console.error('Erreur chargement données:', error);
    }
}

function updateCompanyDisplay() {
    const nameEl = document.getElementById('company-name');
    const sloganEl = document.getElementById('company-slogan');
    const logoEl = document.getElementById('company-logo');
    if (nameEl && companyInfo.name) nameEl.textContent = companyInfo.name;
    if (sloganEl && companyInfo.slogan) sloganEl.textContent = companyInfo.slogan;
    if (logoEl && companyInfo.logo) logoEl.src = companyInfo.logo;
}

// ==========================================
// 6. Résultats
// ==========================================
async function loadResultsFromDatabase() {
    try {
        const resultsData = await apiCall(APP_CONFIG.results);
        if (resultsData && resultsData.results) resultsDatabase = resultsData.results;
        updateResultsDisplay();
    } catch (error) {
        console.error("Erreur chargement résultats:", error);
    }
}

async function checkForNewResults() {
    if (!isOnline) return;
    try {
        const resultsData = await apiCall(APP_CONFIG.results);
        if (resultsData && resultsData.results) {
            resultsDatabase = resultsData.results;
            updateResultsDisplay();
        }
    } catch (error) {}
}

function updateResultsDisplay() {
    const latestResults = document.getElementById('latest-results');
    if (!latestResults) return;
    latestResults.innerHTML = '';
    Object.keys(draws).forEach(drawId => {
        Object.keys(draws[drawId].times).forEach(time => {
            const result = resultsDatabase[drawId]?.[time];
            if (result) {
                const timeName = time === 'morning' ? 'Maten' : 'Swè';
                const div = document.createElement('div');
                div.className = 'lot-result';
                div.innerHTML = `<div><strong>${draws[drawId].name} ${timeName}</strong><br><small>${new Date(result.date).toLocaleString()}</small></div><div style="text-align:right;"><div class="lot-number">${result.lot1}</div><div>${result.lot2} (×20)</div><div>${result.lot3} (×10)</div></div>`;
                latestResults.appendChild(div);
            }
        });
    });
}

// ==========================================
// 7. Écran de pari
// ==========================================
function openBettingScreen(drawId, time = null) {
    currentDraw = drawId;
    currentDrawTime = time;
    const draw = draws[drawId];
    let title = draw.name;
    if (time) title += ` (${time === 'morning' ? 'Maten' : 'Swè'})`;
    document.getElementById('betting-title').textContent = title;
    const bettingScreen = document.getElementById('betting-screen');
    bettingScreen.style.display = 'block';
    bettingScreen.classList.remove('slide-out');
    bettingScreen.classList.add('slide-in');
    document.querySelector('.container').style.display = 'none';
    document.getElementById('games-interface').style.display = 'block';
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('active-bets').style.display = 'block';
    setupGameSelection();
    updateBetsList();
}

function closeBettingScreen() {
    const bettingScreen = document.getElementById('betting-screen');
    bettingScreen.classList.remove('slide-in');
    bettingScreen.classList.add('slide-out');
    setTimeout(() => {
        bettingScreen.style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    }, 300);
}

function setupGameSelection() {
    const existingItems = document.querySelectorAll('.game-item');
    existingItems.forEach(item => item.replaceWith(item.cloneNode(true)));
    document.querySelectorAll('.game-item').forEach(item => {
        item.addEventListener('click', function() {
            const gameType = this.getAttribute('data-game');
            if (gameType === 'auto-marriage' || gameType === 'auto-lotto4') showAutoGameForm(gameType);
            else showBetForm(gameType);
        });
    });
}

function showBetForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    let formHTML = '';
    switch(gameType) {
        case 'borlette':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="borlette-number" class="quick-number-input" placeholder="00" maxlength="2"><input type="number" id="borlette-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="nx-button" id="show-nx-balls">Nx</div><div class="n-balls-container">${[...Array(10)].map((_,i)=>`<div class="n-ball" data-n="${i}">N${i}</div>`).join('')}</div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'boulpe':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="boulpe-number" class="quick-number-input" placeholder="00" maxlength="2"><input type="number" id="boulpe-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="nx-button" id="show-nx-balls">Nx</div><div class="n-balls-container">${[...Array(10)].map((_,i)=>`<div class="n-ball" data-n="${i}">N${i}</div>`).join('')}</div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'lotto3':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="lotto3-number" class="quick-number-input" placeholder="000" maxlength="3"><input type="number" id="lotto3-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'marriage':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="number-inputs"><input type="text" id="marriage-number1" placeholder="00" maxlength="2"><input type="text" id="marriage-number2" placeholder="00" maxlength="2"></div><div class="quick-bet-form"><input type="number" id="marriage-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'lotto4':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="number-inputs"><input type="text" id="lotto4-number1" placeholder="00" maxlength="2"><input type="text" id="lotto4-number2" placeholder="00" maxlength="2"></div><div class="options-container"><div class="option-checkbox"><input type="checkbox" id="lotto4-option1" checked><label>Opsyon 1</label><span class="option-multiplier">×${bet.multiplier}</span></div><div class="option-checkbox"><input type="checkbox" id="lotto4-option2" checked><label>Opsyon 2</label><span class="option-multiplier">×${bet.multiplier}</span></div><div class="option-checkbox"><input type="checkbox" id="lotto4-option3" checked><label>Opsyon 3</label><span class="option-multiplier">×${bet.multiplier}</span></div></div><div class="quick-bet-form"><input type="number" id="lotto4-amount" placeholder="Kantite pa opsyon" min="1" value="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'lotto5':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="number-inputs"><input type="text" id="lotto5-number1" placeholder="000" maxlength="3"><input type="text" id="lotto5-number2" placeholder="00" maxlength="2"></div><div class="options-container"><div class="option-checkbox"><input type="checkbox" id="lotto5-option1" checked><label>Opsyon 1</label><span class="option-multiplier">×${bet.multiplier}</span></div><div class="option-checkbox"><input type="checkbox" id="lotto5-option2" checked><label>Opsyon 2</label><span class="option-multiplier">×${bet.multiplier}</span></div><div class="option-checkbox"><input type="checkbox" id="lotto5-option3" checked><label>Opsyon 3</label><span class="option-multiplier">×${bet.multiplier}</span></div></div><div class="quick-bet-form"><input type="number" id="lotto5-amount" placeholder="Kantite pa opsyon" min="1" value="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'grap':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;">${['111','222','333','444','555','666','777','888','999','000'].map(p => `<div class="pair-ball" data-pair="${p}">${p}</div>`).join('')}</div><div class="quick-bet-form"><input type="number" id="grap-amount" placeholder="Kantite" min="1" value="1"><button class="btn-primary" id="add-grap-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        default:
            formHTML = `<p>Jeu non supporté</p><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    }
    betForm.innerHTML = formHTML;
    
    const nxBtn = document.getElementById('show-nx-balls');
    if (nxBtn) nxBtn.addEventListener('click', () => document.querySelector('.n-balls-container')?.classList.toggle('show'));
    
    document.querySelectorAll('.n-ball').forEach(ball => {
        ball.addEventListener('click', () => {
            const n = ball.dataset.n;
            const amountInput = document.getElementById(`${gameType}-amount`);
            const amount = amountInput ? parseInt(amountInput.value) : 1;
            if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab obligatwa", "warning"); return; }
            const numbers = Array.from({ length: 10 }, (_, i) => String(i + parseInt(n)).padStart(2, '0'));
            activeBets.push({
                id: Date.now()+Math.random(),
                type: gameType,
                name: betTypes[gameType].name + ` N${n}`,
                number: `${n}0-${n}9`,
                amount: amount*10,
                multiplier: betTypes[gameType].multiplier,
                isGroup: true,
                details: numbers.map(num => ({ number: num, amount: amount }))
            });
            updateBetsList();
            showNotification(`10 boule N${n} ajoute!`, "success");
        });
    });
    
    document.querySelectorAll('.pair-ball').forEach(ball => {
        ball.addEventListener('click', () => {
            const pair = ball.dataset.pair;
            const amount = parseInt(document.getElementById('grap-amount').value);
            if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab obligatwa", "warning"); return; }
            activeBets.push({ id: Date.now()+Math.random(), type: 'grap', name: 'GRAP', number: pair, amount: amount, multiplier: betTypes.grap.multiplier });
            updateBetsList();
            showNotification(`Grap ${pair} ajoute!`, "success");
        });
    });
    
    const addBtn = document.getElementById('add-bet');
    if (addBtn) addBtn.addEventListener('click', () => addBet(gameType));
    const addGrapBtn = document.getElementById('add-grap-bet');
    if (addGrapBtn) addGrapBtn.addEventListener('click', () => showNotification("Klike sou yon boule grap pou ajoute", "info"));
    const returnBtn = document.getElementById('return-to-types');
    if (returnBtn) returnBtn.addEventListener('click', () => { betForm.style.display = 'none'; document.getElementById('games-interface').style.display = 'block'; });
}

function addBet(gameType) {
    const bet = betTypes[gameType];
    let number, amount;
    switch(gameType) {
        case 'lotto3':
            number = document.getElementById('lotto3-number').value;
            amount = parseInt(document.getElementById('lotto3-amount').value);
            if (!/^\d{3}$/.test(number)) { showNotification("Lotto 3 dwe gen 3 chif egzat", "warning"); return; }
            break;
        case 'marriage':
            const n1 = document.getElementById('marriage-number1').value, n2 = document.getElementById('marriage-number2').value;
            number = `${n1}*${n2}`;
            amount = parseInt(document.getElementById('marriage-amount').value);
            if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) { showNotification("Chak chif maryaj dwe gen 2 chif", "warning"); return; }
            break;
        case 'borlette':
            number = document.getElementById('borlette-number').value;
            amount = parseInt(document.getElementById('borlette-amount').value);
            if (!/^\d{2}$/.test(number)) { showNotification("Borlette dwe gen 2 chif", "warning"); return; }
            break;
        case 'boulpe':
            number = document.getElementById('boulpe-number').value;
            amount = parseInt(document.getElementById('boulpe-amount').value);
            if (!/^\d{2}$/.test(number)) { showNotification("Boul pe dwe gen 2 chif", "warning"); return; }
            if (number.length === 2 && number[0] !== number[1]) { showNotification("Pou boul pe, fòk de chif yo menm! (ex: 00, 11, 22)", "warning"); return; }
            break;
        case 'lotto4':
            const n41 = document.getElementById('lotto4-number1').value, n42 = document.getElementById('lotto4-number2').value;
            number = n41 + n42;
            const opt1 = document.getElementById('lotto4-option1')?.checked||false, opt2 = document.getElementById('lotto4-option2')?.checked||false, opt3 = document.getElementById('lotto4-option3')?.checked||false;
            const optCount = [opt1,opt2,opt3].filter(Boolean).length;
            amount = parseInt(document.getElementById('lotto4-amount').value);
            if (!/^\d{2}$/.test(n41) || !/^\d{2}$/.test(n42)) { showNotification("Chak boule Lotto 4 dwe gen 2 chif", "warning"); return; }
            if (optCount === 0) { showNotification("Chwazi omwen yon opsyon", "warning"); return; }
            const totalAmount = amount * optCount;
            activeBets.push({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number, amount: totalAmount, multiplier: bet.multiplier, options: { option1: opt1, option2: opt2, option3: opt3 }, perOptionAmount: amount, isLotto4: true });
            updateBetsList();
            showNotification("Lotto 4 ajoute avèk siksè!", "success");
            document.getElementById('bet-form').style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
            return;
        case 'lotto5':
            const n51 = document.getElementById('lotto5-number1').value, n52 = document.getElementById('lotto5-number2').value;
            number = n51 + n52;
            const o1 = document.getElementById('lotto5-option1')?.checked||false, o2 = document.getElementById('lotto5-option2')?.checked||false, o3 = document.getElementById('lotto5-option3')?.checked||false;
            const oCnt = [o1,o2,o3].filter(Boolean).length;
            amount = parseInt(document.getElementById('lotto5-amount').value);
            if (!/^\d{3}$/.test(n51) || !/^\d{2}$/.test(n52)) { showNotification("Lotto 5: Premye boule 3 chif, Dezyèm boule 2 chif", "warning"); return; }
            if (oCnt === 0) { showNotification("Chwazi omwen yon opsyon", "warning"); return; }
            const lotto5Total = amount * oCnt;
            activeBets.push({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number, amount: lotto5Total, multiplier: bet.multiplier, options: { option1: o1, option2: o2, option3: o3 }, perOptionAmount: amount, isLotto5: true });
            updateBetsList();
            showNotification("Lotto 5 ajoute avèk siksè!", "success");
            document.getElementById('bet-form').style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
            return;
        default:
            showNotification("Jeu non reconnu", "error");
            return;
    }
    if (!number || isNaN(amount) || amount <= 0) { showNotification("Tanpri rantre yon nimewo ak yon kantite valab", "warning"); return; }
    activeBets.push({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number, amount, multiplier: bet.multiplier });
    updateBetsList();
    showNotification("Parye ajoute avèk siksè!", "success");
    setTimeout(() => {
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    }, 500);
}

function updateBetsList() {
    const betsList = document.getElementById('bets-list');
    const betTotal = document.getElementById('bet-total');
    betsList.innerHTML = '';
    if (activeBets.length === 0) {
        betsList.innerHTML = '<p>Pa gen okenn parye aktif.</p>';
        betTotal.textContent = '0 goud';
        const notification = document.querySelector('.total-notification');
        if (notification) notification.remove();
        return;
    }
    const grouped = {};
    activeBets.forEach((bet, idx) => {
        let key = bet.isLotto4 || bet.isLotto5 ? `${bet.type}_${bet.number}_${JSON.stringify(bet.options)}` : `${bet.type}_${bet.number}`;
        if (!grouped[key]) grouped[key] = { bet, count:1, totalAmount: bet.amount, indexes:[idx] };
        else { grouped[key].count++; grouped[key].totalAmount += bet.amount; grouped[key].indexes.push(idx); }
    });
    let total = 0;
    for (const key in grouped) {
        const g = grouped[key];
        const bet = g.bet;
        total += g.totalAmount;
        let optionsText = '';
        if (bet.isLotto4 || bet.isLotto5) {
            const opts = [];
            if (bet.options?.option1) opts.push('O1');
            if (bet.options?.option2) opts.push('O2');
            if (bet.options?.option3) opts.push('O3');
            if (opts.length) optionsText = ` (${opts.join(',')})`;
        }
        const div = document.createElement('div');
        div.className = 'bet-item';
        div.innerHTML = `<div class="bet-details"><strong>${bet.name}</strong><br>${bet.number}${optionsText}</div><div class="bet-amount">${g.totalAmount} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        betsList.appendChild(div);
        div.querySelector('.bet-remove').addEventListener('click', function() {
            const idxs = this.dataset.indexes.split(',').map(Number).sort((a,b)=>b-a);
            idxs.forEach(i => activeBets.splice(i,1));
            updateBetsList();
        });
    }
    betTotal.textContent = `${total} goud`;
    if (total > 0) showTotalNotification(total, 'normal');
}

function showTotalNotification(totalAmount, type = 'normal') {
    const container = document.getElementById('total-notification-container');
    if (!container) return;
    const old = document.querySelector('.total-notification');
    if (old) old.remove();
    const notif = document.createElement('div');
    notif.className = 'total-notification';
    let typeText = type === 'multi-draw' ? 'Multi-Tirages' : 'Parye';
    notif.innerHTML = `<i class="fas fa-calculator"></i><span>Total ${typeText}:</span><span class="total-amount">${totalAmount} G</span>`;
    container.appendChild(notif);
    setTimeout(() => {
        if (notif.parentNode) {
            notif.style.opacity = '0';
            notif.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => notif.parentNode?.removeChild(notif), 300);
        }
    }, 5000);
}

function showAutoGameForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    selectedBalls = [];
    let formHTML = '';
    if (gameType === 'auto-marriage') {
        formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="options-container"><div style="margin-bottom:15px;"><div class="all-graps-btn" id="use-basket-balls"><i class="fas fa-shopping-basket"></i> Itilize Boul nan Panye</div><div class="all-graps-btn" id="enter-manual-balls"><i class="fas fa-keyboard"></i> Antre Boul Manyèlman</div></div><div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56 78" style="width:100%;margin-bottom:10px;"><button class="btn-primary" id="process-manual-balls">Proses</button></div><div><strong>Boules sélectionnées:</strong> <span id="selected-balls-list">Pa gen boul</span></div></div><div class="form-group"><label for="auto-game-amount">Kantite pou chak maryaj</label><input type="number" id="auto-game-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-auto-marriages">Ajoute Maryaj Otomatik</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    } else {
        formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="options-container"><div style="margin-bottom:15px;"><div class="all-graps-btn" id="use-basket-balls"><i class="fas fa-shopping-basket"></i> Itilize Boul nan Panye</div><div class="all-graps-btn" id="enter-manual-balls"><i class="fas fa-keyboard"></i> Antre Boul Manyèlman</div></div><div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56 78" style="width:100%;margin-bottom:10px;"><button class="btn-primary" id="process-manual-balls">Proses</button></div><div><strong>Boules sélectionnées:</strong> <span id="selected-balls-list">Pa gen boul</span></div><div class="option-checkbox"><input type="checkbox" id="include-reverse" checked> <label>Enkli renverse yo</label></div></div><div class="form-group"><label for="auto-game-amount">Kantite pou chak Lotto 4</label><input type="number" id="auto-game-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-auto-lotto4">Ajoute Lotto 4 Otomatik</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    }
    betForm.innerHTML = formHTML;
    
    document.getElementById('use-basket-balls').addEventListener('click', () => {
        const balls = activeBets.filter(b => (b.type === 'borlette' || b.type === 'boulpe') && !b.isGroup).map(b => b.number);
        selectedBalls = [...new Set(balls)];
        updateSelectedBallsDisplay();
        showNotification(`${selectedBalls.length} boul chaje depi panye`, "success");
    });
    document.getElementById('enter-manual-balls').addEventListener('click', () => document.getElementById('manual-balls-input').style.display = 'block');
    document.getElementById('process-manual-balls').addEventListener('click', () => {
        const input = document.getElementById('manual-balls').value.trim();
        const balls = input.split(/\s+/).filter(b => /^\d{2}$/.test(b));
        if (balls.length === 0) { showNotification("Antre boul valab (2 chif)", "warning"); return; }
        selectedBalls = [...new Set(balls)];
        updateSelectedBallsDisplay();
        document.getElementById('manual-balls-input').style.display = 'none';
        document.getElementById('manual-balls').value = '';
        showNotification(`${selectedBalls.length} boul ajoute`, "success");
    });
    document.getElementById('return-to-types').addEventListener('click', () => {
        betForm.style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    });
    
    if (gameType === 'auto-marriage') {
        document.getElementById('add-auto-marriages').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('auto-game-amount').value);
            if (selectedBalls.length < 2) { showNotification("Fò gen omwen 2 boul", "warning"); return; }
            if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab obligatwa", "warning"); return; }
            let added = 0;
            for (let i=0; i<selectedBalls.length; i++) {
                for (let j=i+1; j<selectedBalls.length; j++) {
                    activeBets.push({ id: Date.now()+Math.random(), type: 'marriage', name: 'MARYAJ OTOMATIK', number: `${selectedBalls[i]}*${selectedBalls[j]}`, amount, multiplier: betTypes.marriage.multiplier });
                    added++;
                }
            }
            updateBetsList();
            showNotification(`${added} maryaj otomatik ajoute!`, "success");
            betForm.style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
        });
    } else {
        document.getElementById('add-auto-lotto4').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('auto-game-amount').value);
            const includeReverse = document.getElementById('include-reverse').checked;
            if (selectedBalls.length < 2) { showNotification("Fò gen omwen 2 boul", "warning"); return; }
            if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab obligatwa", "warning"); return; }
            let added = 0;
            for (let i=0; i<selectedBalls.length; i++) {
                for (let j=i+1; j<selectedBalls.length; j++) {
                    const b1 = selectedBalls[i], b2 = selectedBalls[j];
                    activeBets.push({ id: Date.now()+Math.random(), type: 'lotto4', name: 'LOTO 4 OTOMATIK', number: b1+b2, amount, multiplier: betTypes.lotto4.multiplier, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
                    added++;
                    if (includeReverse) {
                        activeBets.push({ id: Date.now()+Math.random(), type: 'lotto4', name: 'LOTO 4 OTOMATIK (R)', number: b2+b1, amount, multiplier: betTypes.lotto4.multiplier, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
                        added++;
                    }
                }
            }
            updateBetsList();
            showNotification(`${added} Lotto 4 otomatik ajoute!`, "success");
            betForm.style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
        });
    }
}

function updateSelectedBallsDisplay() {
    const span = document.getElementById('selected-balls-list');
    if (span) span.textContent = selectedBalls.length ? selectedBalls.join(', ') : 'Pa gen boul';
}

// ==========================================
// 8. Sauvegarde et impression des tickets
// ==========================================
async function saveTicket() {
    if (activeBets.length === 0) { showNotification("Pa gen okenn parye pou sove", "warning"); return null; }
    const ticket = {
        id: Date.now().toString(),
        number: ticketNumber,
        date: new Date().toISOString(),
        draw: currentDraw,
        drawTime: currentDrawTime,
        bets: [...activeBets],
        total: activeBets.reduce((s,b)=>s+b.amount,0),
        agentName: currentAdmin ? currentAdmin.name : 'Agent',
        agentId: currentAdmin ? currentAdmin.id : 1
    };
    try {
        const response = await apiCall(APP_CONFIG.tickets, 'POST', ticket);
        savedTickets.push(ticket);
        ticketNumber++;
        showNotification("Fiche sove avèk siksè!", "success");
        return ticket;
    } catch (error) {
        console.error('Erreur sauvegarde ticket:', error);
        showNotification("Erreur lors de la sauvegarde du ticket", "error");
        return null;
    }
}

async function printTicketOnly() {
    if (activeBets.length === 0) { showNotification("Pa gen okenn parye pou enprime", "warning"); return; }
    const ticket = await saveTicket();
    if (!ticket) return;
    const printWindow = window.open('', '_blank');
    let betsHTML = '';
    ticket.bets.forEach(bet => {
        betsHTML += `<div style="margin-bottom:8px;padding:5px;border-bottom:1px solid #eee;"><strong>${bet.name}</strong> ${bet.number}<br>${bet.amount} G</div>`;
    });
    printWindow.document.write(`
        <html><head><title>Ticket ${companyInfo.name}</title>
        <style>body{font-family:Arial;padding:20px} @media print{@page{margin:0}} .ticket{border:2px solid #000;padding:20px;text-align:center}</style>
        </head><body><div class="ticket"><img src="${companyInfo.logo || companyLogo}" style="max-width:80px;"><h2>${companyInfo.name}</h2>
        <p>Fiche #${String(ticket.number).padStart(6,'0')}</p><p>${new Date(ticket.date).toLocaleString()}</p>
        <p>Tiraj: ${draws[ticket.draw]?.name} (${ticket.drawTime === 'morning' ? 'Maten' : 'Swè'})</p>
        <hr>${betsHTML}<hr><div style="font-weight:bold;">Total: ${ticket.total} G</div>
        <p>Merci pour votre confiance!<br>${companyInfo.phone || ''}</p></div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
    activeBets = [];
    updateBetsList();
}

async function shareTicketAfterSave() {
    if (activeBets.length === 0) { showNotification("Pa gen okenn parye pou voye", "warning"); return; }
    const ticket = await saveTicket();
    if (ticket) shareTicket(ticket);
}

// ==========================================
// 9. Envoi de ticket (WhatsApp, SMS, Bluetooth)
// ==========================================
function shareTicket(ticket) {
    currentTicketToSend = ticket;
    const modal = document.getElementById('send-ticket-modal');
    modal.style.display = 'flex';
    document.getElementById('phone-input-container').style.display = 'none';
    document.getElementById('bluetooth-info').style.display = 'none';
}

document.querySelectorAll('.send-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const method = btn.getAttribute('data-method');
        if (method === 'whatsapp' || method === 'sms') {
            document.getElementById('phone-input-container').style.display = 'block';
            document.getElementById('bluetooth-info').style.display = 'none';
            document.getElementById('confirm-send-btn').onclick = () => sendViaPhone(method);
        } else if (method === 'bluetooth') {
            document.getElementById('phone-input-container').style.display = 'none';
            document.getElementById('bluetooth-info').style.display = 'block';
            sendViaBluetooth();
        }
    });
});

document.getElementById('close-send-modal').addEventListener('click', () => {
    document.getElementById('send-ticket-modal').style.display = 'none';
});

async function sendViaPhone(method) {
    const phone = document.getElementById('send-phone-number').value.trim();
    if (!phone) {
        showNotification("Antre nimewo telefòn", "warning");
        return;
    }
    const ticketText = formatTicketForShare(currentTicketToSend);
    if (method === 'whatsapp') {
        const url = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(ticketText)}`;
        window.open(url, '_blank');
    } else if (method === 'sms') {
        window.location.href = `sms:${phone}?body=${encodeURIComponent(ticketText)}`;
    }
    document.getElementById('send-ticket-modal').style.display = 'none';
    showNotification("Ticket voye avèk siksè!", "success");
    activeBets = [];
    updateBetsList();
}

async function sendViaBluetooth() {
    showNotification("Bluetooth: rechèch aparèy...", "info");
    try {
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['00001101-0000-1000-8000-00805f9b34fb']
        });
        const pdfBlob = await generateTicketPDF(currentTicketToSend);
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('00001101-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00001101-0000-1000-8000-00805f9b34fb');
        const arrayBuffer = await pdfBlob.arrayBuffer();
        await characteristic.writeValue(arrayBuffer);
        showNotification("Ticket voye pa Bluetooth!", "success");
        activeBets = [];
        updateBetsList();
    } catch (error) {
        console.error(error);
        showNotification("Bluetooth: pa kapab konekte oswa voye", "error");
    }
    document.getElementById('send-ticket-modal').style.display = 'none';
}

function formatTicketForShare(ticket) {
    let text = `${companyInfo.name}\nFiche #${String(ticket.number).padStart(6,'0')}\nDate: ${new Date(ticket.date).toLocaleString()}\nTiraj: ${draws[ticket.draw]?.name} (${ticket.drawTime === 'morning' ? 'Maten' : 'Swè'})\n`;
    ticket.bets.forEach(bet => {
        text += `${bet.name} ${bet.number} : ${bet.amount} G\n`;
    });
    text += `Total: ${ticket.total} G\nMerci!`;
    return text;
}

async function generateTicketPDF(ticket) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(companyInfo.name, 20, 20);
    doc.setFontSize(12);
    doc.text(`Fiche #${String(ticket.number).padStart(6,'0')}`, 20, 30);
    doc.text(`Date: ${new Date(ticket.date).toLocaleString()}`, 20, 40);
    doc.text(`Tiraj: ${draws[ticket.draw]?.name} (${ticket.drawTime === 'morning' ? 'Maten' : 'Swè'})`, 20, 50);
    let y = 65;
    ticket.bets.forEach(bet => {
        doc.text(`${bet.name} ${bet.number} : ${bet.amount} G`, 20, y);
        y += 10;
        if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.text(`Total: ${ticket.total} G`, 20, y + 10);
    return doc.output('blob');
}

// ==========================================
// 10. Commandes vocales
// ==========================================
function initVoiceCommands() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showNotification("Reconnaissance vocale non supportée", "warning");
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase();
        showVoiceFeedback(`Commande: ${command}`);
        processVoiceCommand(command);
    };
    recognition.onerror = (event) => {
        console.error("Erreur vocale:", event.error);
        showVoiceFeedback("Erreur, réessayez");
        stopListening();
    };
    recognition.onend = () => { stopListening(); };
}

function startListening() {
    if (!recognition) initVoiceCommands();
    if (recognition && !isListening) {
        recognition.start();
        isListening = true;
        document.getElementById('voice-command-btn').classList.add('listening');
        showVoiceFeedback("Écoute active...");
    }
}

function stopListening() {
    if (recognition) recognition.stop();
    isListening = false;
    document.getElementById('voice-command-btn').classList.remove('listening');
    const fb = document.querySelector('.voice-feedback');
    if (fb) fb.remove();
}

function showVoiceFeedback(msg) {
    let fb = document.querySelector('.voice-feedback');
    if (!fb) {
        fb = document.createElement('div');
        fb.className = 'voice-feedback';
        document.body.appendChild(fb);
    }
    fb.textContent = msg;
    setTimeout(() => { if (fb) fb.remove(); }, 3000);
}

function processVoiceCommand(command) {
    // 1. Rapport
    if (command.includes('rapport du jour') || command.includes('rappo jodi a')) {
        loadReportByPeriod('today');
        speakText(`Total vant jodi a se ${document.getElementById('total-sales').innerText}`);
        showScreen('report-stats');
    }
    else if (command.includes('rapport semaine')) {
        loadReportByPeriod('7days');
        speakText(`Total vant semèn sa a se ${document.getElementById('total-sales').innerText}`);
        showScreen('report-stats');
    }
    else if (command.includes('rapport mois') || command.includes('rapport mwa')) {
        loadReportByPeriod('month');
        speakText(`Total vant mwa sa a se ${document.getElementById('total-sales').innerText}`);
        showScreen('report-stats');
    }
    else if (command.includes('rapport quinzaine') || command.includes('rapport 15 jou')) {
        loadReportByPeriod('15days');
        speakText(`Total vant kenz jou yo se ${document.getElementById('total-sales').innerText}`);
        showScreen('report-stats');
    }
    else if (command.includes('rapport hier')) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
        const start = new Date(yesterday.setHours(0,0,0,0));
        const end = new Date(yesterday.setHours(23,59,59,999));
        loadReportData(start, end);
        speakText(`Total vant yè se ${document.getElementById('total-sales').innerText}`);
        showScreen('report-stats');
    }
    // 2. Mariages auto / Lotto auto
    else if (command.includes('maryaj otomatik') || (command.includes('ajoute') && command.includes('maryaj'))) {
        showAutoGameForm('auto-marriage');
        speakText("Ouverture maryaj otomatik");
    }
    else if (command.includes('lotto 4 otomatik') || (command.includes('ajoute') && command.includes('lotto'))) {
        showAutoGameForm('auto-lotto4');
        speakText("Ouverture lotto 4 otomatik");
    }
    // 3. Tickets gagnants
    else if (command.includes('tickets gagnants') || command.includes('fiche genyen')) {
        checkWinningTickets();
        showScreen('winning-tickets');
        speakText(`${winningTickets.length} fiche genyen.`);
    }
    // 4. Tickets d'un tirage
    else if (command.includes('ticket tirage') || command.includes('fiche pou tiraj')) {
        let drawName = '';
        if (command.includes('miami')) drawName = 'miami';
        else if (command.includes('georgia')) drawName = 'georgia';
        else if (command.includes('new york')) drawName = 'newyork';
        else if (command.includes('texas')) drawName = 'texas';
        else if (command.includes('tunisie')) drawName = 'tunisia';
        if (drawName) {
            const tickets = savedTickets.filter(t => t.draw === drawName);
            speakText(`${tickets.length} ticket pou ${drawName}`);
            showNotification(`${tickets.length} ticket pou ${drawName}`, "info");
            showScreen('history');
        } else {
            showNotification("Tiraj pa rekonèt", "warning");
        }
    }
    // 5. Rejouer un ticket
    else if (command.includes('rejoue ticket') || command.includes('jwe ankò')) {
        const lastTicket = savedTickets[savedTickets.length-1];
        if (lastTicket) {
            activeBets = [...lastTicket.bets];
            updateBetsList();
            showNotification("Dènye fiche rejoue!", "success");
            openBettingScreen(lastTicket.draw, lastTicket.drawTime);
        } else {
            showNotification("Pa gen ticket anvan", "warning");
        }
    }
    else {
        showVoiceFeedback("Commande non reconnue");
    }
}

// ==========================================
// 11. Multi-tirages
// ==========================================
function initMultiDrawPanel() {
    const multiDrawOptions = document.getElementById('multi-draw-options');
    const multiGameSelect = document.getElementById('multi-game-select');
    multiDrawOptions.innerHTML = '';
    multiGameSelect.innerHTML = '';
    Object.keys(draws).forEach(drawId => {
        const opt = document.createElement('div');
        opt.className = 'multi-draw-option';
        opt.setAttribute('data-draw', drawId);
        opt.textContent = draws[drawId].name;
        opt.addEventListener('click', function() {
            this.classList.toggle('selected');
            const id = this.getAttribute('data-draw');
            if (this.classList.contains('selected')) selectedMultiDraws.add(id);
            else selectedMultiDraws.delete(id);
        });
        multiDrawOptions.appendChild(opt);
    });
    const games = ['borlette','boulpe','lotto3','lotto4','lotto5','grap','marriage'];
    games.forEach(game => {
        const opt = document.createElement('div');
        opt.className = 'multi-game-option' + (game === 'borlette' ? ' selected' : '');
        opt.setAttribute('data-game', game);
        opt.textContent = betTypes[game].name;
        opt.addEventListener('click', function() {
            document.querySelectorAll('.multi-game-option').forEach(o=>o.classList.remove('selected'));
            this.classList.add('selected');
            selectedMultiGame = this.getAttribute('data-game');
            updateMultiGameForm(selectedMultiGame);
        });
        multiGameSelect.appendChild(opt);
    });
    updateMultiGameForm('borlette');
}

function updateMultiGameForm(gameType) {
    const container = document.getElementById('multi-number-inputs');
    let html = '';
    switch(gameType) {
        case 'borlette': case 'boulpe': html = `<input type="text" id="multi-draw-number" placeholder="00" maxlength="2">`; break;
        case 'lotto3': case 'grap': html = `<input type="text" id="multi-draw-number" placeholder="000" maxlength="3">`; break;
        case 'marriage': case 'lotto4': html = `<div class="number-inputs"><input id="multi-draw-number1" placeholder="00"><input id="multi-draw-number2" placeholder="00"></div>`; break;
        case 'lotto5': html = `<div class="number-inputs"><input id="multi-draw-number1" placeholder="000"><input id="multi-draw-number2" placeholder="00"></div>`; break;
    }
    container.innerHTML = html;
}

function addToMultiDrawTicket() {
    const amount = parseInt(document.getElementById('multi-draw-amount').value);
    if (selectedMultiDraws.size === 0) { showNotification("Chwazi omwen yon tiraj", "warning"); return; }
    let number = '';
    switch(selectedMultiGame) {
        case 'borlette': case 'boulpe': case 'lotto3': case 'grap':
            number = document.getElementById('multi-draw-number').value;
            break;
        default:
            const n1 = document.getElementById('multi-draw-number1').value;
            const n2 = document.getElementById('multi-draw-number2').value;
            number = `${n1}*${n2}`;
            break;
    }
    if (!number || number.length===0) { showNotification("Antre yon nimewo valid", "warning"); return; }
    if (isNaN(amount) || amount<=0) { showNotification("Kantite valab obligatwa", "warning"); return; }
    const bet = { id: Date.now().toString(), gameType: selectedMultiGame, name: betTypes[selectedMultiGame].name, number, amount, multiplier: betTypes[selectedMultiGame].multiplier, draws: Array.from(selectedMultiDraws) };
    currentMultiDrawTicket.bets.push(bet);
    selectedMultiDraws.forEach(d => currentMultiDrawTicket.draws.add(d));
    currentMultiDrawTicket.totalAmount += amount * selectedMultiDraws.size;
    updateMultiDrawTicketDisplay();
    showTotalNotification(currentMultiDrawTicket.totalAmount, 'multi-draw');
    showNotification("Parye ajoute nan fiche multi-tirages!", "success");
}

function updateMultiDrawTicketDisplay() {
    const info = document.getElementById('current-multi-ticket-info');
    const summary = document.getElementById('multi-ticket-summary');
    if (currentMultiDrawTicket.bets.length === 0) { info.style.display = 'none'; return; }
    info.style.display = 'block';
    let html = `<div><strong>${currentMultiDrawTicket.bets.length} parye</strong> - ${currentMultiDrawTicket.draws.size} tiraj</div>`;
    currentMultiDrawTicket.bets.forEach(bet => {
        html += `<div class="multi-draw-bet-item"><div>${bet.name}: ${bet.number} (${bet.draws.length} tiraj)</div><div>${bet.amount * bet.draws.length} G</div></div>`;
    });
    html += `<div style="font-weight:bold;margin-top:10px;">Total: ${currentMultiDrawTicket.totalAmount} G</div>`;
    summary.innerHTML = html;
}

function viewCurrentMultiDrawTicket() {
    if (currentMultiDrawTicket.bets.length === 0) { showNotification("Fiche multi-tirages vide", "warning"); return; }
    const win = window.open('', '_blank');
    let betsHTML = '';
    currentMultiDrawTicket.bets.forEach(bet => {
        betsHTML += `<div>${bet.name} ${bet.number} (${bet.draws.length} tiraj) - ${bet.amount * bet.draws.length} G</div>`;
    });
    win.document.write(`
        <html><head><title>Multi-Tirages</title><style>body{font-family:monospace;padding:20px}</style></head>
        <body><h2>${companyInfo.name}</h2><p>Fiche Multi-Tirages</p><hr>${betsHTML}<hr><div>Total: ${currentMultiDrawTicket.totalAmount} G</div></body></html>
    `);
    win.document.close();
}

async function printMultiDrawTicket() {
    if (currentMultiDrawTicket.bets.length === 0) { showNotification("Fiche multi-tirages vide", "warning"); return; }
    const ticket = { ...currentMultiDrawTicket, number: multiDrawTickets.length+1, date: new Date().toISOString() };
    const printWindow = window.open('', '_blank');
    let betsHTML = '';
    ticket.bets.forEach(bet => {
        betsHTML += `<div>${bet.name} ${bet.number} (${bet.draws.length} tiraj) - ${bet.amount * bet.draws.length} G</div>`;
    });
    printWindow.document.write(`
        <html><head><title>Multi-Tirage</title><style>body{font-family:Arial;padding:20px}</style></head>
        <body><div><h2>${companyInfo.name}</h2><p>Fiche Multi-Tirages #${ticket.number}</p><p>${new Date(ticket.date).toLocaleString()}</p><hr>${betsHTML}<hr><div>Total: ${ticket.totalAmount} G</div></div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
}

async function shareMultiDrawTicket() {
    if (currentMultiDrawTicket.bets.length === 0) { showNotification("Fiche multi-tirages vide", "warning"); return; }
    const ticket = { ...currentMultiDrawTicket, number: multiDrawTickets.length+1, date: new Date().toISOString() };
    shareTicket(ticket);
}

function openMultiTicketsScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('multi-tickets-screen').style.display = 'block';
    updateMultiTicketsScreen();
}

function updateMultiTicketsScreen() {
    const container = document.getElementById('multi-tickets-list');
    if (multiDrawTickets.length === 0) { container.innerHTML = '<p>Pa gen fiche multi-tirages</p>'; return; }
    container.innerHTML = multiDrawTickets.map(t => `<div class="multi-ticket-item"><strong>Fiche #${t.number}</strong> - ${t.total} G<br>${new Date(t.date).toLocaleString()}</div>`).join('');
}

async function saveMultiDrawTicketAPI(ticket) {
    return await apiCall(APP_CONFIG.multiDrawTickets, 'POST', ticket);
}

// ==========================================
// 12. Vérification des résultats et tickets gagnants
// ==========================================
async function checkWinningTickets() {
    winningTickets = [];
    const allTickets = [...savedTickets, ...pendingSyncTickets];
    allTickets.forEach(ticket => {
        const result = resultsDatabase[ticket.draw]?.[ticket.drawTime];
        if (!result) return;
        let totalWinnings = 0;
        const winningBets = [];
        ticket.bets.forEach(bet => {
            const winInfo = checkBetAgainstResult(bet, result);
            if (winInfo.isWinner) { winningBets.push({ ...bet, winAmount: winInfo.winAmount, winType: winInfo.winType }); totalWinnings += winInfo.winAmount; }
        });
        if (winningBets.length > 0) winningTickets.push({ ...ticket, winningBets, totalWinnings, result });
    });
    displayWinningTickets();
    if (winningTickets.length > 0) showNotification(`${winningTickets.length} fiche gagnant detekte!`, "success");
    else showNotification("Pa gen fiche genyen pou moman sa", "info");
}

function checkBetAgainstResult(bet, result) {
    const lot1 = result.lot1, lot2 = result.lot2, lot3 = result.lot3, lot1Last2 = lot1.substring(1);
    switch(bet.type) {
        case 'borlette':
            if (bet.number === lot1Last2) return { isWinner: true, winAmount: bet.amount*60, winType: '1er lot' };
            if (bet.number === lot2) return { isWinner: true, winAmount: bet.amount*20, winType: '2e lot' };
            if (bet.number === lot3) return { isWinner: true, winAmount: bet.amount*10, winType: '3e lot' };
            break;
        case 'boulpe':
            if (bet.number === lot1Last2) return { isWinner: true, winAmount: bet.amount*60, winType: '1er lot' };
            if (bet.number === lot2) return { isWinner: true, winAmount: bet.amount*20, winType: '2e lot' };
            if (bet.number === lot3) return { isWinner: true, winAmount: bet.amount*10, winType: '3e lot' };
            break;
        case 'lotto3':
            if (bet.number === lot1) return { isWinner: true, winAmount: bet.amount*500, winType: 'Lotto 3' };
            break;
        case 'marriage':
            const [n1,n2] = bet.number.split('*');
            if ([lot1Last2,lot2,lot3].includes(n1) && [lot1Last2,lot2,lot3].includes(n2)) return { isWinner: true, winAmount: bet.amount*1000, winType: 'Maryaj' };
            break;
        case 'grap':
            if (lot1[0]===lot1[1] && lot1[1]===lot1[2] && bet.number===lot1) return { isWinner: true, winAmount: bet.amount*500, winType: 'Grap' };
            break;
        case 'lotto4':
            let win=0;
            if (bet.options?.option1 && bet.number===lot2+lot3) win += bet.perOptionAmount*5000;
            if (bet.options?.option2 && bet.number===lot1.substring(1)+lot2) win += bet.perOptionAmount*5000;
            if (bet.options?.option3) {
                let digits = bet.number.split(''), temp = [...digits], ok=true;
                for(let d of lot2.split('')) { let idx=temp.indexOf(d); if(idx===-1){ok=false;break;} temp.splice(idx,1); }
                for(let d of lot3.split('')) { let idx=temp.indexOf(d); if(idx===-1){ok=false;break;} temp.splice(idx,1); }
                if(ok) win += bet.perOptionAmount*5000;
            }
            if(win>0) return { isWinner: true, winAmount: win, winType: 'Lotto 4' };
            break;
        case 'lotto5':
            let win5=0;
            if (bet.options?.option1 && bet.number===lot1+lot2) win5 += bet.perOptionAmount*25000;
            if (bet.options?.option2 && bet.number===lot1+lot3) win5 += bet.perOptionAmount*25000;
            if (bet.options?.option3) {
                let allDigits = (lot1+lot2+lot3).split(''), betDigits = bet.number.split(''), ok=true;
                for(let d of betDigits) { let idx=allDigits.indexOf(d); if(idx===-1){ok=false;break;} allDigits.splice(idx,1); }
                if(ok) win5 += bet.perOptionAmount*25000;
            }
            if(win5>0) return { isWinner: true, winAmount: win5, winType: 'Lotto 5' };
            break;
    }
    return { isWinner: false, winAmount:0, winType:'' };
}

function displayWinningTickets() {
    const container = document.getElementById('winning-tickets-container');
    const summary = document.getElementById('winning-summary');
    if (winningTickets.length===0) { container.innerHTML='<p>Pa gen fiche gagnant</p>'; summary.innerHTML=''; return; }
    const totalWinnings = winningTickets.reduce((s,t)=>s+t.totalWinnings,0);
    summary.innerHTML = `<div class="stat-card"><div class="stat-value">${winningTickets.length}</div><div class="stat-label">Fiche Gagnant</div></div><div class="stat-card"><div class="stat-value">${totalWinnings} G</div><div class="stat-label">Total Gains</div></div>`;
    container.innerHTML = winningTickets.map(t => `<div class="winning-ticket"><strong>Fiche #${t.number}</strong> - ${t.draw} (${t.drawTime})<br>Rezilta: ${t.result.lot1} | ${t.result.lot2} | ${t.result.lot3}<br>Gains: ${t.totalWinnings} G</div>`).join('');
}

// ==========================================
// 13. Historique et gestion des tickets
// ==========================================
function updateHistoryScreen() {
    const list = document.getElementById('history-list');
    if (savedTickets.length===0) { list.innerHTML='<p>Pa gen fiche ki sove.</p>'; return; }
    const sorted = [...savedTickets].sort((a,b)=>new Date(b.date)-new Date(a.date));
    list.innerHTML = sorted.map(t => `<div class="history-item"><div class="history-header"><span class="history-draw">#${t.number} - ${draws[t.draw]?.name} (${t.drawTime==='morning'?'Maten':'Swè'})</span><span class="history-date">${new Date(t.date).toLocaleString()}</span></div><div class="history-total">Total: ${t.total} G</div></div>`).join('');
}

function updateWinningTicketsScreen() {
    const list = document.getElementById('winning-tickets-list');
    if (winningTickets.length===0) { list.innerHTML='<p>Pa gen fiche gagnant</p>'; return; }
    list.innerHTML = winningTickets.map(t => `<div class="winning-ticket"><strong>#${t.number}</strong> - ${t.totalWinnings} G</div>`).join('');
}

function searchWinningTickets() {
    const term = document.getElementById('search-winning-tickets').value.toLowerCase();
    const filtered = winningTickets.filter(t => t.number.toString().includes(term));
    const list = document.getElementById('winning-tickets-list');
    list.innerHTML = filtered.length ? filtered.map(t=>`<div class="winning-ticket"><strong>#${t.number}</strong> - ${t.totalWinnings} G</div>`).join('') : '<p>Aucun résultat</p>';
}

function searchHistory() {
    const term = document.getElementById('search-history').value.toLowerCase();
    const filtered = savedTickets.filter(t => t.number.toString().includes(term));
    const list = document.getElementById('history-list');
    list.innerHTML = filtered.length ? filtered.map(t=>`<div class="history-item"><strong>#${t.number}</strong> - ${t.total} G</div>`).join('') : '<p>Aucun résultat</p>';
}

// ==========================================
// 14. Rapports
// ==========================================
function updateReportScreen() {
    loadReportByPeriod('15days');
}

function loadReportByPeriod(period) {
    const end = new Date();
    let start = new Date();
    switch(period) {
        case 'today': start.setHours(0,0,0,0); break;
        case 'yesterday': start.setDate(end.getDate()-1); start.setHours(0,0,0,0); end.setDate(end.getDate()-1); end.setHours(23,59,59,999); break;
        case '7days': start.setDate(end.getDate()-7); break;
        case '15days': start.setDate(end.getDate()-15); break;
        case 'month': start = new Date(end.getFullYear(), end.getMonth(), 1); break;
        default: start.setDate(end.getDate()-15);
    }
    document.getElementById('start-date').value = start.toISOString().split('T')[0];
    document.getElementById('end-date').value = end.toISOString().split('T')[0];
    loadReportData(start, end);
}

function loadReportData(start, end) {
    const filtered = savedTickets.filter(t => new Date(t.date) >= start && new Date(t.date) <= end);
    const totalSales = filtered.reduce((s,t)=>s+t.total,0);
    const commissionRate = companyInfo.agentCommission || 10;
    const commissionEarned = totalSales * (commissionRate/100);
    const filteredWinnings = winningTickets.filter(w => new Date(w.date) >= start && new Date(w.date) <= end);
    const totalPayouts = filteredWinnings.reduce((s,w)=>s+(w.totalWinnings||0),0);
    const netProfit = totalSales - totalPayouts;
    document.getElementById('total-sales').innerText = totalSales + ' G';
    document.getElementById('commission-rate').innerText = commissionRate + '%';
    document.getElementById('commission-earned').innerText = commissionEarned.toFixed(2) + ' G';
    document.getElementById('total-payouts').innerText = totalPayouts + ' G';
    document.getElementById('net-profit').innerText = netProfit + ' G';
    const drawStats = {};
    filtered.forEach(t => { drawStats[t.draw] = (drawStats[t.draw]||0) + t.total; });
    const detail = document.getElementById('report-detail-list');
    detail.innerHTML = Object.entries(drawStats).map(([d,a]) => `<div class="report-detail-item"><span>${draws[d]?.name || d}</span><span>${a} G</span></div>`).join('');
    if (Object.keys(drawStats).length === 0) detail.innerHTML = '<p>Pa gen done</p>';
}

// ==========================================
// 15. Initialisation principale
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log("Document chargé, initialisation...");
    
    // Connexion
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    if (!checkAuth()) return;
    
    showMainApp();
    updateCurrentTime();
    loadDataFromAPI();
    updateLogoDisplay();
    loadResultsFromDatabase();
    initVoiceCommands();
    
    // Microphone
    document.getElementById('voice-command-btn').addEventListener('click', startListening);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            showScreen(this.getAttribute('data-screen'));
        });
    });
    document.querySelectorAll('.back-button[data-screen]').forEach(btn => {
        btn.addEventListener('click', function() {
            showScreen(this.getAttribute('data-screen'));
        });
    });
    
    // Tirages
    document.querySelectorAll('.draw-card').forEach(card => {
        card.addEventListener('click', function() {
            openBettingScreen(this.getAttribute('data-draw'), 'morning');
        });
    });
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.draw-card');
            openBettingScreen(card.getAttribute('data-draw'), this.getAttribute('data-time'));
        });
    });
    
    // Boutons généraux
    document.getElementById('back-button').addEventListener('click', closeBettingScreen);
    document.getElementById('print-ticket-btn').addEventListener('click', printTicketOnly);
    document.getElementById('share-ticket-btn').addEventListener('click', shareTicketAfterSave);
    document.getElementById('open-results-check').addEventListener('click', () => { showScreen('winning-tickets'); checkWinningTickets(); });
    document.getElementById('open-multi-tickets').addEventListener('click', openMultiTicketsScreen);
    document.getElementById('back-from-multi-tickets').addEventListener('click', () => {
        document.getElementById('multi-tickets-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    document.getElementById('back-from-report').addEventListener('click', () => {
        document.getElementById('report-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    document.getElementById('back-from-results').addEventListener('click', () => {
        document.getElementById('results-check-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    document.getElementById('check-winners-btn').addEventListener('click', checkWinningTickets);
    
    // Multi-draw
    document.getElementById('multi-draw-toggle').addEventListener('click', () => {
        document.getElementById('multi-draw-content').classList.toggle('expanded');
    });
    initMultiDrawPanel();
    document.getElementById('add-to-multi-draw').addEventListener('click', addToMultiDrawTicket);
    document.getElementById('view-current-multi-ticket').addEventListener('click', viewCurrentMultiDrawTicket);
    document.getElementById('print-multi-ticket')?.addEventListener('click', printMultiDrawTicket);
    document.getElementById('share-multi-ticket')?.addEventListener('click', shareMultiDrawTicket);
    
    // Filtres rapport
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            if(btn.dataset.period) loadReportByPeriod(btn.dataset.period);
        });
    });
    document.getElementById('apply-custom').addEventListener('click', () => {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        if(start && end) loadReportData(new Date(start), new Date(end));
    });
    
    // Gestion des fiches
    document.getElementById('search-ticket-btn')?.addEventListener('click', () => searchTicket());
    document.getElementById('show-all-tickets')?.addEventListener('click', () => showAllTickets());
    document.getElementById('show-pending-tickets')?.addEventListener('click', () => showPendingTickets());
    document.getElementById('search-history-btn')?.addEventListener('click', () => searchHistory());
    document.getElementById('search-winning-btn')?.addEventListener('click', () => searchWinningTickets());
    
    // Mises à jour périodiques
    setInterval(updateCurrentTime, 60000);
    setInterval(checkForNewResults, 300000);
    
    console.log("Initialisation terminée");
});

function searchTicket() {
    const term = document.getElementById('search-ticket-number').value.toLowerCase();
    const all = [...savedTickets, ...pendingSyncTickets];
    const filtered = all.filter(t => t.number.toString().includes(term));
    const list = document.getElementById('ticket-management-list');
    list.innerHTML = filtered.length ? filtered.map(t=>`<div class="ticket-management"><strong>#${t.number}</strong> - ${t.total} G</div>`).join('') : '<p>Aucun résultat</p>';
}

function showAllTickets() {
    const list = document.getElementById('ticket-management-list');
    const all = [...savedTickets, ...pendingSyncTickets];
    if (all.length===0) { list.innerHTML='<p>Pa gen fiche</p>'; return; }
    list.innerHTML = all.map(t => `<div class="ticket-management"><strong>#${t.number}</strong> - ${t.total} G - ${new Date(t.date).toLocaleString()}</div>`).join('');
}

function showPendingTickets() {
    const list = document.getElementById('ticket-management-list');
    if (pendingSyncTickets.length===0) { list.innerHTML='<p>Pa gen fiche an attente</p>'; return; }
    list.innerHTML = pendingSyncTickets.map(t => `<div class="ticket-management"><strong>#${t.number}</strong> - ${t.total} G</div>`).join('');
}

function updatePendingBadge() {}
function setupConnectionDetection() {}
function retryConnectionCheck() {}
function cancelPrint() {}