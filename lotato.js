// ==========================================
// LOTATO - Interface Agent (Version Complète)
// ==========================================

// Configuration de base avec APP_CONFIG
const API_BASE_URL = 'https://lotatonova-fv0b.onrender.com';
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
    reportPhone: "40104585",
    slogan: "Chwazi yon Jwet",
    agentCommission: 10
};

// Tickets gagnants
let winningTickets = [];

// Gestion du token
let authToken = null;

// ==========================================
// 1. Fonction de communication API (Corrigée)
// ==========================================
async function apiCall(url, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };

    // CORRECTION ICI : On utilise 'x-auth-token' au lieu de 'Authorization: Bearer'
    // pour correspondre à ce que server.js attend (ligne 225 de server.js)
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
            // Token invalide ou expiré
            handleLogout();
            return null;
        }

        // Gérer les réponses vides ou non-JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return { success: response.ok };
        }
    } catch (error) {
        console.error('Erreur API:', error);
        // Si erreur réseau et qu'on essaie de sauvegarder, on ne bloque pas tout
        return null;
    }
}

// Vérifier l'authentification
function checkAuth() {
    const token = localStorage.getItem('nova_token');
    
    if (!token) {
        // Rediriger vers la page de connexion
        window.location.href = '/index.html';
        return false;
    }
    
    authToken = token;
    return true;
}

// Charger les données depuis l'API
async function loadDataFromAPI() {
    try {
        // Charger les tickets
        const ticketsData = await apiCall(APP_CONFIG.tickets);
        savedTickets = ticketsData.tickets || [];
        ticketNumber = ticketsData.nextTicketNumber || 1;
        
        // Charger les tickets en attente
        const pendingData = await apiCall(APP_CONFIG.ticketsPending);
        pendingSyncTickets = pendingData.tickets || [];
        
        // Charger les tickets gagnants
        const winningData = await apiCall(APP_CONFIG.winningTickets);
        winningTickets = winningData.tickets || [];
        
        // Charger les fiches multi-tirages
        const multiDrawData = await apiCall(APP_CONFIG.multiDrawTickets);
        multiDrawTickets = multiDrawData.tickets || [];
        
        // Charger les informations de l'entreprise
        const companyData = await apiCall(APP_CONFIG.companyInfo);
        if (companyData) {
            companyInfo = { ...companyInfo, ...companyData };
        }
        
        // Charger le logo
        const logoData = await apiCall(APP_CONFIG.logo);
        if (logoData && logoData.logoUrl) {
            companyLogo = logoData.logoUrl;
        }
        
        // Mettre à jour l'affichage des infos entreprise
        updateCompanyDisplay();
        
        console.log('Données chargées depuis l\'API:', { 
            tickets: savedTickets.length, 
            ticketNumber, 
            pending: pendingSyncTickets.length,
            winning: winningTickets.length,
            multiDraw: multiDrawTickets.length
        });
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        showNotification("Erreur de chargement des données", "error");
    }
}

// Mettre à jour l'affichage des informations de l'entreprise
function updateCompanyDisplay() {
    const nameEl = document.getElementById('company-name');
    const sloganEl = document.getElementById('company-slogan');
    const logoEl = document.getElementById('company-logo');
    if (nameEl && companyInfo.name) nameEl.textContent = companyInfo.name;
    if (sloganEl && companyInfo.slogan) sloganEl.textContent = companyInfo.slogan;
    if (logoEl && companyInfo.logo) logoEl.src = companyInfo.logo;
}

// ==========================================
// 2. Fonction sauvegarde Pending (Corrigée)
// ==========================================
async function savePendingTicketAPI(ticket) {
    if (!navigator.onLine) return null;
    
    try {
        console.log("Tentative sauvegarde pending ticket:", ticket.number);
        // CORRECTION ICI : On enveloppe le ticket dans un objet { ticket: ... }
        // car server.js attend "const { ticket } = req.body" (ligne 555)
        const response = await apiCall(APP_CONFIG.ticketsPending, 'POST', { ticket: ticket });
        return response;
    } catch (e) {
        console.error("Erreur savePendingTicketAPI:", e);
        return null;
    }
}

// Sauvegarder une fiche multi-tirages via API
async function saveMultiDrawTicketAPI(ticket) {
    try {
        const response = await apiCall(APP_CONFIG.multiDrawTickets, 'POST', ticket);
        return response;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la fiche multi-tirages:', error);
        throw error;
    }
}

