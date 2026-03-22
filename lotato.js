// Configuration de base avec APP_CONFIG
const API_BASE_URL = 'https://lotato-one.onrender.com';
// Configuration API Backend
const APP_CONFIG = {
    health: `${API_BASE_URL}/api/health`,
    login: `${API_BASE_URL}/api/auth/login`,
    // Endpoints pour les résultats
    results: `${API_BASE_URL}/api/results`,
    checkWinners: `${API_BASE_URL}/api/check-winners`,
    // Endpoints pour les tickets
    tickets: `${API_BASE_URL}/api/tickets`,
    ticketsPending: `${API_BASE_URL}/api/tickets/pending`,
    winningTickets: `${API_BASE_URL}/api/tickets/winning`,
    history: `${API_BASE_URL}/api/history`,
    multiDrawTickets: `${API_BASE_URL}/api/tickets/multi-draw`,
    companyInfo: `${API_BASE_URL}/api/company-info`,
    logo: `${API_BASE_URL}/api/logo`
};

const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes en millisecondes

// Base de données simulée pour les résultats (sera remplacée par l'API)
let resultsDatabase = {
    'miami': {
        'morning': {
            date: new Date().toISOString(),
            lot1: '123', // 3 chiffres
            lot2: '45',  // 2 chiffres
            lot3: '34'   // 2 chiffres
        },
        'evening': {
            date: new Date().toISOString(),
            lot1: '892',
            lot2: '34',
            lot3: '56'
        }
    },
    'georgia': {
        'morning': {
            date: new Date().toISOString(),
            lot1: '327',
            lot2: '45',
            lot3: '89'
        },
        'evening': {
            date: new Date().toISOString(),
            lot1: '567',
            lot2: '12',
            lot3: '34'
        }
    },
    'newyork': {
        'morning': {
            date: new Date().toISOString(),
            lot1: '892',
            lot2: '34',
            lot3: '56'
        },
        'evening': {
            date: new Date().toISOString(),
            lot1: '123',
            lot2: '45',
            lot3: '67'
        }
    },
    'texas': {
        'morning': {
            date: new Date().toISOString(),
            lot1: '567',
            lot2: '89',
            lot3: '01'
        },
        'evening': {
            date: new Date().toISOString(),
            lot1: '234',
            lot2: '56',
            lot3: '78'
        }
    },
    'tunisia': {
        'morning': {
            date: new Date().toISOString(),
            lot1: '234',
            lot2: '56',
            lot3: '78'
        },
        'evening': {
            date: new Date().toISOString(),
            lot1: '345',
            lot2: '67',
            lot3: '89'
        }
    }
};

// Données des tirages
const draws = {
    miami: {
        name: "Miami (Florida)",
        times: {
            morning: "1:30 PM",
            evening: "9:50 PM"
        },
        date: "Sam, 29 Nov",
        countdown: "18 h 30 min"
    },
    georgia: {
        name: "Georgia",
        times: {
            morning: "12:30 PM",
            evening: "7:00 PM"
        },
        date: "Sam, 29 Nov",
        countdown: "17 h 29 min"
    },
    newyork: {
        name: "New York",
        times: {
            morning: "2:30 PM",
            evening: "8:00 PM"
        },
        date: "Sam, 29 Nov",
        countdown: "19 h 30 min"
    },
    texas: {
        name: "Texas",
        times: {
            morning: "12:00 PM",
            evening: "6:00 PM"
        },
        date: "Sam, 29 Nov",
        countdown: "18 h 27 min"
    },
    tunisia: {
        name: "Tunisie",
        times: {
            morning: "10:30 AM",
            evening: "2:00 PM"
        },
        date: "Sam, 29 Nov",
        countdown: "8 h 30 min"
    }
};

// Types de paris disponibles avec multiplicateurs
const betTypes = {
    lotto3: {
        name: "LOTO 3",
        multiplier: 500,
        icon: "fas fa-list-ol",
        description: "3 chif (lot 1 + 1 chif devan)",
        category: "lotto"
    },
    grap: {
        name: "GRAP",
        multiplier: 500,
        icon: "fas fa-chart-line",
        description: "Grap boule paire (111, 222, ..., 000)",
        category: "special"
    },
    marriage: {
        name: "MARYAJ",
        multiplier: 1000,
        icon: "fas fa-link",
        description: "Maryaj 2 chif (ex: 12*34)",
        category: "special"
    },
    borlette: {
        name: "BORLETTE",
        multiplier: 60, // 1er lot ×60
        multiplier2: 20, // 2e lot ×20
        multiplier3: 10, // 3e lot ×10
        icon: "fas fa-dice",
        description: "2 chif (1er lot ×60, 2e ×20, 3e ×10)",
        category: "borlette"
    },
    boulpe: {
        name: "BOUL PE",
        multiplier: 60, // 1er lot ×60
        multiplier2: 20, // 2e lot ×20
        multiplier3: 10, // 3e lot ×10
        icon: "fas fa-circle",
        description: "Boul pe (00-99)",
        category: "borlette"
    },
    lotto4: {
        name: "LOTO 4",
        multiplier: 5000,
        icon: "fas fa-list-ol",
        description: "4 chif (lot 1+2 accumulate) - 3 opsyon",
        category: "lotto"
    },
    lotto5: {
        name: "LOTO 5",
        multiplier: 25000,
        icon: "fas fa-list-ol",
        description: "5 chif (lot 1+2+3 accumulate) - 3 opsyon",
        category: "lotto"
    },
    // Types de paris automatiques
    'auto-marriage': {
        name: "MARYAJ OTOMATIK",
        multiplier: 1000,
        icon: "fas fa-robot",
        description: "Marie boules otomatik",
        category: "special"
    },
    'auto-lotto4': {
        name: "LOTO 4 OTOMATIK",
        multiplier: 5000,
        icon: "fas fa-robot",
        description: "Lotto 4 otomatik",
        category: "special"
    }
};

// Variables globales
let currentDraw = null;
let currentDrawTime = null;
let activeBets = [];
let ticketNumber = 1;
let savedTickets = [];
let currentAdmin = null;
let pendingSyncTickets = [];
let isOnline = navigator.onLine;
let companyLogo = "logo-borlette.jpg";
let currentBetCategory = null;
let restrictedBalls = [];
let gameRestrictions = {};
let selectedMultiDraws = new Set();
let selectedMultiGame = 'borlette';
let selectedBalls = []; // Stocke les boules sélectionnées pour les jeux automatiques

// Variables pour les fiches multi-tirages
let currentMultiDrawTicket = {
    id: Date.now().toString(),
    bets: [], // Liste des paris multi-tirages
    totalAmount: 0,
    draws: new Set(), // Tirages sélectionnés
    createdAt: new Date().toISOString()
};

let multiDrawTickets = []; // Liste des fiches multi-tirages sauvegardées

// Informations de l'entreprise
let companyInfo = {
    name: "Nova Lotto",
    phone: "+509 32 53 49 58",
    address: "Cap Haïtien",
    reportTitle: "Nova Lotto",
    reportPhone: "40104585"
};

// Tickets gagnants
let winningTickets = [];

// Gestion du token
let authToken = null;

