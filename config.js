// ==================== CONFIGURATION GLOBALE ====================
const API_BASE_URL = 'https://lotato-one.onrender.com';
const FIVE_MINUTES = 5 * 60 * 1000;

const APP_CONFIG = {
    health: `${API_BASE_URL}/api/health`,
    login: `${API_BASE_URL}/api/auth/login`,
    results: `${API_BASE_URL}/api/results`,
    checkWinners: `${API_BASE_URL}/api/check-winners`,
    tickets: `${API_BASE_URL}/api/tickets`,
    winningTickets: `${API_BASE_URL}/api/tickets/winning`,
    history: `${API_BASE_URL}/api/history`,
    multiDrawTickets: `${API_BASE_URL}/api/tickets/multi-draw`,
    companyInfo: `${API_BASE_URL}/api/company-info`,
    logo: `${API_BASE_URL}/api/logo`
};

// Types de paris disponibles
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
        multiplier: 60,
        multiplier2: 20,
        multiplier3: 10,
        icon: "fas fa-dice",
        description: "2 chif (1er lot ×60, 2e ×20, 3e ×10)",
        category: "borlette"
    },
    boulpe: {
        name: "BOUL PE",
        multiplier: 60,
        multiplier2: 20,
        multiplier3: 10,
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

// Données des tirages (globales)
const draws = {
    miami: {
        name: "Miami (Florida)",
        times: { morning: "1:30 PM", evening: "9:50 PM" },
        date: "Sam, 29 Nov",
        countdown: "18 h 30 min"
    },
    georgia: {
        name: "Georgia",
        times: { morning: "12:30 PM", evening: "7:00 PM" },
        date: "Sam, 29 Nov",
        countdown: "17 h 29 min"
    },
    newyork: {
        name: "New York",
        times: { morning: "2:30 PM", evening: "8:00 PM" },
        date: "Sam, 29 Nov",
        countdown: "19 h 30 min"
    },
    texas: {
        name: "Texas",
        times: { morning: "12:00 PM", evening: "6:00 PM" },
        date: "Sam, 29 Nov",
        countdown: "18 h 27 min"
    },
    tunisia: {
        name: "Tunisie",
        times: { morning: "10:30 AM", evening: "2:00 PM" },
        date: "Sam, 29 Nov",
        countdown: "8 h 30 min"
    }
};

// Résultats (sera rempli par l'API)
let resultsDatabase = {};

// Informations de l'entreprise (sera chargé depuis l'API)
let companyInfo = {
    name: "Nova Lotto",
    phone: "+509 32 53 49 58",
    address: "Cap Haïtien",
    reportTitle: "Nova Lotto",
    reportPhone: "40104585"
};
let companyLogo = "logo-borlette.jpg";