// Sauvegarder l'historique via API
async function saveHistoryAPI(historyRecord) {
    try {
        const response = await apiCall(APP_CONFIG.history, 'POST', historyRecord);
        return response;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'historique:', error);
        throw error;
    }
}
// ==========================================
// 3. Initialisation
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log("Document chargé, initialisation...");
    
    // Vérifier l'authentification
    if (!checkAuth()) {
        return;
    }
    
    // Masquer l'écran de connexion intégré
    document.getElementById('login-screen').style.display = 'none';
    
    // Afficher l'application principale
    showMainApp();
    
    // Mettre à jour l'heure
    updateCurrentTime();
    
    // Charger les données depuis l'API
    loadDataFromAPI();
    
    // Configurer la détection de connexion
    setupConnectionDetection();
    
    // Mettre à jour l'affichage du logo
    updateLogoDisplay();
    
    // Charger les résultats depuis la base de données
    loadResultsFromDatabase();
    
    // Ajouter les écouteurs d'événements pour les tirages
    document.querySelectorAll('.draw-card').forEach(card => {
        card.addEventListener('click', function() {
            console.log("Carte de tiraj cliquée:", this.getAttribute('data-draw'));
            const drawId = this.getAttribute('data-draw');
            openBettingScreen(drawId, 'morning');
        });
    });
    
    // Ajouter les écouteurs d'événements pour les boutons de tirage
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.draw-card');
            const drawId = card.getAttribute('data-draw');
            const time = this.getAttribute('data-time');
            
            console.log("Bouton tiraj cliqué:", drawId, time);
            
            card.querySelectorAll('.draw-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            openBettingScreen(drawId, time);
        });
    });
    
    // Bouton de retour
    document.getElementById('back-button').addEventListener('click', closeBettingScreen);
    
    // Boutons de fiche
    document.getElementById('save-print-ticket').addEventListener('click', function() {
        console.log("Sauvegarder et imprimer cliqué");
        checkConnectionBeforeSavePrint();
    });
    
    document.getElementById('save-ticket-only').addEventListener('click', function() {
        console.log("Sauvegarder seulement cliqué");
        saveTicket();
    });
    
    document.getElementById('print-ticket-only').addEventListener('click', function() {
        console.log("Imprimer seulement cliqué");
        checkConnectionBeforePrint();
    });
    
    // Bouton pour sauvegarder et imprimer la fiche multi-tirages
    document.getElementById('save-print-multi-ticket').addEventListener('click', function() {
        console.log("Sauvegarder et imprimer fiche multi-tirages");
        saveAndPrintMultiDrawTicket();
    });
    
    // Bouton pour voir la fiche multi-tirages actuelle
    document.getElementById('view-current-multi-ticket').addEventListener('click', function() {
        console.log("Voir fiche multi-tirages actuelle");
        viewCurrentMultiDrawTicket();
    });
    
    // Bouton pour ouvrir l'écran des fiches multi-tirages
    document.getElementById('open-multi-tickets').addEventListener('click', function() {
        console.log("Ouvrir écran fiches multi-tirages");
        openMultiTicketsScreen();
    });
    
    // Bouton de retour de l'écran multi-tirages
    document.getElementById('back-from-multi-tickets').addEventListener('click', function() {
        console.log("Retour de l'écran multi-tirages");
        document.getElementById('multi-tickets-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const screen = this.getAttribute('data-screen');
            console.log("Navigation cliquée:", screen);
            showScreen(screen);
        });
    });
    
    // Boutons de retour
    document.querySelectorAll('.back-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const screen = this.getAttribute('data-screen') || 'home';
            console.log("Bouton retour cliqué vers:", screen);
            showScreen(screen);
        });
    });
    
    // Bouton retour du rapport
    document.getElementById('back-from-report').addEventListener('click', function() {
        console.log("Retour du rapport");
        document.getElementById('report-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    
    // Bouton retour de vérification des résultats
    document.getElementById('back-from-results').addEventListener('click', function() {
        console.log("Retour de vérification des résultats");
        document.getElementById('results-check-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    
    // Boutons de connexion
    document.getElementById('retry-connection').addEventListener('click', function() {
        console.log("Réessayer connexion");
        retryConnectionCheck();
    });
    
    document.getElementById('cancel-print').addEventListener('click', function() {
        console.log("Annuler impression");
        cancelPrint();
    });
    
    // Bouton pour générer le rapport
    document.getElementById('generate-report-btn').addEventListener('click', function() {
        console.log("Générer rapport");
        generateEndOfDrawReport();
    });
    
    // Bouton pour ouvrir l'écran de vérification des résultats
    document.getElementById('open-results-check').addEventListener('click', function() {
        console.log("Ouvrir vérification des résultats");
        openResultsCheckScreen();
    });
    
    // Bouton pour vérifier les fiches gagnantes
    document.getElementById('check-winners-btn').addEventListener('click', function() {
        console.log("Vérifier fiches gagnantes");
        checkWinningTickets();
    });
    
    // Multi-tirages
    document.getElementById('multi-draw-toggle').addEventListener('click', function() {
        console.log("Toggle multi-tirages");
        toggleMultiDrawPanel();
    });
    
    // Changement du bouton pour ajouter à la fiche multi-tirages
    document.getElementById('add-to-multi-draw').addEventListener('click', function() {
        console.log("Ajouter à la fiche multi-tirages");
        addToMultiDrawTicket();
    });
    
    // Initialiser le panneau multi-tirages
    initMultiDrawPanel();
    
    // Gestion des fiches - Écouteurs d'événements ajoutés
    document.getElementById('search-ticket-btn').addEventListener('click', function() {
        console.log("Rechercher fiche");
        searchTicket();
    });
    
    document.getElementById('show-all-tickets').addEventListener('click', function() {
        console.log("Afficher toutes les fiches");
        showAllTickets();
    });
    
    document.getElementById('show-pending-tickets').addEventListener('click', function() {
        console.log("Afficher fiches en attente");
        showPendingTickets();
    });
    
    // Recherche historique
    document.getElementById('search-history-btn').addEventListener('click', function() {
        console.log("Rechercher historique");
        searchHistory();
    });
    
    document.getElementById('search-winning-btn').addEventListener('click', function() {
        console.log("Rechercher fiches gagnantes");
        searchWinningTickets();
    });
    
    // Bouton déconnecté
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('nova_token');
        window.location.href = '/index.html';
    });
    
    // Filtres de rapport
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
    
    // Actualiser périodiquement
    setInterval(updateCurrentTime, 60000);
    setInterval(updatePendingBadge, 30000);
    // Vérifier périodiquement les résultats
    setInterval(checkForNewResults, 300000); // Toutes les 5 minutes
    
    console.log("Initialisation terminée");
});

// Afficher l'application principale
function showMainApp() {
    console.log("Affichage application principale");
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('sync-status').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'block';
}

// Mettre à jour l'affichage du logo
function updateLogoDisplay() {
    const logoElements = document.querySelectorAll('#company-logo, #ticket-logo');
    logoElements.forEach(logo => {
        if(companyInfo.logo) logo.src = companyInfo.logo;
        else logo.src = companyLogo;
        logo.onerror = function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YzOWMxMiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Qk9STEVUVEU8L3RleHQ+PC9zdmc+';
        };
    });
    // Mettre à jour le nom et slogan
    const nameEl = document.getElementById('company-name');
    const sloganEl = document.getElementById('company-slogan');
    if (nameEl && companyInfo.name) nameEl.textContent = companyInfo.name;
    if (sloganEl && companyInfo.slogan) sloganEl.textContent = companyInfo.slogan;
}

// Configurer la détection de connexion
function setupConnectionDetection() {
    window.addEventListener('online', function() {
        isOnline = true;
        showNotification("Koneksyon entènèt retabli", "success");
        // Vérifier les nouveaux résultats quand la connexion revient
        checkForNewResults();
    });
    
    window.addEventListener('offline', function() {
        isOnline = false;
        showNotification("Pa konekte ak entènèt", "warning");
    });
}

// Afficher une notification
function showNotification(message, type = 'info') {
    console.log("Notification:", type, message);
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'fas fa-info-circle';
    if (type === 'success') icon = 'fas fa-check-circle';
    if (type === 'warning') icon = 'fas fa-exclamation-triangle';
    if (type === 'error') icon = 'fas fa-times-circle';
    
    notification.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Mettre à jour l'heure actuelle
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

// Mettre à jour le badge des fiches en attente
function updatePendingBadge() {
    const pendingCount = pendingSyncTickets.length;
    console.log("Mise à jour badge:", pendingCount);
    // Cette fonction peut être étendue pour afficher un badge visuel
}

// Afficher un écran spécifique
function showScreen(screenId) {
    console.log("Afficher écran:", screenId);
    
    // Cacher tous les écrans
    document.querySelectorAll('.screen, .betting-screen, .container, .report-screen, .results-check-screen, .multi-tickets-screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // Mettre à jour la navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-screen') === screenId) {
            item.classList.add('active');
        }
    });
    
    if (screenId === 'home') {
        document.querySelector('.container').style.display = 'block';
    } else if (screenId === 'report-stats') {
        document.getElementById('report-stats-screen').style.display = 'block';
        updateReportScreen();
    } else {
        const screen = document.getElementById(screenId + '-screen');
        if (screen) {
            screen.style.display = 'block';
            
            // Mettre à jour le contenu de l'écran si nécessaire
            if (screenId === 'ticket-management') {
                updateTicketManagementScreen();
            } else if (screenId === 'history') {
                updateHistoryScreen();
            } else if (screenId === 'winning-tickets') {
                updateWinningTicketsScreen();
            }
        }
    }
}

// ==========================================
// 4. Fonctions de rapport et commission
// ==========================================
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
// 5. Chargement des résultats
// ==========================================
async function loadResultsFromDatabase() {
    console.log("Chargement des résultats depuis la base de données...");
    
    try {
        // Appel API pour les résultats
        const resultsData = await apiCall(APP_CONFIG.results);
        if (resultsData && resultsData.results) {
            resultsDatabase = resultsData.results;
        }
        
        console.log("Utilisation des résultats:", resultsDatabase);
        
        // Mettre à jour l'affichage des résultats
        updateResultsDisplay();
        
    } catch (error) {
        console.error("Erreur lors du chargement des résultats:", error);
        showNotification("Erreur chargement résultats", "error");
    }
}

// Vérifier les nouveaux résultats
async function checkForNewResults() {
    console.log("Vérification des nouveaux résultats...");
    
    if (!isOnline) {
        console.log("Pas de connexion Internet");
        return;
    }
    
    try {
        const resultsData = await apiCall(APP_CONFIG.results);
        if (resultsData && resultsData.results) {
            resultsDatabase = resultsData.results;
            updateResultsDisplay();
            console.log("Résultats mis à jour");
        }
    } catch (error) {
        console.error("Erreur lors de la vérification des résultats:", error);
    }
}

// Mettre à jour l'affichage des résultats
function updateResultsDisplay() {
    console.log("Mise à jour affichage des résultats");
    
    // Mettre à jour l'écran de vérification des résultats
    const latestResults = document.getElementById('latest-results');
    if (latestResults) {
        latestResults.innerHTML = '';
        
        Object.keys(draws).forEach(drawId => {
            Object.keys(draws[drawId].times).forEach(time => {
                const result = resultsDatabase[drawId]?.[time];
                if (result) {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'lot-result';
                    
                    const timeName = time === 'morning' ? 'Maten' : 'Swè';
                    resultDiv.innerHTML = `
                        <div>
                            <strong>${draws[drawId].name} ${timeName}</strong><br>
                            <small>${new Date(result.date).toLocaleString()}</small>
                        </div>
                        <div style="text-align: right;">
                            <div class="lot-number">${result.lot1}</div>
                            <div>${result.lot2} (×20)</div>
                            <div>${result.lot3} (×10)</div>
                        </div>
                    `;
                    
                    latestResults.appendChild(resultDiv);
                }
            });
        });
    }
}