// ==========================================
// 1. Fonction de communication API
// ==========================================
async function apiCall(url, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (authToken) {
        headers['x-auth-token'] = authToken;
    }

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        if (response.status === 401) {
            handleLogout();
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

// Vérifier l'authentification
function checkAuth() {
    const token = localStorage.getItem('nova_token');
    const admin = localStorage.getItem('nova_admin');
    
    if (!token || !admin) {
        window.location.href = '/index.html';
        return false;
    }
    
    authToken = token;
    try {
        currentAdmin = JSON.parse(admin);
    } catch(e) {
        console.error('Erreur parsing admin', e);
        return false;
    }
    return true;
}

function handleLogout() {
    localStorage.removeItem('nova_token');
    localStorage.removeItem('nova_admin');
    window.location.href = '/index.html';
}

// ==========================================
// 2. Sauvegarde d'un ticket (corrigée avec gestion d'erreur)
// ==========================================
async function saveTicketAPI(ticket) {
    try {
        const apiTicket = {
            subsystem_id: currentAdmin.subsystem_id,
            agent_id: currentAdmin.id,
            agent_name: currentAdmin.username,
            number: ticket.number,
            date: ticket.date,
            draw: ticket.draw,
            draw_time: ticket.drawTime,
            bets: ticket.bets.map(bet => ({
                type: bet.type,
                name: bet.name,
                number: bet.number,
                amount: bet.amount,
                multiplier: bet.multiplier,
                isGroup: bet.isGroup || false,
                details: bet.details || [],
                options: bet.options || {},
                perOptionAmount: bet.perOptionAmount || null,
                isLotto4: bet.isLotto4 || false,
                isLotto5: bet.isLotto5 || false,
                isAuto: bet.isAuto || false
            })),
            total: ticket.total,
            status: 'active',
            syncStatus: 'synced'
        };
        const response = await apiCall(APP_CONFIG.tickets, 'POST', apiTicket);
        return response;
    } catch (error) {
        console.error('Erreur saveTicketAPI:', error);
        throw error;
    }
}

async function savePendingTicketAPI(ticket) {
    if (!navigator.onLine) return null;
    
    try {
        const apiTicket = {
            subsystem_id: currentAdmin.subsystem_id,
            agent_id: currentAdmin.id,
            agent_name: currentAdmin.username,
            number: ticket.number,
            date: ticket.date,
            draw: ticket.draw,
            draw_time: ticket.drawTime,
            bets: ticket.bets.map(bet => ({
                type: bet.type,
                name: bet.name,
                number: bet.number,
                amount: bet.amount,
                multiplier: bet.multiplier,
                isGroup: bet.isGroup || false,
                details: bet.details || [],
                options: bet.options || {},
                perOptionAmount: bet.perOptionAmount || null,
                isLotto4: bet.isLotto4 || false,
                isLotto5: bet.isLotto5 || false,
                isAuto: bet.isAuto || false
            })),
            total: ticket.total,
            status: 'active',
            syncStatus: 'pending'
        };
        const response = await apiCall(APP_CONFIG.ticketsPending, 'POST', { ticket: apiTicket });
        return response;
    } catch (e) {
        console.error("Erreur savePendingTicketAPI:", e);
        return null;
    }
}

async function saveMultiDrawTicketAPI(ticket) {
    try {
        const apiTicket = {
            subsystem_id: currentAdmin.subsystem_id,
            agent_id: currentAdmin.id,
            agent_name: currentAdmin.username,
            number: ticket.number,
            date: ticket.date,
            bets: ticket.bets.map(bet => ({
                gameType: bet.gameType,
                name: bet.name,
                number: bet.number,
                amount: bet.amount,
                multiplier: bet.multiplier,
                draws: bet.draws
            })),
            draws: ticket.draws,
            total: ticket.total,
            status: 'active'
        };
        const response = await apiCall(APP_CONFIG.multiDrawTickets, 'POST', apiTicket);
        return response;
    } catch (error) {
        console.error('Erreur saveMultiDrawTicketAPI:', error);
        throw error;
    }
}

async function saveHistoryAPI(historyRecord) {
    try {
        const response = await apiCall(APP_CONFIG.history, 'POST', historyRecord);
        return response;
    } catch (error) {
        console.error('Erreur saveHistoryAPI:', error);
        throw error;
    }
}

// ==========================================
// 3. Sauvegarde locale (corrigée avec vérification de la réponse)
// ==========================================
async function saveTicket() {
    console.log("Sauvegarder fiche via API");
    if (activeBets.length === 0) {
        showNotification("Pa gen okenn parye pou sove nan fiche a", "warning");
        return;
    }

    // Vérifier que currentAdmin est bien défini
    if (!currentAdmin || !currentAdmin.id) {
        showNotification("Erreur: utilisateur non identifié", "error");
        return;
    }

    const ticket = {
        id: Date.now().toString(),
        number: ticketNumber,
        date: new Date().toISOString(),
        draw: currentDraw,
        drawTime: currentDrawTime,
        bets: [...activeBets],
        total: activeBets.reduce((sum, bet) => sum + bet.amount, 0),
        agentName: currentAdmin.name,
        agentId: currentAdmin.id
    };

    try {
        const response = await saveTicketAPI(ticket);
        console.log("Réponse API:", response);

        // Vérifier explicitement le succès
        if (response && response.success === true) {
            // Sauvegarde locale seulement si l'API a réussi
            if (response.ticket && response.ticket._id) {
                ticket._id = response.ticket._id;
            }
            savedTickets.push(ticket);
            ticketNumber++;
            showNotification("Fiche sove avèk siksè!", "success");
            activeBets = [];
            updateBetsList();
        } else {
            // L'API a retourné une erreur
            const errorMsg = response?.error || "Erreur inconnue du serveur";
            showNotification(`Erreur: ${errorMsg}`, "error");
            console.error("Erreur API:", response);
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du ticket:', error);
        showNotification("Erreur de connexion au serveur", "error");
    }
}

// ==========================================
// 4. Gestion des tickets en local (modification / suppression)
// ==========================================
window.loadTicketForEdit = function(ticketId) {
    console.log("Charger ticket pour modification:", ticketId);
    
    let ticketIndex = savedTickets.findIndex(t => t._id === ticketId);
    let ticket = ticketIndex !== -1 ? savedTickets[ticketIndex] : null;
    if (!ticket) {
        ticketIndex = savedTickets.findIndex(t => t.id === ticketId);
        ticket = ticketIndex !== -1 ? savedTickets[ticketIndex] : null;
    }
    if (!ticket) {
        showNotification("Fiche pa jwenn", "error");
        return;
    }
    
    const ticketDate = new Date(ticket.date);
    const now = new Date();
    const timeDiff = now - ticketDate;
    
    if (timeDiff > FIVE_MINUTES) {
        showNotification("Fiche sa pa ka modifye ankò. 5 minit deja pase.", "warning");
        return;
    }
    
    if (!confirm(`Èske ou vreman vle modifye fiche #${String(ticket.number).padStart(6, '0')}? Fiche sa pral efase epi parye yo pral mete nan panier aktif.`)) {
        return;
    }
    
    activeBets = [...ticket.bets];
    currentDraw = ticket.draw;
    currentDrawTime = ticket.drawTime;
    
    if (ticketIndex !== -1) savedTickets.splice(ticketIndex, 1);
    
    const pendingIndex = pendingSyncTickets.findIndex(t => t._id === ticketId || t.id === ticketId);
    if (pendingIndex !== -1) pendingSyncTickets.splice(pendingIndex, 1);
    
    updateBetsList();
    updateTicketManagementScreen();
    
    openBettingScreen(ticket.draw, ticket.drawTime);
    
    showNotification(`Fiche #${String(ticket.number).padStart(6, '0')} chaje pou modification`, "success");
};

window.deleteTicket = function(ticketId) {
    console.log("Supprimer ticket:", ticketId);
    
    let ticketIndex = savedTickets.findIndex(t => t._id === ticketId);
    let ticket = ticketIndex !== -1 ? savedTickets[ticketIndex] : null;
    if (!ticket) {
        ticketIndex = savedTickets.findIndex(t => t.id === ticketId);
        ticket = ticketIndex !== -1 ? savedTickets[ticketIndex] : null;
    }
    if (!ticket) {
        showNotification("Fiche pa jwenn", "error");
        return;
    }
    
    const ticketDate = new Date(ticket.date);
    const now = new Date();
    const timeDiff = now - ticketDate;
    
    if (timeDiff > FIVE_MINUTES) {
        showNotification("Fiche sa pa ka efase ankò. 5 minit deja pase.", "warning");
        return;
    }
    
    if (!confirm(`Èske ou vreman vle efase fiche #${String(ticket.number).padStart(6, '0')}? Aksyon sa a pa ka anile.`)) {
        return;
    }
    
    if (ticketIndex !== -1) savedTickets.splice(ticketIndex, 1);
    
    const pendingIndex = pendingSyncTickets.findIndex(t => t._id === ticketId || t.id === ticketId);
    if (pendingIndex !== -1) pendingSyncTickets.splice(pendingIndex, 1);
    
    updateTicketManagementScreen();
    
    showNotification(`Fiche #${String(ticket.number).padStart(6, '0')} efase avèk siksè`, "success");
};

// ==========================================
// 5. Chargement des données initiales
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log("Document chargé, initialisation...");
    
    if (!checkAuth()) return;
    
    document.getElementById('login-screen').style.display = 'none';
    showMainApp();
    updateCurrentTime();
    loadDataFromAPI();
    setupConnectionDetection();
    updateLogoDisplay();
    loadResultsFromDatabase();
    
    document.querySelectorAll('.draw-card').forEach(card => {
        card.addEventListener('click', function() {
            const drawId = this.getAttribute('data-draw');
            openBettingScreen(drawId, 'morning');
        });
    });
    
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.draw-card');
            const drawId = card.getAttribute('data-draw');
            const time = this.getAttribute('data-time');
            card.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            openBettingScreen(drawId, time);
        });
    });
    
    document.getElementById('back-button').addEventListener('click', closeBettingScreen);
    document.getElementById('confirm-bet-top').addEventListener('click', submitBets);
    document.getElementById('save-print-ticket').addEventListener('click', () => checkConnectionBeforeSavePrint());
    document.getElementById('save-ticket-only').addEventListener('click', () => saveTicket());
    document.getElementById('print-ticket-only').addEventListener('click', () => checkConnectionBeforePrint());
    document.getElementById('save-print-multi-ticket').addEventListener('click', () => saveAndPrintMultiDrawTicket());
    document.getElementById('view-current-multi-ticket').addEventListener('click', () => viewCurrentMultiDrawTicket());
    document.getElementById('open-multi-tickets').addEventListener('click', () => openMultiTicketsScreen());
    document.getElementById('back-from-multi-tickets').addEventListener('click', () => {
        document.getElementById('multi-tickets-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => showScreen(item.getAttribute('data-screen')));
    });
    
    document.querySelectorAll('.back-button').forEach(btn => {
        btn.addEventListener('click', () => showScreen(btn.getAttribute('data-screen') || 'home'));
    });
    
    document.getElementById('back-from-report').addEventListener('click', () => {
        document.getElementById('report-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    
    document.getElementById('back-from-results').addEventListener('click', () => {
        document.getElementById('results-check-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    
    document.getElementById('retry-connection').addEventListener('click', () => retryConnectionCheck());
    document.getElementById('cancel-print').addEventListener('click', () => cancelPrint());
    document.getElementById('generate-report-btn').addEventListener('click', () => generateEndOfDrawReport());
    document.getElementById('open-results-check').addEventListener('click', () => openResultsCheckScreen());
    document.getElementById('check-winners-btn').addEventListener('click', () => checkWinningTickets());
    document.getElementById('multi-draw-toggle').addEventListener('click', () => toggleMultiDrawPanel());
    document.getElementById('add-to-multi-draw').addEventListener('click', () => addToMultiDrawTicket());
    document.getElementById('search-ticket-btn').addEventListener('click', () => searchTicket());
    document.getElementById('show-all-tickets').addEventListener('click', () => showAllTickets());
    document.getElementById('show-pending-tickets').addEventListener('click', () => showPendingTickets());
    document.getElementById('search-history-btn').addEventListener('click', () => searchHistory());
    document.getElementById('search-winning-btn').addEventListener('click', () => searchWinningTickets());
    
    initMultiDrawPanel();
    
    setInterval(updateCurrentTime, 60000);
    setInterval(updatePendingBadge, 30000);
    setInterval(checkForNewResults, 300000);
    
    console.log("Initialisation terminée");
});

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
        if (companyData) companyInfo = companyData;
        const logoData = await apiCall(APP_CONFIG.logo);
        if (logoData && logoData.logoUrl) companyLogo = logoData.logoUrl;
        console.log('Données chargées depuis l\'API');
    } catch (error) {
        console.error('Erreur chargement données:', error);
        showNotification("Erreur de chargement des données", "error");
    }
}

function showMainApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('sync-status').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'block';
}

function updateCurrentTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const dateString = now.toLocaleDateString('fr-FR', options);
    const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('current-time').textContent = `${dateString} - ${timeString}`;
    document.getElementById('ticket-date').textContent = `${dateString} - ${timeString}`;
}

function updatePendingBadge() {
    console.log("Mise à jour badge:", pendingSyncTickets.length);
}

function setupConnectionDetection() {
    window.addEventListener('online', () => {
        isOnline = true;
        showNotification("Koneksyon entènèt retabli", "success");
        checkForNewResults();
    });
    window.addEventListener('offline', () => {
        isOnline = false;
        showNotification("Pa konekte ak entènèt", "warning");
    });
}

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
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function showTotalNotification(totalAmount, type = 'normal') {
    const container = document.getElementById('total-notification-container');
    const old = document.querySelector('.total-notification');
    if (old) old.remove();
    const notification = document.createElement('div');
    notification.className = 'total-notification';
    let typeText = type === 'multi-draw' ? 'Multi-Tirages' : 'Normal';
    notification.innerHTML = `<i class="fas fa-calculator"></i><span>Total ${typeText}:</span><span class="total-amount">${totalAmount} G</span>`;
    container.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function updateNormalBetTotalNotification() {
    const total = activeBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (total > 0) showTotalNotification(total, 'normal');
}

function updateLogoDisplay() {
    document.querySelectorAll('#company-logo, #ticket-logo').forEach(logo => {
        logo.src = companyLogo;
        logo.onerror = () => logo.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YzOWMxMiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Qk9STEVUVEU8L3RleHQ+PC9zdmc+';
    });
}

// ==========================================
// 6. Fonctions de gestion des paris
// ==========================================
function updateBetsList() {
    const betsList = document.getElementById('bets-list');
    const betTotal = document.getElementById('bet-total');
    betsList.innerHTML = '';
    if (activeBets.length === 0) {
        betsList.innerHTML = '<p>Pa gen okenn parye aktif.</p>';
        betTotal.textContent = '0 goud';
        const notif = document.querySelector('.total-notification');
        if (notif) notif.remove();
        return;
    }
    const grouped = {};
    activeBets.forEach((bet, idx) => {
        const key = bet.isLotto4 || bet.isLotto5 ? `${bet.type}_${bet.number}_${JSON.stringify(bet.options)}` : `${bet.type}_${bet.number}`;
        if (!grouped[key]) grouped[key] = { bet, count: 1, totalAmount: bet.amount, indexes: [idx] };
        else { grouped[key].count++; grouped[key].totalAmount += bet.amount; grouped[key].indexes.push(idx); }
    });
    for (const g of Object.values(grouped)) {
        const bet = g.bet;
        const div = document.createElement('div');
        div.className = 'bet-item';
        if (bet.isGroup) {
            div.innerHTML = `<div class="bet-details"><strong>${bet.name}</strong><br>${bet.number} (${bet.details.length} parye)</div><div class="bet-amount">${g.totalAmount} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        } else if (bet.isLotto4 || bet.isLotto5) {
            let opts = [];
            if (bet.options.option1) opts.push('Opsyon 1');
            if (bet.options.option2) opts.push('Opsyon 2');
            if (bet.options.option3) opts.push('Opsyon 3');
            div.innerHTML = `<div class="bet-details"><strong>${bet.name}</strong><br>${bet.number}<br><small style="color:#7f8c8d;">${opts.join(', ')}</small></div><div class="bet-amount">${g.totalAmount} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        } else {
            div.innerHTML = `<div class="bet-details"><strong>${bet.name}</strong><br>${bet.number}</div><div class="bet-amount">${g.totalAmount} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        }
        betsList.appendChild(div);
        div.querySelector('.bet-remove')?.addEventListener('click', function() {
            const indexes = this.getAttribute('data-indexes').split(',').map(Number);
            indexes.sort((a,b)=>b-a).forEach(i => activeBets.splice(i,1));
            updateBetsList();
        });
    }
    const total = activeBets.reduce((s,b)=>s+b.amount,0);
    betTotal.textContent = `${total} goud`;
    updateNormalBetTotalNotification();
}

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
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
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
    document.querySelectorAll('.game-item').forEach(item => {
        item.replaceWith(item.cloneNode(true));
    });
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
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    let formHTML = '';
    switch(gameType) {
        case 'lotto3':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="lotto3-number" placeholder="000" maxlength="3"><input type="number" id="lotto3-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'marriage':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="form-group"><label>2 Chif yo</label><div class="number-inputs"><input type="text" id="marriage-number1" placeholder="00" maxlength="2"><input type="text" id="marriage-number2" placeholder="00" maxlength="2"></div></div><div class="quick-bet-form"><input type="number" id="marriage-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'borlette':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="borlette-number" placeholder="00" maxlength="2"><input type="number" id="borlette-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div><div class="n-balls-container">${'0123456789'.split('').map(n => `<div class="n-ball" data-n="${n}">N${n}</div>`).join('')}</div>`;
            break;
        case 'boulpe':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="boulpe-number" placeholder="00" maxlength="2"><input type="number" id="boulpe-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div><div class="n-balls-container">${['00','11','22','33','44','55','66','77','88','99'].map(b => `<div class="n-ball" data-number="${b}">${b}</div>`).join('')}<div class="bo-ball" id="bo-all">BO</div></div>`;
            break;
        case 'lotto4':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="form-group"><label>4 Chif yo</label><div class="number-inputs"><input type="text" id="lotto4-number1" placeholder="00" maxlength="2"><input type="text" id="lotto4-number2" placeholder="00" maxlength="2"></div></div><div class="options-container"><div class="option-checkbox"><input type="checkbox" id="lotto4-option1" checked><label><strong>Opsyon 1:</strong> lot2 + lot3</label><span class="option-multiplier">×5000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto4-option2" checked><label><strong>Opsyon 2:</strong> 2 dènye chif lot1 + lot2</label><span class="option-multiplier">×5000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto4-option3" checked><label><strong>Opsyon 3:</strong> N'importe lòd lot2 ak lot3</label><span class="option-multiplier">×5000</span></div></div><div class="form-group"><label>Kantite pa opsyon</label><input type="number" id="lotto4-amount" min="1" value="1"><small>Total = kantite × nimewo opsyon chwazi</small></div><div class="bet-actions"><button class="btn-primary" id="add-bet">Ajoute</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'lotto5':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="form-group"><label>5 Chif yo</label><div class="number-inputs"><input type="text" id="lotto5-number1" placeholder="000" maxlength="3"><input type="text" id="lotto5-number2" placeholder="00" maxlength="2"></div></div><div class="options-container"><div class="option-checkbox"><input type="checkbox" id="lotto5-option1" checked><label><strong>Opsyon 1:</strong> lot1 + lot2</label><span class="option-multiplier">×25000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto5-option2" checked><label><strong>Opsyon 2:</strong> lot1 + lot3</label><span class="option-multiplier">×25000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto5-option3" checked><label><strong>Opsyon 3:</strong> N'importe fason 5 boul yo</label><span class="option-multiplier">×25000</span></div></div><div class="form-group"><label>Kantite pa opsyon</label><input type="number" id="lotto5-amount" min="1" value="1"><small>Total = kantite × nimewo opsyon chwazi</small></div><div class="bet-actions"><button class="btn-primary" id="add-bet">Ajoute</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'grap':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div style="margin-bottom:15px;"><div class="all-graps-btn" id="select-all-graps">Chwazi Tout Graps</div><div class="all-graps-btn" id="deselect-all-graps">Retire Tout Graps</div></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;" id="grap-selection-container">${['111','222','333','444','555','666','777','888','999','000'].map(g => `<div class="pair-ball" data-pair="${g}">${g}</div>`).join('')}</div><div class="form-group"><label>Kantite pou chak grap</label><input type="number" id="grap-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-selected-graps">Ajoute Graps Chwazi</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
    }
    betForm.innerHTML = formHTML;
    setupAutoFocusInputs();
    if (gameType === 'grap') setupGrapSelection();
    else document.getElementById('add-bet')?.addEventListener('click', () => addBet(gameType));
    document.getElementById('return-to-types')?.addEventListener('click', () => {
        betForm.style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    });
    if (gameType === 'boulpe') {
        document.querySelectorAll('.n-ball[data-number]').forEach(ball => {
            ball.addEventListener('click', () => {
                document.getElementById('boulpe-number').value = ball.getAttribute('data-number');
                document.getElementById('boulpe-amount').focus();
            });
        });
        document.getElementById('bo-all')?.addEventListener('click', () => {
            const amount = prompt("Kantite pou chak boule pe (00-99):", "1");
            if (amount && !isNaN(amount) && amount > 0) {
                const numbers = ['00','11','22','33','44','55','66','77','88','99'];
                activeBets.push({ type: gameType, name: 'BOUL PE (Tout)', number: '00-99', amount: parseInt(amount) * numbers.length, multiplier: bet.multiplier, isGroup: true, details: numbers.map(n => ({number: n, amount: parseInt(amount)})) });
                updateBetsList();
                showNotification(`${numbers.length} boule pe ajoute!`, "success");
            }
        });
    }
    if (gameType === 'borlette') {
        document.querySelectorAll('.n-ball[data-n]').forEach(ball => {
            ball.addEventListener('click', () => {
                const n = ball.getAttribute('data-n');
                const numbers = Array.from({length:10}, (_,i) => i.toString()+n);
                const amount = prompt(`Kantite pou chak boule nan N${n}:`, "1");
                if (amount && !isNaN(amount) && amount > 0) {
                    activeBets.push({ type: gameType, name: `N${n} (Tout)`, number: `0${n}-9${n}`, amount: parseInt(amount) * numbers.length, multiplier: bet.multiplier, isGroup: true, details: numbers.map(num => ({number: num, amount: parseInt(amount)})) });
                    updateBetsList();
                    showNotification(`${numbers.length} boule N${n} ajoute!`, "success");
                }
            });
        });
    }
    const firstInput = betForm.querySelector('input[type="text"]');
    if (firstInput) firstInput.focus();
    document.getElementById('active-bets').style.display = 'block';
}

function setupAutoFocusInputs() {
    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', function(e) {
            const maxLen = parseInt(this.getAttribute('maxlength'));
            if (maxLen && this.value.length >= maxLen) {
                const all = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
                const idx = all.indexOf(this);
                if (idx < all.length-1) all[idx+1].focus();
            }
        });
        input.addEventListener('keydown', function(e) {
            const all = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
            const idx = all.indexOf(this);
            if (e.key === 'ArrowRight' && idx < all.length-1) { e.preventDefault(); all[idx+1].focus(); }
            else if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); all[idx-1].focus(); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (idx < all.length-1) all[idx+1].focus();
                else document.getElementById('add-bet')?.click();
            }
        });
    });
}

