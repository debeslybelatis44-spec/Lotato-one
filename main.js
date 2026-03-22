// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("Document chargé, initialisation...");
    if (!checkAuth()) return;
    showMainApp();
    updateCurrentTime();
    loadTicketsFromAPI();
    loadResultsFromDatabase();
    loadCompanyInfo();
    setupEventListeners();
    setupConnectionDetection();
    updateLogoDisplay();
    setInterval(updateCurrentTime, 60000);
    setInterval(checkForNewResults, 300000);
    console.log("Initialisation terminée");
});

function setupEventListeners() {
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
    document.getElementById('search-history-btn').addEventListener('click', () => searchHistory());
    document.getElementById('search-winning-btn').addEventListener('click', () => searchWinningTickets());
    initMultiDrawPanel();
}

async function loadCompanyInfo() {
    try {
        const data = await apiCall(APP_CONFIG.companyInfo);
        if (data) companyInfo = data;
        const logoData = await apiCall(APP_CONFIG.logo);
        if (logoData && logoData.logoUrl) companyLogo = logoData.logoUrl;
        updateLogoDisplay();
    } catch(e) { console.error(e); }
}