// ==========================================
// 6. Écran de pari
// ==========================================
function openBettingScreen(drawId, time = null) {
    console.log("Ouvrir écran pari:", drawId, time);
    currentDraw = drawId;
    currentDrawTime = time;
    const draw = draws[drawId];
    
    let title = draw.name;
    if (time) {
        title += ` (${time === 'morning' ? 'Maten' : 'Swè'})`;
    }
    document.getElementById('betting-title').textContent = title;
    
    const bettingScreen = document.getElementById('betting-screen');
    bettingScreen.style.display = 'block';
    bettingScreen.classList.remove('slide-out');
    bettingScreen.classList.add('slide-in');
    
    document.querySelector('.container').style.display = 'none';
    
    // Afficher TOUTES les catégories de jeux
    document.getElementById('games-interface').style.display = 'block';
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('active-bets').style.display = 'block';
    
    // Configurer les événements des jeux
    setupGameSelection();
    
    updateBetsList();
}

function closeBettingScreen() {
    console.log("Fermer écran pari");
    const bettingScreen = document.getElementById('betting-screen');
    bettingScreen.classList.remove('slide-in');
    bettingScreen.classList.add('slide-out');
    
    setTimeout(() => {
        bettingScreen.style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    }, 300);
}

function setupGameSelection() {
    console.log("Configuration sélection jeux");
    // Retirer d'abord les anciens écouteurs
    const existingItems = document.querySelectorAll('.game-item');
    existingItems.forEach(item => {
        item.replaceWith(item.cloneNode(true));
    });
    
    // Ajouter les nouveaux écouteurs
    document.querySelectorAll('.game-item').forEach(item => {
        item.addEventListener('click', function() {
            const gameType = this.getAttribute('data-game');
            console.log("Jeu sélectionné:", gameType);
            
            // Gestion des jeux automatiques
            if (gameType === 'auto-marriage' || gameType === 'auto-lotto4') {
                showAutoGameForm(gameType);
            } else {
                showBetForm(gameType);
            }
        });
    });
}