function setupGrapSelection() {
    let selectedGraps = new Set();
    const grapBalls = document.querySelectorAll('#grap-selection-container .pair-ball');
    grapBalls.forEach(ball => {
        ball.addEventListener('click', () => {
            ball.classList.toggle('selected');
            const pair = ball.getAttribute('data-pair');
            if (ball.classList.contains('selected')) selectedGraps.add(pair);
            else selectedGraps.delete(pair);
        });
    });
    document.getElementById('select-all-graps')?.addEventListener('click', () => {
        grapBalls.forEach(b => { b.classList.add('selected'); selectedGraps.add(b.getAttribute('data-pair')); });
    });
    document.getElementById('deselect-all-graps')?.addEventListener('click', () => {
        grapBalls.forEach(b => { b.classList.remove('selected'); selectedGraps.delete(b.getAttribute('data-pair')); });
    });
    document.getElementById('add-selected-graps')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('grap-amount').value);
        const selected = document.querySelectorAll('#grap-selection-container .pair-ball.selected');
        if (selected.length === 0) { showNotification("Tanpri chwazi omwen yon grap", "warning"); return; }
        if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab", "warning"); return; }
        selected.forEach(ball => {
            const pair = ball.getAttribute('data-pair');
            activeBets.push({ type: 'grap', name: 'GRAP', number: pair, amount: amount, multiplier: betTypes.grap.multiplier });
            ball.classList.remove('selected');
            selectedGraps.delete(pair);
        });
        updateBetsList();
        showNotification(`${selected.length} graps ajoute!`, "success");
        document.getElementById('grap-amount').value = '1';
    });
}

