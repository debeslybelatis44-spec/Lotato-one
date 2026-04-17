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
let pendingSyncTickets = []; // gardé pour compatibilité mais non utilisé
let winningTickets = [];
let multiDrawTickets = [];
let resultsDatabase = {};
let companyInfo = { name: "Lotato", phone: "+509 32 53 49 58", address: "Cap Haïtien", reportTitle: "Lotato", reportPhone: "40104585", slogan: "Chwazi yon Jwet", logo: "", agentCommission: 10 };
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
    await loadLotteryConfig(); // Charger config propriétaire

    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
    initMultiDrawPanel();
    setupEventListeners();

    document.getElementById('main-container').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    // Ne plus afficher les résultats en permanence
});

async function loadLotteryConfig() {
    const res = await apiCall('/api/lottery/config');
    if (res?.success && res.config) {
        const cfg = res.config;
        if (cfg.logo) companyInfo.logo = cfg.logo;
        if (cfg.slogan) companyInfo.slogan = cfg.slogan;
        if (cfg.name) companyInfo.name = cfg.name;
        if (cfg.address) companyInfo.address = cfg.address;
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
        updateCompanyDisplay();
    }
}

async function loadResults() {
    const res = await apiCall('/api/results');
    if (res?.success) resultsDatabase = res.results;
    // Ne plus mettre à jour l'affichage permanent des résultats
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

function updateResultsDisplay() {
    // Cette fonction n'est plus utilisée pour l'affichage permanent
    // On garde le corps vide pour ne pas casser d'éventuels appels
}