// ==========================================
// 7. Formulaire de pari avec bouton Nx
// ==========================================
function showBetForm(gameType) {
    console.log("Afficher formulaire pour:", gameType);
    const bet = betTypes[gameType];
    
    // Cacher l'interface des jeux
    document.getElementById('games-interface').style.display = 'none';
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    
    let formHTML = '';
    
    switch(gameType) {
        case 'borlette':
            formHTML = `
                <h3>${bet.name} - ${bet.description}</h3>
                <div class="quick-bet-form">
                    <input type="text" id="borlette-number" class="quick-number-input" placeholder="00" maxlength="2">
                    <input type="number" id="borlette-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                </div>
                <div class="nx-button" id="show-nx-balls">Nx</div>
                <div class="n-balls-container">
                    ${[...Array(10)].map((_,i)=>`<div class="n-ball" data-n="${i}">N${i}</div>`).join('')}
                </div>
                <div class="bet-actions">
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>
            `;
            break;
            
        case 'boulpe':
            formHTML = `
                <h3>${bet.name} - ${bet.description}</h3>
                <div class="quick-bet-form">
                    <input type="text" id="boulpe-number" class="quick-number-input" placeholder="00" maxlength="2">
                    <input type="number" id="boulpe-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                </div>
                <div class="nx-button" id="show-nx-balls">Nx</div>
                <div class="n-balls-container">
                    ${[...Array(10)].map((_,i)=>`<div class="n-ball" data-n="${i}">N${i}</div>`).join('')}
                </div>
                <div class="bet-actions">
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>
            `;
            break;
            
        case 'lotto3':
            formHTML = `
                <h3>${bet.name} - ${bet.description}</h3>
                <div class="quick-bet-form">
                    <input type="text" id="lotto3-number" class="quick-number-input" placeholder="000" maxlength="3">
                    <input type="number" id="lotto3-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                </div>
                <div class="bet-actions">
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>
            `;
            break;
            
        case 'marriage':
            formHTML = `
                <h3>${bet.name} - ${bet.description}</h3>
                <div class="number-inputs">
                    <input type="text" id="marriage-number1" placeholder="00" maxlength="2">
                    <input type="text" id="marriage-number2" placeholder="00" maxlength="2">
                </div>
                <div class="quick-bet-form">
                    <input type="number" id="marriage-amount" class="quick-amount-input" placeholder="Kantite" min="1" value="1">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                </div>
                <div class="bet-actions">
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>
            `;
            break;
            
        case 'lotto4':
            formHTML = `
                <h3>${bet.name} - ${bet.description}</h3>
                <div class="number-inputs">
                    <input type="text" id="lotto4-number1" placeholder="00" maxlength="2">
                    <input type="text" id="lotto4-number2" placeholder="00" maxlength="2">
                </div>
                <div class="options-container">
                    <div class="option-checkbox">
                        <input type="checkbox" id="lotto4-option1" checked>
                        <label>Opsyon 1</label>
                        <span class="option-multiplier">×${bet.multiplier}</span>
                    </div>
                    <div class="option-checkbox">
                        <input type="checkbox" id="lotto4-option2" checked>
                        <label>Opsyon 2</label>
                        <span class="option-multiplier">×${bet.multiplier}</span>
                    </div>
                    <div class="option-checkbox">
                        <input type="checkbox" id="lotto4-option3" checked>
                        <label>Opsyon 3</label>
                        <span class="option-multiplier">×${bet.multiplier}</span>
                    </div>
                </div>
                <div class="quick-bet-form">
                    <input type="number" id="lotto4-amount" placeholder="Kantite pa opsyon" min="1" value="1">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                </div>
                <div class="bet-actions">
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>
            `;
            break;
            
        case 'lotto5':
            formHTML = `
                <h3>${bet.name} - ${bet.description}</h3>
                <div class="number-inputs">
                    <input type="text" id="lotto5-number1" placeholder="000" maxlength="3">
                    <input type="text" id="lotto5-number2" placeholder="00" maxlength="2">
                </div>
                <div class="options-container">
                    <div class="option-checkbox">
                        <input type="checkbox" id="lotto5-option1" checked>
                        <label>Opsyon 1</label>
                        <span class="option-multiplier">×${bet.multiplier}</span>
                    </div>
                    <div class="option-checkbox">
                        <input type="checkbox" id="lotto5-option2" checked>
                        <label>Opsyon 2</label>
                        <span class="option-multiplier">×${bet.multiplier}</span>
                    </div>
                    <div class="option-checkbox">
                        <input type="checkbox" id="lotto5-option3" checked>
                        <label>Opsyon 3</label>
                        <span class="option-multiplier">×${bet.multiplier}</span>
                    </div>
                </div>
                <div class="quick-bet-form">
                    <input type="number" id="lotto5-amount" placeholder="Kantite pa opsyon" min="1" value="1">
                    <button class="btn-primary" id="add-bet">Ajoute</button>
                </div>
                <div class="bet-actions">
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>
            `;
            break;
            
        case 'grap':
            formHTML = `
                <h3>${bet.name} - ${bet.description}</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                    ${['111','222','333','444','555','666','777','888','999','000'].map(p => `<div class="pair-ball" data-pair="${p}">${p}</div>`).join('')}
                </div>
                <div class="quick-bet-form">
                    <input type="number" id="grap-amount" placeholder="Kantite" min="1" value="1">
                    <button class="btn-primary" id="add-grap-bet">Ajoute</button>
                </div>
                <div class="bet-actions">
                    <button class="btn-secondary" id="return-to-types">Retounen</button>
                </div>
            `;
            break;
            
        default:
            formHTML = `<p>Jeu non supporté</p><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    }
    
    betForm.innerHTML = formHTML;
    
    // Gestion du bouton Nx
    const nxBtn = document.getElementById('show-nx-balls');
    if (nxBtn) {
        nxBtn.addEventListener('click', () => {
            const container = document.querySelector('.n-balls-container');
            if (container) container.classList.toggle('show');
        });
    }
    
    // Gestion des boules Nx
    document.querySelectorAll('.n-ball').forEach(ball => {
        ball.addEventListener('click', () => {
            const n = ball.dataset.n;
            const amountInput = document.getElementById(`${gameType}-amount`);
            const amount = amountInput ? parseInt(amountInput.value) : 1;
            if (isNaN(amount) || amount <= 0) {
                showNotification("Kantite valab obligatwa", "warning");
                return;
            }
            const numbers = Array.from({ length: 10 }, (_, i) => String(i + parseInt(n)).padStart(2, '0'));
            activeBets.push({
                id: Date.now() + Math.random(),
                type: gameType,
                name: betTypes[gameType].name + ` N${n}`,
                number: `${n}0-${n}9`,
                amount: amount * 10,
                multiplier: betTypes[gameType].multiplier,
                isGroup: true,
                details: numbers.map(num => ({ number: num, amount: amount }))
            });
            updateBetsList();
            showNotification(`10 boule N${n} ajoute!`, "success");
        });
    });
    
    // Gestion des graps
    document.querySelectorAll('.pair-ball').forEach(ball => {
        ball.addEventListener('click', () => {
            const pair = ball.dataset.pair;
            const amountInput = document.getElementById('grap-amount');
            const amount = amountInput ? parseInt(amountInput.value) : 1;
            if (isNaN(amount) || amount <= 0) {
                showNotification("Kantite valab obligatwa", "warning");
                return;
            }
            activeBets.push({
                id: Date.now() + Math.random(),
                type: 'grap',
                name: 'GRAP',
                number: pair,
                amount: amount,
                multiplier: betTypes.grap.multiplier
            });
            updateBetsList();
            showNotification(`Grap ${pair} ajoute!`, "success");
        });
    });
    
    // Gestion du bouton add-bet générique
    const addBtn = document.getElementById('add-bet');
    if (addBtn) {
        addBtn.addEventListener('click', () => addBet(gameType));
    }
    
    // Gestion du bouton add-grap-bet spécifique
    const addGrapBtn = document.getElementById('add-grap-bet');
    if (addGrapBtn) {
        addGrapBtn.addEventListener('click', () => {
            const amount = parseInt(document.getElementById('grap-amount').value);
            if (isNaN(amount) || amount <= 0) {
                showNotification("Kantite valab obligatwa", "warning");
                return;
            }
            // Ajouter tous les graps sélectionnés ? Par défaut, on laisse l'utilisateur cliquer sur les boules
            showNotification("Klike sou yon boule grap pou ajoute", "info");
        });
    }
    
    const returnBtn = document.getElementById('return-to-types');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            betForm.style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
        });
    }
    
    document.getElementById('active-bets').style.display = 'block';
}
// ==========================================
// 8. Ajout de paris et gestion du panier
// ==========================================
function addBet(gameType) {
    console.log("Ajouter pari:", gameType);
    const bet = betTypes[gameType];
    let number, amount;
    
    switch(gameType) {
        case 'lotto3':
            number = document.getElementById('lotto3-number').value;
            amount = parseInt(document.getElementById('lotto3-amount').value);
            if (!/^\d{3}$/.test(number)) {
                showNotification("Lotto 3 dwe gen 3 chif egzat", "warning");
                return;
            }
            break;
            
        case 'marriage':
            const num1 = document.getElementById('marriage-number1').value;
            const num2 = document.getElementById('marriage-number2').value;
            number = `${num1}*${num2}`;
            amount = parseInt(document.getElementById('marriage-amount').value);
            if (!/^\d{2}$/.test(num1) || !/^\d{2}$/.test(num2)) {
                showNotification("Chak chif maryaj dwe gen 2 chif", "warning");
                return;
            }
            break;
            
        case 'borlette':
            number = document.getElementById('borlette-number').value;
            amount = parseInt(document.getElementById('borlette-amount').value);
            if (!/^\d{2}$/.test(number)) {
                showNotification("Borlette dwe gen 2 chif", "warning");
                return;
            }
            break;
            
        case 'boulpe':
            number = document.getElementById('boulpe-number').value;
            amount = parseInt(document.getElementById('boulpe-amount').value);
            if (!/^\d{2}$/.test(number)) {
                showNotification("Boul pe dwe gen 2 chif", "warning");
                return;
            }
            if (number.length === 2 && number[0] !== number[1]) {
                showNotification("Pou boul pe, fòk de chif yo menm! (ex: 00, 11, 22)", "warning");
                return;
            }
            break;
            
        case 'lotto4':
            const num4_1 = document.getElementById('lotto4-number1').value;
            const num4_2 = document.getElementById('lotto4-number2').value;
            number = num4_1 + num4_2;
            const opt1 = document.getElementById('lotto4-option1')?.checked || false;
            const opt2 = document.getElementById('lotto4-option2')?.checked || false;
            const opt3 = document.getElementById('lotto4-option3')?.checked || false;
            const optCount = [opt1, opt2, opt3].filter(Boolean).length;
            amount = parseInt(document.getElementById('lotto4-amount').value);
            if (!/^\d{2}$/.test(num4_1) || !/^\d{2}$/.test(num4_2)) {
                showNotification("Chak boule Lotto 4 dwe gen 2 chif", "warning");
                return;
            }
            if (optCount === 0) {
                showNotification("Chwazi omwen yon opsyon", "warning");
                return;
            }
            const totalAmount = amount * optCount;
            activeBets.push({
                id: Date.now() + Math.random(),
                type: gameType,
                name: bet.name,
                number: number,
                amount: totalAmount,
                multiplier: bet.multiplier,
                options: { option1: opt1, option2: opt2, option3: opt3 },
                perOptionAmount: amount,
                isLotto4: true
            });
            updateBetsList();
            showNotification("Lotto 4 ajoute avèk siksè!", "success");
            document.getElementById('bet-form').style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
            return;
            
        case 'lotto5':
            const num5_1 = document.getElementById('lotto5-number1').value;
            const num5_2 = document.getElementById('lotto5-number2').value;
            number = num5_1 + num5_2;
            const lotto5Opt1 = document.getElementById('lotto5-option1')?.checked || false;
            const lotto5Opt2 = document.getElementById('lotto5-option2')?.checked || false;
            const lotto5Opt3 = document.getElementById('lotto5-option3')?.checked || false;
            const lotto5OptCount = [lotto5Opt1, lotto5Opt2, lotto5Opt3].filter(Boolean).length;
            amount = parseInt(document.getElementById('lotto5-amount').value);
            if (!/^\d{3}$/.test(num5_1) || !/^\d{2}$/.test(num5_2)) {
                showNotification("Lotto 5: Premye boule 3 chif, Dezyèm boule 2 chif", "warning");
                return;
            }
            if (lotto5OptCount === 0) {
                showNotification("Chwazi omwen yon opsyon", "warning");
                return;
            }
            const lotto5TotalAmount = amount * lotto5OptCount;
            activeBets.push({
                id: Date.now() + Math.random(),
                type: gameType,
                name: bet.name,
                number: number,
                amount: lotto5TotalAmount,
                multiplier: bet.multiplier,
                options: { option1: lotto5Opt1, option2: lotto5Opt2, option3: lotto5Opt3 },
                perOptionAmount: amount,
                isLotto5: true
            });
            updateBetsList();
            showNotification("Lotto 5 ajoute avèk siksè!", "success");
            document.getElementById('bet-form').style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
            return;
            
        default:
            showNotification("Jeu non reconnu", "error");
            return;
    }
    
    if (!number || isNaN(amount) || amount <= 0) {
        showNotification("Tanpri rantre yon nimewo ak yon kantite valab", "warning");
        return;
    }
    
    activeBets.push({
        id: Date.now() + Math.random(),
        type: gameType,
        name: bet.name,
        number: number,
        amount: amount,
        multiplier: bet.multiplier
    });
    
    updateBetsList();
    showNotification("Parye ajoute avèk siksè!", "success");
    
    // Retourner à la liste des jeux après un court délai
    setTimeout(() => {
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    }, 500);
}

function updateBetsList() {
    console.log("Mise à jour liste paris");
    const betsList = document.getElementById('bets-list');
    const betTotal = document.getElementById('bet-total');
    
    betsList.innerHTML = '';
    
    if (activeBets.length === 0) {
        betsList.innerHTML = '<p>Pa gen okenn parye aktif.</p>';
        betTotal.textContent = '0 goud';
        // Cacher la notification du total si aucun pari
        const notification = document.querySelector('.total-notification');
        if (notification) notification.remove();
        return;
    }
    
    // Grouper les paris identiques
    const groupedBets = {};
    activeBets.forEach((bet, index) => {
        let key;
        if (bet.isLotto4 || bet.isLotto5) {
            key = `${bet.type}_${bet.number}_${JSON.stringify(bet.options)}`;
        } else {
            key = `${bet.type}_${bet.number}`;
        }
        if (!groupedBets[key]) {
            groupedBets[key] = {
                bet: bet,
                count: 1,
                totalAmount: bet.amount,
                indexes: [index]
            };
        } else {
            groupedBets[key].count++;
            groupedBets[key].totalAmount += bet.amount;
            groupedBets[key].indexes.push(index);
        }
    });
    
    let total = 0;
    for (const key in groupedBets) {
        const group = groupedBets[key];
        const bet = group.bet;
        total += group.totalAmount;
        
        const betItem = document.createElement('div');
        betItem.className = 'bet-item';
        
        let optionsText = '';
        if (bet.isLotto4 || bet.isLotto5) {
            const opts = [];
            if (bet.options?.option1) opts.push('O1');
            if (bet.options?.option2) opts.push('O2');
            if (bet.options?.option3) opts.push('O3');
            if (opts.length) optionsText = ` (${opts.join(',')})`;
        }
        
        betItem.innerHTML = `
            <div class="bet-details">
                <strong>${bet.name}</strong><br>
                ${bet.number}${optionsText}
            </div>
            <div class="bet-amount">
                ${group.totalAmount} goud
                <span class="bet-remove" data-indexes="${group.indexes.join(',')}"><i class="fas fa-times"></i></span>
            </div>
        `;
        
        betsList.appendChild(betItem);
        
        // Ajouter l'événement pour supprimer
        const removeBtn = betItem.querySelector('.bet-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                const indexes = this.getAttribute('data-indexes').split(',').map(Number);
                indexes.sort((a, b) => b - a).forEach(index => {
                    activeBets.splice(index, 1);
                });
                updateBetsList();
            });
        }
    }
    
    betTotal.textContent = `${total} goud`;
    
    // Mettre à jour la notification du total
    if (total > 0) {
        showTotalNotification(total, 'normal');
    }
}

// Afficher une notification avec le total
function showTotalNotification(totalAmount, type = 'normal') {
    const container = document.getElementById('total-notification-container');
    if (!container) return;
    
    // Supprimer l'ancienne notification
    const oldNotification = document.querySelector('.total-notification');
    if (oldNotification) oldNotification.remove();
    
    // Créer la nouvelle notification
    const notification = document.createElement('div');
    notification.className = 'total-notification';
    
    let typeText = 'Parye';
    if (type === 'multi-draw') typeText = 'Multi-Tirages';
    
    notification.innerHTML = `
        <i class="fas fa-calculator"></i>
        <span>Total ${typeText}:</span>
        <span class="total-amount">${totalAmount} G</span>
    `;
    
    container.appendChild(notification);
    
    // Cacher automatiquement après 5 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => {
                if (notification.parentNode) notification.parentNode.removeChild(notification);
            }, 300);
        }
    }, 5000);
}
// ==========================================
// 9. Jeux automatiques
// ==========================================
function showAutoGameForm(gameType) {
    console.log("Afficher formulaire jeu automatique:", gameType);
    const bet = betTypes[gameType];
    
    document.getElementById('games-interface').style.display = 'none';
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    
    selectedBalls = [];
    
    let formHTML = '';
    
    if (gameType === 'auto-marriage') {
        formHTML = `
            <h3>${bet.name} - ${bet.description}</h3>
            <div class="options-container">
                <div style="margin-bottom: 15px;">
                    <div class="all-graps-btn" id="use-basket-balls">
                        <i class="fas fa-shopping-basket"></i> Itilize Boul nan Panye
                    </div>
                    <div class="all-graps-btn" id="enter-manual-balls">
                        <i class="fas fa-keyboard"></i> Antre Boul Manyèlman
                    </div>
                </div>
                <div id="manual-balls-input" style="display: none;">
                    <input type="text" id="manual-balls" placeholder="12 34 56 78" style="width:100%; margin-bottom:10px;">
                    <button class="btn-primary" id="process-manual-balls">Proses</button>
                </div>
                <div><strong>Boules sélectionnées:</strong> <span id="selected-balls-list">Pa gen boul</span></div>
            </div>
            <div class="form-group">
                <label for="auto-game-amount">Kantite pou chak maryaj</label>
                <input type="number" id="auto-game-amount" min="1" value="1">
            </div>
            <div class="bet-actions">
                <button class="btn-primary" id="add-auto-marriages">Ajoute Maryaj Otomatik</button>
                <button class="btn-secondary" id="return-to-types">Retounen</button>
            </div>
        `;
    } else if (gameType === 'auto-lotto4') {
        formHTML = `
            <h3>${bet.name} - ${bet.description}</h3>
            <div class="options-container">
                <div style="margin-bottom: 15px;">
                    <div class="all-graps-btn" id="use-basket-balls">
                        <i class="fas fa-shopping-basket"></i> Itilize Boul nan Panye
                    </div>
                    <div class="all-graps-btn" id="enter-manual-balls">
                        <i class="fas fa-keyboard"></i> Antre Boul Manyèlman
                    </div>
                </div>
                <div id="manual-balls-input" style="display: none;">
                    <input type="text" id="manual-balls" placeholder="12 34 56 78" style="width:100%; margin-bottom:10px;">
                    <button class="btn-primary" id="process-manual-balls">Proses</button>
                </div>
                <div><strong>Boules sélectionnées:</strong> <span id="selected-balls-list">Pa gen boul</span></div>
                <div class="option-checkbox">
                    <input type="checkbox" id="include-reverse" checked>
                    <label>Enkli renverse yo</label>
                </div>
            </div>
            <div class="form-group">
                <label for="auto-game-amount">Kantite pou chak Lotto 4</label>
                <input type="number" id="auto-game-amount" min="1" value="1">
            </div>
            <div class="bet-actions">
                <button class="btn-primary" id="add-auto-lotto4">Ajoute Lotto 4 Otomatik</button>
                <button class="btn-secondary" id="return-to-types">Retounen</button>
            </div>
        `;
    }
    
    betForm.innerHTML = formHTML;
    
    document.getElementById('use-basket-balls').addEventListener('click', () => {
        const balls = activeBets.filter(b => (b.type === 'borlette' || b.type === 'boulpe') && !b.isGroup).map(b => b.number);
        selectedBalls = [...new Set(balls)];
        updateSelectedBallsDisplay();
        showNotification(`${selectedBalls.length} boul chaje depi panye`, "success");
    });
    
    document.getElementById('enter-manual-balls').addEventListener('click', () => {
        document.getElementById('manual-balls-input').style.display = 'block';
    });
    
    document.getElementById('process-manual-balls').addEventListener('click', () => {
        const input = document.getElementById('manual-balls').value.trim();
        const balls = input.split(/\s+/).filter(b => /^\d{2}$/.test(b));
        if (balls.length === 0) {
            showNotification("Antre boul valab (2 chif)", "warning");
            return;
        }
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
            if (selectedBalls.length < 2) {
                showNotification("Fò gen omwen 2 boul", "warning");
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showNotification("Kantite valab obligatwa", "warning");
                return;
            }
            let addedCount = 0;
            for (let i = 0; i < selectedBalls.length; i++) {
                for (let j = i + 1; j < selectedBalls.length; j++) {
                    activeBets.push({
                        id: Date.now() + Math.random(),
                        type: 'marriage',
                        name: 'MARYAJ OTOMATIK',
                        number: `${selectedBalls[i]}*${selectedBalls[j]}`,
                        amount: amount,
                        multiplier: betTypes.marriage.multiplier
                    });
                    addedCount++;
                }
            }
            updateBetsList();
            showNotification(`${addedCount} maryaj otomatik ajoute!`, "success");
            betForm.style.display = 'none';
            document.getElementById('games-interface').style.display = 'block';
        });
    } else if (gameType === 'auto-lotto4') {
        document.getElementById('add-auto-lotto4').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('auto-game-amount').value);
            const includeReverse = document.getElementById('include-reverse').checked;
            if (selectedBalls.length < 2) {
                showNotification("Fò gen omwen 2 boul", "warning");
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showNotification("Kantite valab obligatwa", "warning");
                return;
            }
            let addedCount = 0;
            for (let i = 0; i < selectedBalls.length; i++) {
                for (let j = i + 1; j < selectedBalls.length; j++) {
                    const b1 = selectedBalls[i];
                    const b2 = selectedBalls[j];
                    activeBets.push({
                        id: Date.now() + Math.random(),
                        type: 'lotto4',
                        name: 'LOTO 4 OTOMATIK',
                        number: b1 + b2,
                        amount: amount,
                        multiplier: betTypes.lotto4.multiplier,
                        options: { option1: false, option2: false, option3: true },
                        perOptionAmount: amount
                    });
                    addedCount++;
                    if (includeReverse) {
                        activeBets.push({
                            id: Date.now() + Math.random(),
                            type: 'lotto4',
                            name: 'LOTO 4 OTOMATIK (R)',
                            number: b2 + b1,
                            amount: amount,
                            multiplier: betTypes.lotto4.multiplier,
                            options: { option1: false, option2: false, option3: true },
                            perOptionAmount: amount
                        });
                        addedCount++;
                    }
                }
            }
            updateBetsList();
            showNotification(`${addedCount} Lotto 4 otomatik ajoute!`, "success");
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
// 10. Sauvegarde et impression des tickets
// ==========================================
async function saveTicket() {
    console.log("Sauvegarder fiche via API");
    if (activeBets.length === 0) {
        showNotification("Pa gen okenn parye pou sove nan fiche a", "warning");
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
        agentName: currentAdmin ? currentAdmin.name : 'Agent',
        agentId: currentAdmin ? currentAdmin.id : 1
    };
    
    try {
        const response = await saveTicketAPI(ticket);
        savedTickets.push(ticket);
        ticketNumber++;
        showNotification("Fiche sove avèk siksè!", "success");
        return response;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du ticket:', error);
        showNotification("Erreur lors de la sauvegarde du ticket", "error");
        throw error;
    }
}

async function saveTicketAPI(ticket) {
    const response = await apiCall(APP_CONFIG.tickets, 'POST', ticket);
    return response;
}

async function saveAndPrintTicket() {
    console.log("Sauvegarder et imprimer");
    if (activeBets.length === 0) {
        showNotification("Pa gen okenn parye pou sove nan fiche a", "warning");
        return;
    }
    
    await saveTicket();
    setTimeout(() => {
        printTicket();
    }, 100);
}

function printTicket() {
    console.log("Imprimer fiche");
    const lastTicket = savedTickets[savedTickets.length - 1];
    
    if (!lastTicket) {
        showNotification("Pa gen fiche ki sove pou enprime.", "warning");
        return;
    }

    const printContent = document.createElement('div');
    printContent.className = 'print-ticket';
    
    let betsHTML = '';
    let total = 0;
    
    lastTicket.bets.forEach(bet => {
        total += bet.amount;
        betsHTML += `
            <div style="margin-bottom: 10px; padding: 5px; border-bottom: 1px solid #ddd;">
                <strong>${bet.name}</strong><br>
                ${bet.number}<br>
                ${bet.amount} G
            </div>
        `;
    });
    
    printContent.innerHTML = `
        <div style="text-align: center; padding: 20px; border: 2px solid #000; font-family: Arial, sans-serif;">
            <div style="margin-bottom: 15px;">
                <img src="${companyInfo.logo || companyLogo}" alt="Logo" style="max-width: 80px; height: auto;">
            </div>
            <h2>${companyInfo.name}</h2>
            <p>Fiche Parye</p>
            <p><strong>Nimewo:</strong> #${String(lastTicket.number).padStart(6, '0')}</p>
            <p><strong>Dat:</strong> ${new Date(lastTicket.date).toLocaleString('fr-FR')}</p>
            <p><strong>Tiraj:</strong> ${draws[lastTicket.draw]?.name || lastTicket.draw} (${lastTicket.drawTime === 'morning' ? 'Maten' : 'Swè'})</p>
            <hr>
            <div style="margin: 15px 0;">
                ${betsHTML}
            </div>
            <hr>
            <div style="display: flex; justify-content: space-between; margin-top: 15px; font-weight: bold; font-size: 1.1rem;">
                <span>Total:</span>
                <span>${total} goud</span>
            </div>
            <p style="margin-top: 20px;">Mèsi pou konfyans ou!</p>
            <p style="font-size: 0.8rem; color: #666; margin-top: 10px;">
                ${companyInfo.address || ''} - Tel: ${companyInfo.phone || ''}
            </p>
        </div>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Fiche ${companyInfo.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    @media print {
                        body { margin: 0; padding: 0; }
                        @page { margin: 0; }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Vérification connexion avant sauvegarde/impression
async function checkConnectionBeforeSavePrint() {
    console.log("Vérification connexion avant sauvegarde/impression");
    const connectionCheck = document.getElementById('connection-check');
    connectionCheck.style.display = 'flex';
    
    if (navigator.onLine) {
        document.getElementById('internet-status').className = 'status-indicator connected';
        document.getElementById('internet-text').textContent = 'Entènèt: Konekte';
    } else {
        document.getElementById('internet-status').className = 'status-indicator disconnected';
        document.getElementById('internet-text').textContent = 'Entènèt: Pa konekte';
        document.getElementById('connection-message').textContent = 'Pa gen koneksyon entènèt. Fiche a pa kapab synchronize.';
        return;
    }
    
    setTimeout(() => {
        connectionCheck.style.display = 'none';
        saveAndPrintTicket();
    }, 1500);
}

async function checkConnectionBeforePrint() {
    console.log("Vérification connexion avant impression");
    const connectionCheck = document.getElementById('connection-check');
    connectionCheck.style.display = 'flex';
    document.getElementById('connection-message').textContent = 'Koneksyon entènèt ok. Wap kontinye...';
    
    setTimeout(() => {
        connectionCheck.style.display = 'none';
        printTicket();
    }, 1000);
}

function retryConnectionCheck() {
    console.log("Réessayer connexion");
    if (document.getElementById('save-print-ticket').disabled) {
        checkConnectionBeforeSavePrint();
    } else {
        checkConnectionBeforePrint();
    }
}

function cancelPrint() {
    console.log("Annuler impression");
    document.getElementById('connection-check').style.display = 'none';
}

// ==========================================
// 11. Gestion des fiches multi-tirages
// ==========================================
function initMultiDrawPanel() {
    console.log("Initialisation panneau multi-tirages");
    const multiDrawOptions = document.getElementById('multi-draw-options');
    const multiGameSelect = document.getElementById('multi-game-select');
    
    multiDrawOptions.innerHTML = '';
    multiGameSelect.innerHTML = '';
    
    // Options de tirage
    Object.keys(draws).forEach(drawId => {
        const option = document.createElement('div');
        option.className = 'multi-draw-option';
        option.setAttribute('data-draw', drawId);
        option.textContent = draws[drawId].name;
        option.addEventListener('click', function() {
            this.classList.toggle('selected');
            const drawId = this.getAttribute('data-draw');
            if (this.classList.contains('selected')) {
                selectedMultiDraws.add(drawId);
            } else {
                selectedMultiDraws.delete(drawId);
            }
        });
        multiDrawOptions.appendChild(option);
    });
    
    // Options de jeu
    const games = [
        { id: 'borlette', name: 'BORLETTE' },
        { id: 'boulpe', name: 'BOUL PE' },
        { id: 'lotto3', name: 'LOTO 3' },
        { id: 'lotto4', name: 'LOTO 4' },
        { id: 'lotto5', name: 'LOTO 5' },
        { id: 'grap', name: 'GRAP' },
        { id: 'marriage', name: 'MARYAJ' }
    ];
    
    games.forEach(game => {
        const option = document.createElement('div');
        option.className = 'multi-game-option';
        if (game.id === 'borlette') option.classList.add('selected');
        option.setAttribute('data-game', game.id);
        option.textContent = game.name;
        option.addEventListener('click', function() {
            document.querySelectorAll('.multi-game-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedMultiGame = this.getAttribute('data-game');
            updateMultiGameForm(selectedMultiGame);
        });
        multiGameSelect.appendChild(option);
    });
    
    updateMultiGameForm('borlette');
}

function updateMultiGameForm(gameType) {
    const numberInputs = document.getElementById('multi-number-inputs');
    let html = '';
    
    switch(gameType) {
        case 'borlette':
        case 'boulpe':
            html = `<input type="text" id="multi-draw-number" placeholder="00" maxlength="2">`;
            break;
        case 'lotto3':
        case 'grap':
            html = `<input type="text" id="multi-draw-number" placeholder="000" maxlength="3">`;
            break;
        case 'marriage':
            html = `<div class="number-inputs"><input type="text" id="multi-draw-number1" placeholder="00" maxlength="2"><input type="text" id="multi-draw-number2" placeholder="00" maxlength="2"></div>`;
            break;
        case 'lotto4':
            html = `<div class="number-inputs"><input type="text" id="multi-draw-number1" placeholder="00" maxlength="2"><input type="text" id="multi-draw-number2" placeholder="00" maxlength="2"></div>`;
            break;
        case 'lotto5':
            html = `<div class="number-inputs"><input type="text" id="multi-draw-number1" placeholder="000" maxlength="3"><input type="text" id="multi-draw-number2" placeholder="00" maxlength="2"></div>`;
            break;
    }
    numberInputs.innerHTML = html;
}

function addToMultiDrawTicket() {
    const amount = parseInt(document.getElementById('multi-draw-amount').value);
    if (selectedMultiDraws.size === 0) {
        showNotification("Chwazi omwen yon tiraj", "warning");
        return;
    }
    
    let number = '';
    switch(selectedMultiGame) {
        case 'borlette':
        case 'boulpe':
        case 'lotto3':
        case 'grap':
            number = document.getElementById('multi-draw-number').value;
            break;
        case 'marriage':
        case 'lotto4':
        case 'lotto5':
            const n1 = document.getElementById('multi-draw-number1').value;
            const n2 = document.getElementById('multi-draw-number2').value;
            number = `${n1}*${n2}`;
            break;
    }
    
    if (!number || number.length === 0) {
        showNotification("Antre yon nimewo valid", "warning");
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showNotification("Kantite valab obligatwa", "warning");
        return;
    }
    
    const bet = {
        id: Date.now().toString(),
        gameType: selectedMultiGame,
        name: betTypes[selectedMultiGame].name,
        number: number,
        amount: amount,
        multiplier: betTypes[selectedMultiGame].multiplier,
        draws: Array.from(selectedMultiDraws)
    };
    
    currentMultiDrawTicket.bets.push(bet);
    selectedMultiDraws.forEach(d => currentMultiDrawTicket.draws.add(d));
    currentMultiDrawTicket.totalAmount += amount * selectedMultiDraws.size;
    updateMultiDrawTicketDisplay();
    showTotalNotification(currentMultiDrawTicket.totalAmount, 'multi-draw');
    showNotification("Parye ajoute nan fiche multi-tirages!", "success");
}

function updateMultiDrawTicketDisplay() {
    const infoPanel = document.getElementById('current-multi-ticket-info');
    const summary = document.getElementById('multi-ticket-summary');
    
    if (currentMultiDrawTicket.bets.length === 0) {
        infoPanel.style.display = 'none';
        return;
    }
    infoPanel.style.display = 'block';
    
    let summaryHTML = `<div><strong>${currentMultiDrawTicket.bets.length} parye</strong> - ${currentMultiDrawTicket.draws.size} tiraj</div>`;
    currentMultiDrawTicket.bets.forEach(bet => {
        summaryHTML += `<div class="multi-draw-bet-item"><div>${bet.name}: ${bet.number} (${bet.draws.length} tiraj)</div><div>${bet.amount * bet.draws.length} G</div></div>`;
    });
    summaryHTML += `<div style="font-weight:bold; margin-top:10px;">Total: ${currentMultiDrawTicket.totalAmount} G</div>`;
    summary.innerHTML = summaryHTML;
}

function viewCurrentMultiDrawTicket() {
    if (currentMultiDrawTicket.bets.length === 0) {
        showNotification("Fiche multi-tirages vide", "warning");
        return;
    }
    const preview = window.open('', '_blank');
    preview.document.write(`<pre>${JSON.stringify(currentMultiDrawTicket, null, 2)}</pre>`);
}

async function saveAndPrintMultiDrawTicket() {
    if (currentMultiDrawTicket.bets.length === 0) {
        showNotification("Fiche multi-tirages vide", "warning");
        return;
    }
    const ticket = {
        id: currentMultiDrawTicket.id,
        number: multiDrawTickets.length + 1,
        date: new Date().toISOString(),
        bets: currentMultiDrawTicket.bets,
        total: currentMultiDrawTicket.totalAmount,
        draws: Array.from(currentMultiDrawTicket.draws),
        agentName: currentAdmin ? currentAdmin.name : 'Agent'
    };
    await saveMultiDrawTicketAPI(ticket);
    printMultiDrawTicket(ticket);
    currentMultiDrawTicket = { id: Date.now().toString(), bets: [], totalAmount: 0, draws: new Set(), createdAt: new Date().toISOString() };
    updateMultiDrawTicketDisplay();
    await loadMultiDrawTickets();
    showNotification("Fiche multi-tirages sove ak enprime!", "success");
}

function printMultiDrawTicket(ticket) {
    const win = window.open('', '_blank');
    let betsHTML = '';
    ticket.bets.forEach(bet => {
        const betTotal = bet.amount * bet.draws.length;
        betsHTML += `<div><strong>${bet.name}</strong> ${bet.number} (${bet.draws.length} tiraj) - ${betTotal} G</div>`;
    });
    win.document.write(`
        <html><head><title>Fiche Multi-Tirages</title>
        <style>body{font-family:monospace;padding:20px}.ticket{border:2px solid #000;padding:20px}</style>
        </head><body>
        <div class="ticket">
            <h2>${companyInfo.name}</h2>
            <p>Fiche Multi-Tirages #${ticket.number}</p>
            <p>${new Date(ticket.date).toLocaleString()}</p>
            <hr>${betsHTML}<hr>
            <div>Total: ${ticket.total} G</div>
        </div>
        </body></html>
    `);
    win.document.close();
    win.print();
}

function toggleMultiDrawPanel() {
    const content = document.getElementById('multi-draw-content');
    content.classList.toggle('expanded');
    const btn = document.getElementById('multi-draw-toggle');
    btn.innerHTML = content.classList.contains('expanded') ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
}

function openMultiTicketsScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('multi-tickets-screen').style.display = 'block';
    updateMultiTicketsScreen();
}

function updateMultiTicketsScreen() {
    const container = document.getElementById('multi-tickets-list');
    if (multiDrawTickets.length === 0) {
        container.innerHTML = '<p>Pa gen fiche multi-tirages</p>';
        return;
    }
    container.innerHTML = multiDrawTickets.map(t => `
        <div class="multi-ticket-item">
            <strong>Fiche #${t.number}</strong> - ${t.total} G<br>
            ${new Date(t.date).toLocaleString()}
        </div>
    `).join('');
}

// ==========================================
// 12. Vérification des résultats et tickets gagnants
// ==========================================
function openResultsCheckScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('results-check-screen').style.display = 'block';
    updateResultsDisplay();
    document.getElementById('winning-tickets-container').innerHTML = '';
}

async function checkWinningTickets() {
    console.log("Vérification des tickets gagnants...");
    winningTickets = [];
    const allTickets = [...savedTickets, ...pendingSyncTickets];
    
    allTickets.forEach(ticket => {
        const result = resultsDatabase[ticket.draw]?.[ticket.drawTime];
        if (!result) return;
        
        let totalWinnings = 0;
        const winningBets = [];
        
        ticket.bets.forEach(bet => {
            const winInfo = checkBetAgainstResult(bet, result);
            if (winInfo.isWinner) {
                winningBets.push({ ...bet, winAmount: winInfo.winAmount, winType: winInfo.winType });
                totalWinnings += winInfo.winAmount;
            }
        });
        
        if (winningBets.length > 0) {
            winningTickets.push({ ...ticket, winningBets, totalWinnings, result });
        }
    });
    
    displayWinningTickets();
    if (winningTickets.length > 0) {
        showNotification(`${winningTickets.length} fiche gagnant detekte!`, "success");
    } else {
        showNotification("Pa gen fiche genyen pou moman sa", "info");
    }
}

function checkBetAgainstResult(bet, result) {
    const lot1 = result.lot1;
    const lot2 = result.lot2;
    const lot3 = result.lot3;
    const lot1Last2 = lot1.substring(1);
    
    switch(bet.type) {
        case 'borlette':
            if (bet.number === lot1Last2) return { isWinner: true, winAmount: bet.amount * 60, winType: '1er lot' };
            if (bet.number === lot2) return { isWinner: true, winAmount: bet.amount * 20, winType: '2e lot' };
            if (bet.number === lot3) return { isWinner: true, winAmount: bet.amount * 10, winType: '3e lot' };
            break;
        case 'boulpe':
            if (bet.number === lot1Last2) return { isWinner: true, winAmount: bet.amount * 60, winType: '1er lot' };
            if (bet.number === lot2) return { isWinner: true, winAmount: bet.amount * 20, winType: '2e lot' };
            if (bet.number === lot3) return { isWinner: true, winAmount: bet.amount * 10, winType: '3e lot' };
            break;
        case 'lotto3':
            if (bet.number === lot1) return { isWinner: true, winAmount: bet.amount * 500, winType: 'Lotto 3' };
            break;
        case 'marriage':
            const [n1, n2] = bet.number.split('*');
            if ([lot1Last2, lot2, lot3].includes(n1) && [lot1Last2, lot2, lot3].includes(n2)) {
                return { isWinner: true, winAmount: bet.amount * 1000, winType: 'Maryaj' };
            }
            break;
        case 'grap':
            if (lot1[0] === lot1[1] && lot1[1] === lot1[2] && bet.number === lot1) {
                return { isWinner: true, winAmount: bet.amount * 500, winType: 'Grap' };
            }
            break;
        case 'lotto4':
            let winAmount = 0;
            if (bet.options?.option1 && bet.number === lot2 + lot3) winAmount += bet.perOptionAmount * 5000;
            if (bet.options?.option2 && bet.number === lot1.substring(1) + lot2) winAmount += bet.perOptionAmount * 5000;
            if (bet.options?.option3) {
                const digits = bet.number.split('');
                const temp = [...digits];
                let ok = true;
                for (const d of lot2.split('')) { const idx = temp.indexOf(d); if (idx === -1) { ok = false; break; } temp.splice(idx, 1); }
                for (const d of lot3.split('')) { const idx = temp.indexOf(d); if (idx === -1) { ok = false; break; } temp.splice(idx, 1); }
                if (ok) winAmount += bet.perOptionAmount * 5000;
            }
            if (winAmount > 0) return { isWinner: true, winAmount, winType: 'Lotto 4' };
            break;
        case 'lotto5':
            let winAmount5 = 0;
            if (bet.options?.option1 && bet.number === lot1 + lot2) winAmount5 += bet.perOptionAmount * 25000;
            if (bet.options?.option2 && bet.number === lot1 + lot3) winAmount5 += bet.perOptionAmount * 25000;
            if (bet.options?.option3) {
                const allDigits = (lot1 + lot2 + lot3).split('');
                const betDigits = bet.number.split('');
                let ok = true;
                for (const d of betDigits) { const idx = allDigits.indexOf(d); if (idx === -1) { ok = false; break; } allDigits.splice(idx, 1); }
                if (ok) winAmount5 += bet.perOptionAmount * 25000;
            }
            if (winAmount5 > 0) return { isWinner: true, winAmount: winAmount5, winType: 'Lotto 5' };
            break;
    }
    return { isWinner: false, winAmount: 0, winType: '' };
}

function displayWinningTickets() {
    const container = document.getElementById('winning-tickets-container');
    const summary = document.getElementById('winning-summary');
    if (winningTickets.length === 0) {
        container.innerHTML = '<p>Pa gen fiche gagnant</p>';
        summary.innerHTML = '';
        return;
    }
    const totalWinnings = winningTickets.reduce((s, t) => s + t.totalWinnings, 0);
    summary.innerHTML = `<div class="stat-card"><div class="stat-value">${winningTickets.length}</div><div class="stat-label">Fiche Gagnant</div></div>
                         <div class="stat-card"><div class="stat-value">${totalWinnings} G</div><div class="stat-label">Total Gains</div></div>`;
    container.innerHTML = winningTickets.map(t => `
        <div class="winning-ticket">
            <strong>Fiche #${t.number}</strong> - ${t.draw} (${t.drawTime})<br>
            Rezilta: ${t.result.lot1} | ${t.result.lot2} | ${t.result.lot3}<br>
            Gains: ${t.totalWinnings} G
        </div>
    `).join('');
}

// ==========================================
// 13. Historique et gestion des tickets
// ==========================================
function updateHistoryScreen() {
    const historyList = document.getElementById('history-list');
    if (savedTickets.length === 0) {
        historyList.innerHTML = '<p>Pa gen fiche ki sove.</p>';
        return;
    }
    const sorted = [...savedTickets].sort((a, b) => new Date(b.date) - new Date(a.date));
    historyList.innerHTML = sorted.map(ticket => `
        <div class="history-item">
            <div class="history-header">
                <span class="history-draw">#${ticket.number} - ${draws[ticket.draw]?.name} (${ticket.drawTime === 'morning' ? 'Maten' : 'Swè'})</span>
                <span class="history-date">${new Date(ticket.date).toLocaleString()}</span>
            </div>
            <div class="history-total">Total: ${ticket.total} G</div>
        </div>
    `).join('');
}

function updateWinningTicketsScreen() {
    const list = document.getElementById('winning-tickets-list');
    if (winningTickets.length === 0) {
        list.innerHTML = '<p>Pa gen fiche gagnant</p>';
        return;
    }
    list.innerHTML = winningTickets.map(t => `
        <div class="winning-ticket">
            <strong>#${t.number}</strong> - ${t.totalWinnings} G
        </div>
    `).join('');
}

function searchWinningTickets() {
    const term = document.getElementById('search-winning-tickets').value.toLowerCase();
    const filtered = winningTickets.filter(t => t.number.toString().includes(term));
    const list = document.getElementById('winning-tickets-list');
    list.innerHTML = filtered.length ? filtered.map(t => `<div>#${t.number} - ${t.totalWinnings} G</div>`).join('') : '<p>Aucun résultat</p>';
}

function searchHistory() {
    const term = document.getElementById('search-history').value.toLowerCase();
    const filtered = savedTickets.filter(t => t.number.toString().includes(term));
    const list = document.getElementById('history-list');
    list.innerHTML = filtered.length ? filtered.map(t => `<div>#${t.number} - ${t.total} G</div>`).join('') : '<p>Aucun résultat</p>';
}

function updateTicketManagementScreen() {
    const list = document.getElementById('ticket-management-list');
    const allTickets = [...savedTickets, ...pendingSyncTickets];
    if (allTickets.length === 0) {
        list.innerHTML = '<p>Pa gen fiche</p>';
        return;
    }
    list.innerHTML = allTickets.map(t => `
        <div class="ticket-management">
            <strong>#${t.number}</strong> - ${t.total} G - ${new Date(t.date).toLocaleString()}
        </div>
    `).join('');
}

function searchTicket() {
    const term = document.getElementById('search-ticket-number').value.toLowerCase();
    const allTickets = [...savedTickets, ...pendingSyncTickets];
    const filtered = allTickets.filter(t => t.number.toString().includes(term));
    const list = document.getElementById('ticket-management-list');
    list.innerHTML = filtered.length ? filtered.map(t => `<div>#${t.number} - ${t.total} G</div>`).join('') : '<p>Aucun résultat</p>';
}

function showAllTickets() { updateTicketManagementScreen(); }
function showPendingTickets() {
    const list = document.getElementById('ticket-management-list');
    if (pendingSyncTickets.length === 0) {
        list.innerHTML = '<p>Pa gen fiche an attente</p>';
        return;
    }
    list.innerHTML = pendingSyncTickets.map(t => `<div>#${t.number} - ${t.total} G</div>`).join('');
}

function generateEndOfDrawReport() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('report-screen').style.display = 'block';
    const total = savedTickets.reduce((s, t) => s + t.total, 0);
    document.getElementById('report-content').innerHTML = `<h3>Rapò Fin Tiraj</h3><p>Total tickets: ${savedTickets.length}</p><p>Total montant: ${total} G</p>`;
}

// Charger les fiches multi-tirages
async function loadMultiDrawTickets() {
    const res = await apiCall(APP_CONFIG.multiDrawTickets);
    multiDrawTickets = res.tickets || [];
}

// Fonctions de vérification de connexion
function handleLogout() {
    localStorage.removeItem('nova_token');
    window.location.href = '/index.html';
}

// Initialisation des focus automatiques
function setupAutoFocusInputs() {
    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', function() {
            const max = parseInt(this.maxLength);
            if (max && this.value.length >= max) {
                const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
                const idx = inputs.indexOf(this);
                if (idx < inputs.length - 1) inputs[idx + 1].focus();
            }
        });
    });
}