function addBet(betType) {
    const bet = betTypes[betType];
    let number, amount;
    switch(betType) {
        case 'lotto3':
            number = document.getElementById('lotto3-number').value;
            amount = parseInt(document.getElementById('lotto3-amount').value);
            if (!/^\d{3}$/.test(number)) { showNotification("Lotto 3 dwe gen 3 chif", "warning"); return; }
            break;
        case 'marriage':
            const n1 = document.getElementById('marriage-number1').value;
            const n2 = document.getElementById('marriage-number2').value;
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
            if (number[0] !== number[1]) { showNotification("Pou boul pe, fòk de chif yo menm!", "warning"); return; }
            break;
        case 'lotto4':
            const n4_1 = document.getElementById('lotto4-number1').value;
            const n4_2 = document.getElementById('lotto4-number2').value;
            number = n4_1 + n4_2;
            const opt1 = document.getElementById('lotto4-option1')?.checked || false;
            const opt2 = document.getElementById('lotto4-option2')?.checked || false;
            const opt3 = document.getElementById('lotto4-option3')?.checked || false;
            amount = parseInt(document.getElementById('lotto4-amount').value);
            if (!/^\d{2}$/.test(n4_1) || !/^\d{2}$/.test(n4_2)) { showNotification("Chak boule Lotto 4 dwe gen 2 chif", "warning"); return; }
            const optsCount = [opt1,opt2,opt3].filter(Boolean).length;
            if (optsCount === 0) { showNotification("Tanpri chwazi omwen yon opsyon", "warning"); return; }
            activeBets.push({ type: betType, name: bet.name, number, amount: amount * optsCount, multiplier: bet.multiplier, options: { option1: opt1, option2: opt2, option3: opt3 }, perOptionAmount: amount, isLotto4: true });
            updateBetsList();
            showNotification("Lotto 4 ajoute!", "success");
            setTimeout(() => {
                document.getElementById('bet-form').style.display = 'none';
                document.getElementById('games-interface').style.display = 'block';
            }, 500);
            return;
        case 'lotto5':
            const n5_1 = document.getElementById('lotto5-number1').value;
            const n5_2 = document.getElementById('lotto5-number2').value;
            number = n5_1 + n5_2;
            const o1 = document.getElementById('lotto5-option1')?.checked || false;
            const o2 = document.getElementById('lotto5-option2')?.checked || false;
            const o3 = document.getElementById('lotto5-option3')?.checked || false;
            amount = parseInt(document.getElementById('lotto5-amount').value);
            if (!/^\d{3}$/.test(n5_1) || !/^\d{2}$/.test(n5_2)) { showNotification("Lotto 5: Premye boule 3 chif, Dezyèm 2 chif", "warning"); return; }
            const opts5Count = [o1,o2,o3].filter(Boolean).length;
            if (opts5Count === 0) { showNotification("Tanpri chwazi omwen yon opsyon", "warning"); return; }
            activeBets.push({ type: betType, name: bet.name, number, amount: amount * opts5Count, multiplier: bet.multiplier, options: { option1: o1, option2: o2, option3: o3 }, perOptionAmount: amount, isLotto5: true });
            updateBetsList();
            showNotification("Lotto 5 ajoute!", "success");
            setTimeout(() => {
                document.getElementById('bet-form').style.display = 'none';
                document.getElementById('games-interface').style.display = 'block';
            }, 500);
            return;
    }
    if (!number || isNaN(amount) || amount <= 0) { showNotification("Nimewo ak kantite valab", "warning"); return; }
    activeBets.push({ type: betType, name: bet.name, number, amount, multiplier: bet.multiplier });
    updateBetsList();
    showNotification("Parye ajoute!", "success");
    setTimeout(() => {
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    }, 500);
}

function showAutoGameForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    selectedBalls = [];
    let formHTML = '';
    if (gameType === 'auto-marriage') {
        formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="options-container"><div><div class="all-graps-btn" id="use-basket-balls">Itilize Boul nan Panye</div><div class="all-graps-btn" id="enter-manual-balls">Antre Boul Manyèlman</div></div><div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56 78"><button class="btn-primary" id="process-manual-balls">Proses Boul yo</button></div><div><strong>Boules disponib:</strong><div id="available-balls-list"></div></div><div><div class="all-graps-btn" id="clear-balls-btn">Retire Tout Boul</div></div><div><strong>Boules sélectionnées:</strong><div id="selected-balls-list">Pa gen boul chwazi</div></div></div><div class="form-group"><label>Kantite pou chak maryaj</label><input type="number" id="auto-game-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-auto-marriages">Ajoute Maryaj Otomatik</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    } else if (gameType === 'auto-lotto4') {
        formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="options-container"><div><div class="all-graps-btn" id="use-basket-balls">Itilize Boul nan Panye</div><div class="all-graps-btn" id="enter-manual-balls">Antre Boul Manyèlman</div></div><div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56 78"><button class="btn-primary" id="process-manual-balls">Proses Boul yo</button></div><div><strong>Boules disponib:</strong><div id="available-balls-list"></div></div><div><div class="all-graps-btn" id="clear-balls-btn">Retire Tout Boul</div></div><div><strong>Boules sélectionnées:</strong><div id="selected-balls-list">Pa gen boul chwazi</div></div><div><label><input type="checkbox" id="include-reverse" checked> Enkli renverse yo</label></div></div><div class="form-group"><label>Kantite pou chak Lotto 4</label><input type="number" id="auto-game-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-auto-lotto4">Ajoute Lotto 4 Otomatik</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    }
    betForm.innerHTML = formHTML;
    document.getElementById('use-basket-balls')?.addEventListener('click', loadBasketBalls);
    document.getElementById('enter-manual-balls')?.addEventListener('click', () => { document.getElementById('manual-balls-input').style.display = 'block'; });
    document.getElementById('process-manual-balls')?.addEventListener('click', processManualBalls);
    document.getElementById('clear-balls-btn')?.addEventListener('click', () => { selectedBalls = []; updateSelectedBallsList(); updateAvailableBallsList(); });
    if (gameType === 'auto-marriage') document.getElementById('add-auto-marriages')?.addEventListener('click', addAutoMarriages);
    else document.getElementById('add-auto-lotto4')?.addEventListener('click', addAutoLotto4);
    document.getElementById('return-to-types')?.addEventListener('click', () => {
        betForm.style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    });
    document.getElementById('active-bets').style.display = 'block';
}

function loadBasketBalls() {
    const basket = [];
    activeBets.forEach(bet => {
        if (bet.type === 'borlette' || bet.type === 'boulpe') {
            if (bet.isGroup) bet.details.forEach(d => { if (/^\d{2}$/.test(d.number)) basket.push(d.number); });
            else if (/^\d{2}$/.test(bet.number)) basket.push(bet.number);
        }
    });
    selectedBalls = [...new Set(basket)];
    if (selectedBalls.length === 0) showNotification("Pa gen boul borlette nan panye a", "warning");
    else { updateSelectedBallsList(); updateAvailableBallsList(); showNotification(`${selectedBalls.length} boul chaje`, "success"); }
}

function processManualBalls() {
    const input = document.getElementById('manual-balls').value.trim();
    if (!input) { showNotification("Antre kèk boul", "warning"); return; }
    const balls = input.split(/\s+/);
    const valid = [], invalid = [];
    balls.forEach(b => { if (/^\d{2}$/.test(b)) valid.push(b); else invalid.push(b); });
    if (valid.length === 0) { showNotification("Pa gen boul valab. Boul yo dwe gen 2 chif.", "warning"); return; }
    selectedBalls = [...new Set(valid)];
    updateSelectedBallsList(); updateAvailableBallsList();
    let msg = `${selectedBalls.length} boul valab ajoute`;
    if (invalid.length) msg += `. ${invalid.length} boul envalid: ${invalid.join(', ')}`;
    showNotification(msg, "success");
    document.getElementById('manual-balls-input').style.display = 'none';
    document.getElementById('manual-balls').value = '';
}

function updateAvailableBallsList() {
    const container = document.getElementById('available-balls-list');
    if (!container) return;
    if (selectedBalls.length === 0) { container.innerHTML = '<p>Pa gen boul disponib.</p>'; return; }
    container.innerHTML = '';
    selectedBalls.forEach((ball, i) => {
        const tag = document.createElement('div');
        tag.className = 'ball-tag';
        tag.innerHTML = `${ball}<span class="remove-ball" onclick="removeBall(${i})"><i class="fas fa-times"></i></span>`;
        container.appendChild(tag);
    });
}

window.removeBall = function(i) { selectedBalls.splice(i,1); updateSelectedBallsList(); updateAvailableBallsList(); };
function updateSelectedBallsList() {
    const container = document.getElementById('selected-balls-list');
    if (!container) return;
    if (selectedBalls.length === 0) container.innerHTML = "Pa gen boul chwazi";
    else container.innerHTML = selectedBalls.join(', ');
}

function addAutoMarriages() {
    const amount = parseInt(document.getElementById('auto-game-amount').value);
    if (selectedBalls.length < 2) { showNotification("Fò gen omwen 2 boul", "warning"); return; }
    if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab", "warning"); return; }
    let added = 0;
    for (let i=0; i<selectedBalls.length; i++) {
        for (let j=i+1; j<selectedBalls.length; j++) {
            activeBets.push({ type: 'marriage', name: 'MARYAJ OTOMATIK', number: `${selectedBalls[i]}*${selectedBalls[j]}`, amount, multiplier: betTypes.marriage.multiplier, isAuto: true });
            added++;
        }
    }
    updateBetsList();
    showNotification(`${added} maryaj otomatik ajoute!`, "success");
    setTimeout(() => {
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
        selectedBalls = [];
    }, 500);
}

function addAutoLotto4() {
    const amount = parseInt(document.getElementById('auto-game-amount').value);
    const includeReverse = document.getElementById('include-reverse')?.checked || false;
    if (selectedBalls.length < 2) { showNotification("Fò gen omwen 2 boul", "warning"); return; }
    if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab", "warning"); return; }
    let added = 0;
    for (let i=0; i<selectedBalls.length; i++) {
        for (let j=i+1; j<selectedBalls.length; j++) {
            const ball1 = selectedBalls[i], ball2 = selectedBalls[j];
            activeBets.push({ type: 'lotto4', name: 'LOTO 4 OTOMATIK', number: ball1+ball2, amount, multiplier: betTypes.lotto4.multiplier, isAuto: true, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
            added++;
            if (includeReverse) {
                activeBets.push({ type: 'lotto4', name: 'LOTO 4 OTOMATIK (RENVÈSE)', number: ball2+ball1, amount, multiplier: betTypes.lotto4.multiplier, isAuto: true, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
                added++;
            }
        }
    }
    updateBetsList();
    showNotification(`${added} Lotto 4 otomatik ajoute!`, "success");
    setTimeout(() => {
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
        selectedBalls = [];
    }, 500);
}

function submitBets() {
    if (activeBets.length === 0) { showNotification("Pa gen okenn parye pou soumèt", "warning"); return; }
    let drawInfo = draws[currentDraw].name;
    if (currentDrawTime) drawInfo += ` (${currentDrawTime === 'morning' ? 'Maten' : 'Swè'})`;
    showNotification(`${activeBets.length} parye soumèt pou ${drawInfo}!`, "success");
    saveBetsToHistory();
    activeBets = [];
    updateBetsList();
    closeBettingScreen();
}

async function saveBetsToHistory() {
    try {
        const record = { id: Date.now(), date: new Date().toLocaleString(), draw: currentDraw, drawTime: currentDrawTime, bets: [...activeBets], total: activeBets.reduce((s,b)=>s+b.amount,0) };
        await saveHistoryAPI(record);
    } catch(e) { console.error(e); showNotification("Erreur sauvegarde historique", "error"); }
}

// ==========================================
// 7. Résultats et vérification des gains
// ==========================================
async function loadResultsFromDatabase() {
    try {
        const data = await apiCall(APP_CONFIG.results);
        if (data && data.results) resultsDatabase = data.results;
        updateResultsDisplay();
    } catch(e) { console.error(e); showNotification("Erreur chargement résultats", "error"); }
}

async function checkForNewResults() {
    if (!isOnline) return;
    try {
        const data = await apiCall(APP_CONFIG.results);
        if (data && data.results) { resultsDatabase = data.results; updateResultsDisplay(); }
    } catch(e) { console.error(e); }
}

function updateResultsDisplay() {
    const grid = document.querySelector('.results-grid');
    if (grid) {
        grid.innerHTML = '';
        Object.keys(draws).forEach(drawId => {
            const result = resultsDatabase[drawId]?.morning || { lot1: '---' };
            grid.innerHTML += `<div class="result-card"><h4>${draws[drawId].name}</h4><div class="result-number">${result.lot1}</div></div>`;
        });
    }
    const latest = document.getElementById('latest-results');
    if (latest) {
        latest.innerHTML = '';
        Object.keys(draws).forEach(drawId => {
            Object.keys(draws[drawId].times).forEach(time => {
                const res = resultsDatabase[drawId]?.[time];
                if (res) {
                    latest.innerHTML += `<div class="lot-result"><div><strong>${draws[drawId].name} ${time==='morning'?'Maten':'Swè'}</strong><br><small>${new Date(res.date).toLocaleString()}</small></div><div style="text-align:right;"><div class="lot-number">${res.lot1}</div><div>${res.lot2} (×20)</div><div>${res.lot3} (×10)</div></div></div>`;
                }
            });
        });
    }
}

function openResultsCheckScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('results-check-screen').style.display = 'block';
    updateResultsDisplay();
    document.getElementById('winning-tickets-container').innerHTML = '';
    document.getElementById('winning-summary').innerHTML = '';
}

function checkWinningTickets() {
    winningTickets = [];
    const allTickets = [...savedTickets, ...pendingSyncTickets];
    allTickets.forEach(ticket => {
        const result = resultsDatabase[ticket.draw]?.[ticket.drawTime];
        if (!result) return;
        const winningBets = [];
        let totalWinnings = 0;
        ticket.bets.forEach(bet => {
            const winInfo = checkBetAgainstResult(bet, result);
            if (winInfo.isWinner) {
                winningBets.push({ ...bet, winAmount: winInfo.winAmount, winType: winInfo.winType, matchedNumber: winInfo.matchedNumber });
                totalWinnings += winInfo.winAmount;
            }
        });
        if (winningBets.length > 0) winningTickets.push({ ...ticket, winningBets, totalWinnings, result });
    });
    displayWinningTickets();
    if (winningTickets.length) showNotification(`${winningTickets.length} fiche gagnant detekte!`, "success");
    else showNotification("Pa gen fiche genyen pou moman sa", "info");
}

function checkBetAgainstResult(bet, result) {
    const lot1 = result.lot1, lot2 = result.lot2, lot3 = result.lot3;
    const lot1Last2 = lot1.substring(1);
    let isWinner = false, winAmount = 0, winType = '', matchedNumber = '';
    switch(bet.type) {
        case 'borlette':
        case 'boulpe':
            if (bet.number === lot1Last2) { isWinner = true; winAmount = bet.amount * 60; winType = '1er lot'; matchedNumber = lot1Last2; }
            else if (bet.number === lot2) { isWinner = true; winAmount = bet.amount * 20; winType = '2e lot'; matchedNumber = lot2; }
            else if (bet.number === lot3) { isWinner = true; winAmount = bet.amount * 10; winType = '3e lot'; matchedNumber = lot3; }
            break;
        case 'lotto3':
            if (bet.number === lot1) { isWinner = true; winAmount = bet.amount * 500; winType = 'Lotto 3'; matchedNumber = lot1; }
            break;
        case 'lotto4':
            if (bet.options?.option1 && (lot2+lot3) === bet.number) { isWinner = true; winAmount += bet.perOptionAmount * 5000; winType += 'Opsyon 1,'; matchedNumber = lot2+lot3; }
            if (bet.options?.option2 && (lot1Last2+lot2) === bet.number) { isWinner = true; winAmount += bet.perOptionAmount * 5000; winType += 'Opsyon 2,'; matchedNumber = lot1Last2+lot2; }
            if (bet.options?.option3) {
                const digits = bet.number.split('');
                let tmp = [...digits];
                let ok2 = true, ok3 = true;
                for (let d of lot2.split('')) { let idx = tmp.indexOf(d); if (idx===-1) { ok2=false; break; } tmp.splice(idx,1); }
                for (let d of lot3.split('')) { let idx = tmp.indexOf(d); if (idx===-1) { ok3=false; break; } tmp.splice(idx,1); }
                if (ok2 && ok3) { isWinner = true; winAmount += bet.perOptionAmount * 5000; winType += 'Opsyon 3,'; matchedNumber = bet.number; }
            }
            break;
        case 'lotto5':
            if (bet.options?.option1 && (lot1+lot2) === bet.number) { isWinner = true; winAmount += bet.perOptionAmount * 25000; winType += 'Opsyon 1,'; matchedNumber = lot1+lot2; }
            if (bet.options?.option2 && (lot1+lot3) === bet.number) { isWinner = true; winAmount += bet.perOptionAmount * 25000; winType += 'Opsyon 2,'; matchedNumber = lot1+lot3; }
            if (bet.options?.option3) {
                const allDigits = (lot1+lot2+lot3).split('');
                let found = true;
                for (let d of bet.number.split('')) { let idx = allDigits.indexOf(d); if (idx===-1) { found=false; break; } allDigits.splice(idx,1); }
                if (found) { isWinner = true; winAmount += bet.perOptionAmount * 25000; winType += 'Opsyon 3,'; matchedNumber = bet.number; }
            }
            break;
        case 'marriage':
        case 'auto-marriage':
            const [num1,num2] = bet.number.split('*');
            if ([lot1Last2, lot2, lot3].includes(num1) && [lot1Last2, lot2, lot3].includes(num2)) { isWinner = true; winAmount = bet.amount * 1000; winType = 'Maryaj'; matchedNumber = `${num1}*${num2}`; }
            break;
        case 'grap':
            if (lot1[0]===lot1[1] && lot1[1]===lot1[2] && bet.number === lot1) { isWinner = true; winAmount = bet.amount * 500; winType = 'Grap'; matchedNumber = lot1; }
            break;
        case 'auto-lotto4':
            const tmp = bet.number.split('');
            let okL2 = true, okL3 = true;
            let t = [...tmp];
            for (let d of lot2.split('')) { let idx = t.indexOf(d); if (idx===-1) { okL2=false; break; } t.splice(idx,1); }
            for (let d of lot3.split('')) { let idx = t.indexOf(d); if (idx===-1) { okL3=false; break; } t.splice(idx,1); }
            if (okL2 && okL3) { isWinner = true; winAmount = bet.amount * 5000; winType = 'Lotto 4 Auto'; matchedNumber = bet.number; }
            break;
    }
    return { isWinner, winAmount, winType, matchedNumber };
}

function displayWinningTickets() {
    const container = document.getElementById('winning-tickets-container');
    const summary = document.getElementById('winning-summary');
    container.innerHTML = '';
    if (winningTickets.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fas fa-info-circle"></i><p>Pa gen fiche gagnant pou moman sa.</p></div>';
        summary.innerHTML = '';
        return;
    }
    const totalWinnings = winningTickets.reduce((s,t)=>s+t.totalWinnings,0);
    summary.innerHTML = `<div class="stat-card"><div class="stat-value">${winningTickets.length}</div><div class="stat-label">Fiche Gagnant</div></div><div class="stat-card"><div class="stat-value">${totalWinnings} G</div><div class="stat-label">Total Gains</div></div>`;
    winningTickets.forEach(t => {
        const div = document.createElement('div'); div.className = 'winning-ticket';
        let betsHTML = '';
        t.winningBets.forEach(wb => { betsHTML += `<div class="bet-item"><div class="bet-details"><strong>${wb.name}</strong><br>${wb.number} → ${wb.matchedNumber||wb.number} (${wb.winType})</div><div class="bet-amount"><span class="winning-amount">+${wb.winAmount} G</span></div></div>`; });
        div.innerHTML = `<div><strong>Fiche #${String(t.number).padStart(6,'0')}</strong><div>${draws[t.draw].name} (${t.drawTime==='morning'?'Maten':'Swè'})</div></div><div>Rezilta: ${t.result.lot1} | ${t.result.lot2} | ${t.result.lot3}</div>${betsHTML}<div class="bet-total"><span>Total Gains:</span><span class="winning-amount">${t.totalWinnings} G</span></div>`;
        container.appendChild(div);
    });
}

// ==========================================
// 8. Multi-tirages
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
            if (this.classList.contains('selected')) selectedMultiDraws.add(drawId);
            else selectedMultiDraws.delete(drawId);
        });
        multiDrawOptions.appendChild(opt);
    });
    const games = ['borlette','boulpe','lotto3','lotto4','lotto5','grap','marriage'];
    games.forEach(g => {
        const opt = document.createElement('div');
        opt.className = 'multi-game-option';
        if (g === 'borlette') opt.classList.add('selected');
        opt.setAttribute('data-game', g);
        opt.textContent = betTypes[g].name;
        opt.addEventListener('click', function() {
            document.querySelectorAll('.multi-game-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            selectedMultiGame = this.getAttribute('data-game');
            updateMultiGameForm(selectedMultiGame);
        });
        multiGameSelect.appendChild(opt);
    });
    updateMultiGameForm('borlette');
}

function updateMultiGameForm(gameType) {
    const numberInputs = document.getElementById('multi-number-inputs');
    let html = '';
    switch(gameType) {
        case 'borlette': case 'boulpe': html = `<label>Nimewo 2 chif</label><input type="text" id="multi-draw-number" placeholder="00" maxlength="2">`; break;
        case 'lotto3': case 'grap': html = `<label>Nimewo 3 chif</label><input type="text" id="multi-draw-number" placeholder="000" maxlength="3">`; break;
        case 'marriage': html = `<label>2 Nimewo pou maryaj</label><div class="number-inputs"><input type="text" id="multi-draw-number1" placeholder="00" maxlength="2"><input type="text" id="multi-draw-number2" placeholder="00" maxlength="2"></div>`; break;
        case 'lotto4': html = `<label>4 Chif (lot 1+2 accumulate)</label><div class="number-inputs"><input type="text" id="multi-draw-number1" placeholder="00" maxlength="2"><input type="text" id="multi-draw-number2" placeholder="00" maxlength="2"></div>`; break;
        case 'lotto5': html = `<label>5 Chif (lot 1+2+3 accumulate)</label><div class="number-inputs"><input type="text" id="multi-draw-number1" placeholder="000" maxlength="3"><input type="text" id="multi-draw-number2" placeholder="00" maxlength="2"></div>`; break;
    }
    numberInputs.innerHTML = html;
    setupAutoFocusInputs();
}

function toggleMultiDrawPanel() {
    const content = document.getElementById('multi-draw-content');
    const toggle = document.getElementById('multi-draw-toggle');
    content.classList.toggle('expanded');
    toggle.innerHTML = content.classList.contains('expanded') ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
}

function addToMultiDrawTicket() {
    const amount = parseInt(document.getElementById('multi-draw-amount').value);
    let number = '';
    switch(selectedMultiGame) {
        case 'borlette': case 'boulpe': number = document.getElementById('multi-draw-number').value; break;
        case 'marriage': case 'lotto4': case 'lotto5': {
            const n1 = document.getElementById('multi-draw-number1').value;
            const n2 = document.getElementById('multi-draw-number2').value;
            number = selectedMultiGame==='lotto5' ? n1+n2 : (selectedMultiGame==='marriage'?`${n1}*${n2}`:n1+n2);
            break;
        }
        default: number = document.getElementById('multi-draw-number').value;
    }
    let isValid = true, error = '';
    if (selectedMultiGame==='borlette'||selectedMultiGame==='boulpe') if (!/^\d{2}$/.test(number)) { isValid=false; error="2 chif"; }
    if (selectedMultiGame==='lotto3'||selectedMultiGame==='grap') if (!/^\d{3}$/.test(number)) { isValid=false; error="3 chif"; }
    if (selectedMultiGame==='marriage') {
        const [a,b] = number.split('*');
        if (!/^\d{2}$/.test(a)||!/^\d{2}$/.test(b)) { isValid=false; error="Chak maryaj 2 chif"; }
    }
    if (selectedMultiGame==='lotto4') if (!/^\d{4}$/.test(number)) { isValid=false; error="4 chif"; }
    if (selectedMultiGame==='lotto5') if (!/^\d{5}$/.test(number)) { isValid=false; error="5 chif"; }
    if (isNaN(amount)||amount<=0) { isValid=false; error="Kantite valab"; }
    if (selectedMultiDraws.size===0) { isValid=false; error="Chwazi omwen yon tiraj"; }
    if (!isValid) { showNotification(error, "warning"); return; }
    const multiBet = { id: Date.now().toString(), gameType: selectedMultiGame, name: betTypes[selectedMultiGame].name, number, amount, multiplier: betTypes[selectedMultiGame].multiplier, draws: Array.from(selectedMultiDraws) };
    currentMultiDrawTicket.bets.push(multiBet);
    selectedMultiDraws.forEach(d => currentMultiDrawTicket.draws.add(d));
    currentMultiDrawTicket.totalAmount += amount * selectedMultiDraws.size;
    updateMultiDrawTicketDisplay();
    showTotalNotification(currentMultiDrawTicket.totalAmount, 'multi-draw');
    document.getElementById('multi-draw-amount').value = '1';
    showNotification(`Parye ajoute nan fiche multi-tirages!`, "success");
}

function updateMultiDrawTicketDisplay() {
    const info = document.getElementById('current-multi-ticket-info');
    const summary = document.getElementById('multi-ticket-summary');
    if (currentMultiDrawTicket.bets.length===0) { info.style.display='none'; return; }
    info.style.display='block';
    let html = `<div><strong>${currentMultiDrawTicket.bets.length} parye</strong><div>${currentMultiDrawTicket.draws.size} tiraj</div></div><div style="max-height:150px;overflow-y:auto;">`;
    currentMultiDrawTicket.bets.forEach(b => {
        html += `<div class="multi-draw-bet-item"><div><strong>${b.name}</strong><br><small>${b.number} (${b.draws.length} tiraj)</small></div><div>${b.amount * b.draws.length} G <span style="color:var(--accent-color);cursor:pointer;margin-left:5px;" onclick="removeFromMultiDrawTicket('${b.id}')"><i class="fas fa-times"></i></span></div></div>`;
    });
    html += `</div><div style="font-weight:bold;border-top:1px solid #ddd;padding-top:10px;">Total: ${currentMultiDrawTicket.totalAmount} G</div>`;
    summary.innerHTML = html;
}

window.removeFromMultiDrawTicket = function(betId) {
    const idx = currentMultiDrawTicket.bets.findIndex(b => b.id === betId);
    if (idx!==-1) {
        const bet = currentMultiDrawTicket.bets[idx];
        currentMultiDrawTicket.totalAmount -= bet.amount * bet.draws.length;
        currentMultiDrawTicket.bets.splice(idx,1);
        const used = new Set();
        currentMultiDrawTicket.bets.forEach(b => b.draws.forEach(d=>used.add(d)));
        currentMultiDrawTicket.draws = used;
        updateMultiDrawTicketDisplay();
        showTotalNotification(currentMultiDrawTicket.totalAmount, 'multi-draw');
        showNotification("Parye retire nan fiche multi-tirages", "info");
    }
};

async function saveAndPrintMultiDrawTicket() {
    if (currentMultiDrawTicket.bets.length===0) { showNotification("Fiche multi-tirages la vid", "warning"); return; }
    const ticketNum = multiDrawTickets.length+1;
    const ticket = { id: currentMultiDrawTicket.id, number: ticketNum, date: new Date().toISOString(), bets: [...currentMultiDrawTicket.bets], total: currentMultiDrawTicket.totalAmount, draws: Array.from(currentMultiDrawTicket.draws), agentName: currentAdmin?.name || 'Agent', agentId: currentAdmin?.id || 1 };
    try {
        await saveMultiDrawTicketAPI(ticket);
        printMultiDrawTicket(ticket);
        currentMultiDrawTicket = { id: Date.now().toString(), bets: [], totalAmount: 0, draws: new Set(), createdAt: new Date().toISOString() };
        updateMultiDrawTicketDisplay();
        await loadMultiDrawTickets();
        showNotification("Fiche multi-tirages anrejistre ak enprime!", "success");
    } catch(e) { showNotification("Erreur sauvegarde fiche multi-tirages", "error"); }
}

function printMultiDrawTicket(ticket) {
    const printContent = document.createElement('div');
    printContent.className = 'print-ticket';
    let betsHTML = '', total = 0;
    ticket.bets.forEach(bet => {
        const betTotal = bet.amount * bet.draws.length;
        total += betTotal;
        betsHTML += `<div style="margin-bottom:15px;padding:10px;background:#f8f9fa;"><div><strong>${bet.name}</strong></div><div>Nimewo: ${bet.number}</div><div>Tirages: ${bet.draws.map(d=>draws[d]?.name).join(', ')}</div><div>${bet.amount} G × ${bet.draws.length} = ${betTotal} G</div></div>`;
    });
    printContent.innerHTML = `<div style="text-align:center;padding:20px;border:2px solid #000;"><div><img src="${companyLogo}" class="ticket-logo" style="max-width:80px;"></div><h2>${companyInfo.name}</h2><p>Fiche Multi-Tirages</p><p>Nimewo: #${String(ticket.number).padStart(6,'0')} (Multi)</p><p>Dat: ${new Date(ticket.date).toLocaleString('fr-FR')}</p><p>Ajan: ${ticket.agentName}</p><hr>${betsHTML}<hr><div style="display:flex;justify-content:space-between;margin-top:15px;font-weight:bold;"><span>Total:</span><span>${total} G</span></div><p>Mèsi pou konfyans ou!</p></div>`;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Fiche Multi-Tirages</title><style>@media print{body{margin:0;padding:0;} @page{margin:0;}}</style></head><body>${printContent.innerHTML}</body></html>`);
    w.document.close();
    w.print();
}

function viewCurrentMultiDrawTicket() {
    if (currentMultiDrawTicket.bets.length===0) { showNotification("Fiche multi-tirages la vid", "warning"); return; }
    const ticket = { number: 'Aktyèl', date: new Date(currentMultiDrawTicket.createdAt).toLocaleString('fr-FR'), bets: [...currentMultiDrawTicket.bets], total: currentMultiDrawTicket.totalAmount, draws: Array.from(currentMultiDrawTicket.draws) };
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Preview Fiche Multi-Tirages</title><style>body{font-family:Arial;padding:20px;}.ticket{border:2px solid #000;padding:20px;max-width:500px;margin:0 auto;}</style></head><body><div class="ticket"><h2>${companyInfo.name}</h2><h3>Fiche Multi-Tirages (Preview)</h3><p>Nimewo: #${ticket.number}</p><p>Dat: ${ticket.date}</p><div>${ticket.bets.map(b => `<div class="bet-item"><div><strong>${b.name}</strong></div><div>${b.number}</div><div>Tirages: ${b.draws.map(d=>draws[d]?.name).join(', ')}</div><div>${b.amount} G × ${b.draws.length} = ${b.amount * b.draws.length} G</div></div>`).join('')}</div><hr><h2>Total: ${ticket.total} G</h2></div></body></html>`);
    w.document.close();
}

function openMultiTicketsScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('multi-tickets-screen').style.display = 'block';
    updateMultiTicketsScreen();
}

async function updateMultiTicketsScreen() {
    const list = document.getElementById('multi-tickets-list');
    list.innerHTML = '';
    if (multiDrawTickets.length===0) { list.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-ticket-alt"></i><p>Pa gen fiche multi-tirages ki sove.</p></div>'; return; }
    const sorted = [...multiDrawTickets].sort((a,b)=>new Date(b.date)-new Date(a.date));
    sorted.forEach(t => {
        const div = document.createElement('div'); div.className = 'multi-ticket-item';
        const drawNames = t.draws.map(d=>draws[d]?.name).join(', ');
        let betsHTML = '';
        t.bets.forEach(b => { betsHTML += `<div><strong>${b.name}</strong>: ${b.number} (${b.draws.length} tiraj - ${b.amount*b.draws.length} G)</div>`; });
        div.innerHTML = `<div><strong>Fiche #${String(t.number).padStart(6,'0')} (Multi)</strong><span>${new Date(t.date).toLocaleDateString()}</span></div><div>${drawNames}</div><div>${betsHTML}</div><div>Total: ${t.total} G</div><div><button class="ticket-action-btn print-ticket-btn" onclick="printMultiDrawTicketFromList('${t.id}')">Enprime</button></div>`;
        list.appendChild(div);
    });
}

window.printMultiDrawTicketFromList = function(ticketId) {
    const ticket = multiDrawTickets.find(t => t.id === ticketId);
    if (ticket) printMultiDrawTicket(ticket);
    else showNotification("Fiche pa jwenn", "error");
};

async function loadMultiDrawTickets() {
    try {
        const data = await apiCall(APP_CONFIG.multiDrawTickets);
        multiDrawTickets = data.tickets || [];
    } catch(e) { console.error(e); multiDrawTickets = []; }
}

// ==========================================
// 9. Rapports et gestion des fiches
// ==========================================
function generateEndOfDrawReport() {
    const reportScreen = document.getElementById('report-screen');
    const content = document.getElementById('report-content');
    let totalBets = savedTickets.length;
    let totalAmount = savedTickets.reduce((s,t)=>s+(t.total||0),0);
    content.innerHTML = `<div class="report-header"><h3>${companyInfo.reportTitle}</h3><p>Rapò Fin Tiraj</p><p>${new Date().toLocaleString()}</p></div><div class="report-details"><div class="report-row"><span>Nimewo fiche:</span><span>${totalBets}</span></div><div class="report-row"><span>Montan total:</span><span>${totalAmount} G</span></div><div class="report-row total"><span>TOTAL GENERAL:</span><span>${totalAmount} G</span></div></div><p style="margin-top:20px;text-align:center;"><strong>Tel:</strong> ${companyInfo.reportPhone}<br><strong>Adrès:</strong> ${companyInfo.address}</p>`;
    document.querySelector('.container').style.display = 'none';
    reportScreen.style.display = 'block';
}

function showScreen(screenId) {
    document.querySelectorAll('.screen, .betting-screen, .container, .report-screen, .results-check-screen, .multi-tickets-screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (screenId === 'home') document.querySelector('.container').style.display = 'block';
    else {
        const scr = document.getElementById(screenId+'-screen');
        if (scr) scr.style.display = 'block';
        if (screenId === 'ticket-management') updateTicketManagementScreen();
        else if (screenId === 'history') updateHistoryScreen();
        else if (screenId === 'winning-tickets') updateWinningTicketsScreen();
    }
}

function updateTicketManagementScreen() {
    const list = document.getElementById('ticket-management-list');
    const all = [...savedTickets, ...pendingSyncTickets];
    if (all.length===0) { list.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-file-invoice"></i><p>Pa gen fiche ki sove.</p></div>'; return; }
    const sorted = [...all].sort((a,b)=>new Date(b.date)-new Date(a.date));
    let html = '';
    sorted.forEach(t => {
        const date = new Date(t.date);
        const canEdit = (Date.now()-date) <= FIVE_MINUTES;
        const grouped = groupBetsByType(t.bets);
        let betsHTML = '';
        for (let [type, bets] of Object.entries(grouped)) {
            const totalAmt = bets.reduce((s,b)=>s+b.amount,0);
            betsHTML += `<div><strong>${type}:</strong> ${bets.length} parye (${totalAmt} G)</div>`;
        }
        html += `<div class="ticket-management"><div class="ticket-management-header"><div><strong>Fiche #${String(t.number).padStart(6,'0')}</strong>${t.draw?`<div>${draws[t.draw]?.name} (${t.drawTime==='morning'?'Maten':'Swè'})</div>`:''}</div><div>${date.toLocaleString()}<div><strong>${t.total||0} G</strong></div></div></div><div class="ticket-details">${betsHTML}${t.agentName?`<div>Ajan: ${t.agentName}</div>`:''}</div>${canEdit?`<div><button class="edit-btn" onclick="loadTicketForEdit('${t._id||t.id}')">Modifye</button><button class="delete-btn" onclick="deleteTicket('${t._id||t.id}')">Efase</button></div>`:`<div style="color:#7f8c8d;font-size:0.9rem;">Fiche sa pa ka modifye ankò (5 minit deja pase)</div>`}</div>`;
    });
    list.innerHTML = html;
}

function updateHistoryScreen() {
    const reportsContainer = document.getElementById('reports-container');
    const historyList = document.getElementById('history-list');
    reportsContainer.innerHTML = '';
    const generalBtn = document.createElement('button'); generalBtn.className='report-btn general'; generalBtn.textContent='Rapò Jeneral'; generalBtn.onclick=generateGeneralReport; reportsContainer.appendChild(generalBtn);
    Object.entries(draws).forEach(([id,draw]) => {
        const morningBtn = document.createElement('button'); morningBtn.className='report-btn'; morningBtn.textContent=`${draw.name} Midi`; morningBtn.onclick=()=>generateDrawReport(id,'morning'); reportsContainer.appendChild(morningBtn);
        const eveningBtn = document.createElement('button'); eveningBtn.className='report-btn'; eveningBtn.textContent=`${draw.name} Swè`; eveningBtn.onclick=()=>generateDrawReport(id,'evening'); reportsContainer.appendChild(eveningBtn);
    });
    historyList.innerHTML = '';
    if (savedTickets.length===0) { historyList.innerHTML='<p>Pa gen fiche ki sove.</p>'; return; }
    const sorted = [...savedTickets].sort((a,b)=>new Date(b.date)-new Date(a.date));
    sorted.forEach(t => {
        const date = new Date(t.date);
        const canEdit = (Date.now()-date) <= FIVE_MINUTES;
        const grouped = groupBetsByType(t.bets);
        let betsHTML = '';
        for (let [type, bets] of Object.entries(grouped)) {
            const betStrings = bets.map(b => {
                let info = b.number;
                if (b.isLotto4||b.isLotto5) { let opts=[]; if(b.options?.option1)opts.push('O1'); if(b.options?.option2)opts.push('O2'); if(b.options?.option3)opts.push('O3'); if(opts.length) info+=` (${opts.join(',')})`; }
                return `${info} (${b.amount} G)`;
            });
            betsHTML += `<div><strong>${type}:</strong> ${betStrings.join(', ')}</div>`;
        }
        historyList.innerHTML += `<div class="history-item"><div class="history-header"><span class="history-draw">${draws[t.draw]?.name} (${t.drawTime==='morning'?'Maten':'Swè'})</span><span class="history-date">${date.toLocaleString()}</span></div><div class="history-bets">${betsHTML}</div><div class="history-total"><span>Total:</span><span>${t.total} G</span></div>${canEdit?`<div><button class="edit-btn" onclick="loadTicketForEdit('${t._id||t.id}')">Modifye</button><button class="delete-btn" onclick="deleteTicket('${t._id||t.id}')">Efase</button></div>`:''}</div>`;
    });
}

function updateWinningTicketsScreen() {
    const list = document.getElementById('winning-tickets-list');
    if (winningTickets.length===0) { list.innerHTML='<p>Pa gen fiche gagnant pou montre.</p>'; return; }
    list.innerHTML = '';
    winningTickets.forEach(t => {
        let betsHTML = '';
        t.winningBets.forEach(wb => { betsHTML += `<div class="history-bet"><span>${wb.name}: ${wb.number}</span><span style="color:var(--success-color);">+${wb.winAmount} G (${wb.winType})</span></div>`; });
        list.innerHTML += `<div class="history-item winning-ticket"><div class="history-header"><span class="history-draw">Fiche #${String(t.number).padStart(6,'0')}</span><span class="history-date">${new Date(t.date).toLocaleString()}</span></div><div class="history-bets">${betsHTML}</div><div class="history-total"><span>Total Gains:</span><span style="color:var(--success-color);">${t.totalWinnings} G</span></div></div>`;
    });
}

function generateGeneralReport() {
    const reportRes = document.getElementById('report-results');
    reportRes.innerHTML = `<div class="report-results"><h3>Rapò Jeneral</h3><div class="report-item"><span>Total fiche:</span><span>${savedTickets.length}</span></div><div class="report-item"><span>Total montan:</span><span>${savedTickets.reduce((s,t)=>s+(t.total||0),0)} G</span></div></div>`;
}

function generateDrawReport(drawId, time) {
    const reportRes = document.getElementById('report-results');
    const filtered = savedTickets.filter(t => t.draw===drawId && t.drawTime===time);
    reportRes.innerHTML = `<div class="report-results"><h3>Rapò ${draws[drawId].name} (${time==='morning'?'Maten':'Swè'})</h3><div class="report-item"><span>Nimewo fiche:</span><span>${filtered.length}</span></div><div class="report-item"><span>Total montan:</span><span>${filtered.reduce((s,t)=>s+(t.total||0),0)} G</span></div></div>`;
}

function groupBetsByType(bets) {
    const groups = {};
    bets.forEach(bet => {
        const key = bet.name;
        if (!groups[key]) groups[key] = [];
        groups[key].push({...bet});
    });
    return groups;
}

function searchTicket() {
    const term = document.getElementById('search-ticket-number').value.toLowerCase();
    const items = document.querySelectorAll('#ticket-management-list .ticket-management');
    items.forEach(item => {
        if (!term) item.style.display = 'block';
        else item.style.display = item.textContent.toLowerCase().includes(term) ? 'block' : 'none';
    });
}

function showAllTickets() { document.getElementById('search-ticket-number').value=''; updateTicketManagementScreen(); }
function showPendingTickets() {
    const list = document.getElementById('ticket-management-list');
    if (pendingSyncTickets.length===0) { list.innerHTML='<div style="text-align:center;padding:40px;"><i class="fas fa-hourglass-half"></i><p>Pa gen fiche ki pokò ale nan santral.</p></div>'; return; }
    let html = '<h3>Fiche Pokò ale nan santral</h3>';
    const sorted = [...pendingSyncTickets].sort((a,b)=>new Date(b.date)-new Date(a.date));
    sorted.forEach(t => {
        const date = new Date(t.date);
        const canEdit = (Date.now()-date) <= FIVE_MINUTES;
        html += `<div class="ticket-management"><div class="ticket-management-header"><div><strong>Fiche #${String(t.number).padStart(6,'0')}</strong>${t.draw?`<div>${draws[t.draw]?.name} (${t.drawTime==='morning'?'Maten':'Swè'})</div>`:''}</div><div>${date.toLocaleString()}<div>${t.total||0} G</div></div></div><div class="ticket-details"><div>${t.bets.length} parye</div>${t.agentName?`<div>Ajan: ${t.agentName}</div>`:''}</div>${canEdit?`<div><button class="edit-btn" onclick="loadTicketForEdit('${t._id||t.id}')">Modifye</button><button class="delete-btn" onclick="deleteTicket('${t._id||t.id}')">Efase</button></div>`:''}</div>`;
    });
    list.innerHTML = html;
}
function searchHistory() {
    const term = document.getElementById('search-history').value.toLowerCase();
    document.querySelectorAll('#history-list .history-item').forEach(i => i.style.display = i.textContent.toLowerCase().includes(term) ? 'block' : 'none');
}
function searchWinningTickets() {
    const term = document.getElementById('search-winning-tickets').value.toLowerCase();
    document.querySelectorAll('#winning-tickets-list .history-item').forEach(i => i.style.display = i.textContent.toLowerCase().includes(term) ? 'block' : 'none');
}
function checkConnectionBeforeSavePrint() { document.getElementById('connection-check').style.display='flex'; setTimeout(()=>{ document.getElementById('connection-check').style.display='none'; saveAndPrintTicket(); },1500); }
function checkConnectionBeforePrint() { document.getElementById('connection-check').style.display='flex'; setTimeout(()=>{ document.getElementById('connection-check').style.display='none'; printTicket(); },1000); }
function retryConnectionCheck() { document.getElementById('save-print-ticket').disabled ? checkConnectionBeforeSavePrint() : checkConnectionBeforePrint(); }
function cancelPrint() { document.getElementById('connection-check').style.display='none'; }
async function saveAndPrintTicket() { if(activeBets.length===0){showNotification("Pa gen parye","warning");return;} await saveTicket(); setTimeout(()=>printTicket(),100); }
function printTicket() {
    const last = savedTickets[savedTickets.length-1];
    if(!last){showNotification("Pa gen fiche", "warning");return;}
    const printContent = document.createElement('div'); printContent.className='print-ticket';
    const grouped = groupBetsByType(last.bets);
    let betsHTML='', total=0;
    for(let [type,bets] of Object.entries(grouped)){
        betsHTML+=`<div><strong>${type}</strong><div style="display:flex;flex-wrap:wrap;gap:5px;">`;
        bets.forEach(b=>{
            let info = b.number;
            if(b.isLotto4||b.isLotto5){ let opts=[]; if(b.options?.option1)opts.push('O1'); if(b.options?.option2)opts.push('O2'); if(b.options?.option3)opts.push('O3'); if(opts.length) info+=` (${opts.join(',')})`; }
            betsHTML+=`<div style="background:#f0f0f0;padding:5px 10px;border-radius:4px;">${info}<br><strong>${b.amount} G</strong></div>`;
            total+=b.amount;
        });
        betsHTML+=`</div></div>`;
    }
    printContent.innerHTML = `<div style="text-align:center;padding:20px;border:2px solid #000;"><div><img src="${companyLogo}" style="max-width:80px;"></div><h2>${companyInfo.name}</h2><p>Fiche Parye</p><p>Nimewo: #${String(last.number).padStart(6,'0')}</p><p>Dat: ${new Date(last.date).toLocaleString('fr-FR')}</p><p>Tiraj: ${draws[last.draw]?.name} (${last.drawTime==='morning'?'Maten':'Swè'})</p><p>Ajan: ${last.agentName}</p><hr>${betsHTML}<hr><div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Total:</span><span>${total} G</span></div><p>Mèsi pou konfyans ou!</p></div>`;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Fiche ${companyInfo.name}</title><style>@media print{body{margin:0;padding:0;} @page{margin:0;}}</style></head><body>${printContent.innerHTML}</body></html>`);
    w.document.close(); w.print();
}