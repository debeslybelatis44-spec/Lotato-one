// ==========================================
// LOTATO - Agent (version finale intégrale)
// ==========================================

const API_BASE_URL = '';
let authToken = localStorage.getItem('lotato_token');
let currentUser = null;
let companyInfo = { name: "Lotato", phone: "+509 32 53 49 58", address: "Cap Haïtien", slogan: "Chwazi yon Jwet", logo: "", agentCommission: 10 };
let savedTickets = [];
let winningTickets = [];
let resultsDatabase = {};
let currentDraw = null, currentDrawTime = null;

// Panier
let APP_STATE = { currentCart: [] };

// Types de jeux
const betTypes = {
    borlette: { name: "BORLETTE", multiplier: 60, category: "borlette" },
    boulpe: { name: "BOUL PE", multiplier: 60, category: "borlette" },
    nx: { name: "NX", multiplier: 60, category: "borlette" },
    lotto3: { name: "LOTO 3", multiplier: 500, category: "lotto" },
    lotto4: { name: "LOTO 4", multiplier: 5000, category: "lotto" },
    lotto5: { name: "LOTO 5", multiplier: 25000, category: "lotto" },
    grap: { name: "GRAP", multiplier: 500, category: "special" },
    marriage: { name: "MARYAJ", multiplier: 1000, category: "special" },
    'auto-marriage': { name: "MARYAJ OTOMATIK", multiplier: 1000, category: "special" },
    'auto-lotto4': { name: "LOTO 4 OTOMATIK", multiplier: 5000, category: "special" }
};

const draws = {
    miami: { name: "Miami", times: { morning: "1:30 PM", evening: "9:50 PM" } },
    georgia: { name: "Georgia", times: { morning: "12:30 PM", evening: "7:00 PM" } },
    newyork: { name: "New York", times: { morning: "2:30 PM", evening: "8:00 PM" } },
    texas: { name: "Texas", times: { morning: "12:00 PM", evening: "6:00 PM" } },
    tunisia: { name: "Tunisie", times: { morning: "10:30 AM", evening: "2:00 PM" } }
};

// ---------- API ----------
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
    } catch(e) { showNotification('Erreur connexion', 'error'); return null; }
}
function logout() { localStorage.removeItem('lotato_token'); window.location.href = '/index.html'; }
function showNotification(msg, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'info'}-circle"></i> ${msg}`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}
async function loadMyTickets() { const res = await apiCall('/api/tickets'); if (res?.success) savedTickets = res.tickets; }
async function loadWinningTickets() { const res = await apiCall('/api/tickets/winning'); if (res?.success) winningTickets = res.tickets; }
async function loadResults() { const res = await apiCall('/api/results'); if (res?.success) resultsDatabase = res.results; }
async function loadSettings() {
    const res = await apiCall('/api/settings');
    if (res?.success) {
        const s = res.settings;
        if (s.company_name) companyInfo.name = s.company_name;
        if (s.company_slogan) companyInfo.slogan = s.company_slogan;
        if (s.company_logo) companyInfo.logo = s.company_logo;
        if (s.agent_commission) companyInfo.agentCommission = parseFloat(s.agent_commission);
        updateCompanyDisplay();
    }
}
function updateCompanyDisplay() {
    document.getElementById('company-name').innerText = companyInfo.name;
    document.getElementById('company-slogan').innerText = companyInfo.slogan;
    if (companyInfo.logo) document.getElementById('company-logo').src = companyInfo.logo;
}

// ---------- PANIER ----------
function renderCart() {
    const container = document.getElementById('bets-list');
    const totalEl = document.getElementById('bet-total');
    let total = 0;
    if (!APP_STATE.currentCart.length) {
        container.innerHTML = '<p>Pa gen parye aktif.</p>';
        totalEl.innerText = '0 goud';
        return;
    }
    container.innerHTML = APP_STATE.currentCart.map(bet => {
        total += bet.amount;
        return `<div class="bet-item">
                    <div><strong>${bet.name}</strong><br>${bet.number}</div>
                    <div>${bet.amount} goud <span class="bet-remove" data-id="${bet.id}"><i class="fas fa-times"></i></span></div>
                </div>`;
    }).join('');
    totalEl.innerText = total + ' goud';
    document.querySelectorAll('.bet-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseFloat(btn.dataset.id);
            APP_STATE.currentCart = APP_STATE.currentCart.filter(b => b.id !== id);
            renderCart();
        });
    });
}
function addToCart(bet) {
    APP_STATE.currentCart.push(bet);
    renderCart();
}

// ---------- SAUVEGARDE TICKET ----------
async function saveAndPrintTicket() {
    if (!APP_STATE.currentCart.length) { showNotification("Pa gen parye", "warning"); return; }
    if (!currentDraw || !currentDrawTime) { showNotification("Chwazi yon tiraj anvan", "warning"); return; }
    const ticket = {
        draw: currentDraw,
        draw_time: currentDrawTime,
        bets: APP_STATE.currentCart.map(b => ({ type: b.type, number: b.number, amount: b.amount, multiplier: b.multiplier })),
        total: APP_STATE.currentCart.reduce((s,b)=>s+b.amount,0)
    };
    const res = await apiCall('/api/tickets', 'POST', { ticket });
    if (res?.success) {
        showNotification(`Fiche #${res.ticketNumber} sove!`, "success");
        await loadMyTickets();
        printTicket(res.ticketId, res.ticketNumber);
        APP_STATE.currentCart = [];
        renderCart();
        closeBettingScreen();
    }
}
function printTicket(ticketId, ticketNumber) {
    const ticket = savedTickets.find(t => t.ticket_number == ticketNumber);
    if (!ticket) return;
    const win = window.open('', '_blank');
    const logoHtml = companyInfo.logo ? `<img src="${companyInfo.logo}" style="max-width:80px;">` : '';
    win.document.write(`
        <html><head><title>Ticket ${ticketNumber}</title>
        <style>body{font-family:monospace;padding:20px;text-align:center}.ticket{border:2px solid #000;padding:20px;max-width:400px;margin:auto}</style>
        </head><body><div class="ticket">
        ${logoHtml}<h2>${companyInfo.name}</h2><div>${companyInfo.slogan}</div>
        <p>Ticket #${ticketNumber}</p><p>${new Date(ticket.created_at).toLocaleString()}</p><hr>
        ${ticket.bets.map(b => `<div>${b.bet_type}: ${b.numbers} - ${b.amount} G</div>`).join('')}<hr>
        <div class="total">Total: ${ticket.total_amount} G</div>
        </div></body></html>
    `);
    win.document.close();
    win.print();
}

// ---------- AFFICHAGE DES JEUX ----------
function showGamesPanel(category) {
    const panel = document.getElementById('games-panel');
    const gamesList = {
        borlette: [
            { id: 'borlette', name: 'BORLETTE', desc: '2 chif - 1er lot ×60, 2e ×20, 3e ×10', multiplier: 'x60' },
            { id: 'boulpe', name: 'BOUL PE', desc: 'Boul pe (00-99)', multiplier: 'x60' },
            { id: 'nx', name: 'NX (Boul N0-N9)', desc: '10 boule Nx', multiplier: 'x60' }
        ],
        lotto: [
            { id: 'lotto3', name: 'LOTO 3', desc: '3 chif', multiplier: 'x500' },
            { id: 'lotto4', name: 'LOTO 4', desc: '4 chif - 3 opsyon', multiplier: 'x5000' },
            { id: 'lotto5', name: 'LOTO 5', desc: '5 chif - 3 opsyon', multiplier: 'x25000' }
        ],
        special: [
            { id: 'grap', name: 'GRAP', desc: 'Boule paire', multiplier: 'x500' },
            { id: 'marriage', name: 'MARYAJ', desc: 'Maryaj 2 chif', multiplier: 'x1000' },
            { id: 'auto-marriage', name: 'MARYAJ OTOMATIK', desc: 'Otomatik', multiplier: 'x1000' },
            { id: 'auto-lotto4', name: 'LOTO 4 OTOMATIK', desc: 'Otomatik', multiplier: 'x5000' }
        ]
    };
    const games = gamesList[category];
    if (!games) return;
    panel.innerHTML = `<div class="game-category-grid">${games.map(g => `
        <div class="game-item" data-game="${g.id}">
            <div class="game-name">${g.name}</div>
            <div class="game-multiplier">${g.multiplier}</div>
            <small>${g.desc}</small>
        </div>`).join('')}</div>`;
    panel.style.display = 'block';
    document.querySelectorAll('#games-panel .game-item').forEach(el => {
        el.addEventListener('click', () => showBetForm(el.dataset.game));
    });
}

// ---------- FORMULAIRE SIMPLE ----------
let currentGameType = null;
function showBetForm(gameType) {
    currentGameType = gameType;
    const bet = betTypes[gameType];
    document.getElementById('games-panel').style.display = 'none';
    const formDiv = document.getElementById('bet-form');
    formDiv.style.display = 'block';
    document.getElementById('bet-form-label').innerText = bet.name + " - Nimewo";
    const numberInput = document.getElementById('bet-number');
    const amountInput = document.getElementById('bet-amount');
    numberInput.value = '';
    amountInput.value = '1';
    const maxLen = (gameType === 'lotto3' || gameType === 'grap') ? 3 : 2;
    numberInput.maxLength = maxLen;
    numberInput.placeholder = "Eg: " + "0".repeat(maxLen);
    numberInput.focus();

    // Réinitialiser le contenu du formulaire si besoin (cas marriage, lotto4/5)
    const inlineDiv = document.querySelector('.inline-form');
    // On remet la structure simple par défaut
    inlineDiv.innerHTML = `<input type="text" id="bet-number" placeholder="Nimewo" maxlength="${maxLen}" style="flex:2">
                           <input type="number" id="bet-amount" placeholder="Montan" value="1" min="1" style="flex:1">
                           <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;

    if (gameType === 'marriage') {
        inlineDiv.innerHTML = `<input type="text" id="bet-number1" placeholder="00" maxlength="2" style="flex:1">
                               <input type="text" id="bet-number2" placeholder="00" maxlength="2" style="flex:1">
                               <input type="number" id="bet-amount" placeholder="Montan" value="1" min="1" style="flex:1">
                               <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;
        const n1 = document.getElementById('bet-number1');
        const n2 = document.getElementById('bet-number2');
        n1.addEventListener('input', () => { if (n1.value.length === 2) n2.focus(); });
        n2.addEventListener('input', () => { if (n2.value.length === 2) document.getElementById('bet-amount').focus(); });
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        const digits = (gameType === 'lotto4') ? 2 : 3;
        inlineDiv.innerHTML = `<input type="text" id="bet-number1" placeholder="${'0'.repeat(digits)}" maxlength="${digits}" style="flex:1">
                               <input type="text" id="bet-number2" placeholder="00" maxlength="2" style="flex:1">
                               <input type="number" id="bet-amount" placeholder="Montan pa opsyon" value="1" min="1" style="flex:1">
                               <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;
        const n1 = document.getElementById('bet-number1');
        const n2 = document.getElementById('bet-number2');
        n1.addEventListener('input', () => { if (n1.value.length === digits) n2.focus(); });
        n2.addEventListener('input', () => { if (n2.value.length === 2) document.getElementById('bet-amount').focus(); });
    } else if (gameType === 'nx') {
        inlineDiv.innerHTML = `<div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px; width:100%;">
                                ${[...Array(10)].map((_,i)=>`<button type="button" class="nx-ball" data-n="${i}">N${i}</button>`).join('')}
                               </div>
                               <input type="number" id="bet-amount" placeholder="Montan" value="1" style="flex:1">
                               <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;
        document.querySelectorAll('.nx-ball').forEach(btn => {
            btn.onclick = () => {
                const n = btn.dataset.n;
                const amount = parseInt(document.getElementById('bet-amount').value);
                if (isNaN(amount)) return;
                for (let tens=0; tens<=9; tens++) {
                    const num = tens.toString() + n.toString();
                    addToCart({ id: Date.now()+Math.random(), type: 'borlette', name: `NX N${n}`, number: num, amount, multiplier: 60 });
                }
                showNotification(`10 boule N${n} ajoute`, "success");
            };
        });
        document.getElementById('add-bet-btn').onclick = () => showNotification("Chwazi yon bouton Nx", "info");
        return;
    } else {
        // auto-tabulation standard
        const newNumInput = document.getElementById('bet-number');
        newNumInput.addEventListener('input', () => {
            if (newNumInput.value.length === maxLen) {
                document.getElementById('bet-amount').focus();
            }
        });
    }
    document.getElementById('add-bet-btn').onclick = () => addBet();
}
function addBet() {
    const gameType = currentGameType;
    const bet = betTypes[gameType];
    if (!bet) return;

    if (gameType === 'marriage') {
        const n1 = document.getElementById('bet-number1').value;
        const n2 = document.getElementById('bet-number2').value;
        const amount = parseInt(document.getElementById('bet-amount').value);
        if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) return showNotification("Chak chif dwe 2 chif", "warning");
        addToCart({ id: Date.now()+Math.random(), type: 'marriage', name: 'MARYAJ', number: `${n1}*${n2}`, amount, multiplier: 1000 });
        showNotification("Ajoute!", "success");
        document.getElementById('bet-number1').value = '';
        document.getElementById('bet-number2').value = '';
        document.getElementById('bet-number1').focus();
        return;
    }
    if (gameType === 'lotto4' || gameType === 'lotto5') {
        const n1 = document.getElementById('bet-number1').value;
        const n2 = document.getElementById('bet-number2').value;
        const perAmount = parseInt(document.getElementById('bet-amount').value);
        if (!n1 || !n2) return showNotification("Antre tout nimewo", "warning");
        const totalAmount = perAmount * 3; // 3 options par défaut
        addToCart({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number: n1+n2, amount: totalAmount, multiplier: bet.multiplier });
        showNotification("Ajoute!", "success");
        document.getElementById('bet-number1').value = '';
        document.getElementById('bet-number2').value = '';
        document.getElementById('bet-number1').focus();
        return;
    }
    // Cas simple
    const number = document.getElementById('bet-number').value.trim();
    const amount = parseInt(document.getElementById('bet-amount').value);
    let isValid = false;
    if (gameType === 'borlette' || gameType === 'boulpe') isValid = /^\d{2}$/.test(number);
    else if (gameType === 'lotto3' || gameType === 'grap') isValid = /^\d{3}$/.test(number);
    else if (gameType === 'auto-marriage' || gameType === 'auto-lotto4') return; // pas ici
    if (!isValid) return showNotification("Nimewo pa valid", "warning");
    if (isNaN(amount) || amount <= 0) return showNotification("Montan valid", "warning");
    addToCart({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number, amount, multiplier: bet.multiplier });
    showNotification("Ajoute!", "success");
    document.getElementById('bet-number').value = '';
    document.getElementById('bet-number').focus();
}

// ---------- OUVERTURE / FERMETURE ÉCRAN PARI ----------
function openBettingScreen(drawId, time) {
    currentDraw = drawId;
    currentDrawTime = time;
    const draw = draws[drawId];
    document.getElementById('betting-title').innerHTML = `${draw.name} (${time === 'morning' ? 'Maten' : 'Swè'})`;
    document.querySelector('.container').style.display = 'none';
    document.getElementById('betting-screen').style.display = 'block';
    // Afficher Borlette par défaut
    document.querySelectorAll('.game-category-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.game-category-btn[data-category="borlette"]').classList.add('active');
    showGamesPanel('borlette');
    document.getElementById('bet-form').style.display = 'none';
    renderCart();
}
function closeBettingScreen() {
    document.getElementById('betting-screen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    currentDraw = null;
    currentDrawTime = null;
}
document.getElementById('back-button').addEventListener('click', closeBettingScreen);
document.getElementById('close-form-btn').addEventListener('click', () => {
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('games-panel').style.display = 'block';
});

// ---------- RAPPORTS ----------
async function loadReportData(drawId, start, end) {
    let filtered = savedTickets.filter(t => new Date(t.created_at) >= start && new Date(t.created_at) <= end);
    if (drawId !== 'all') filtered = filtered.filter(t => t.draw === drawId);
    const totalSales = filtered.reduce((s,t)=>s+t.total_amount,0);
    const commission = totalSales * (companyInfo.agentCommission/100);
    const payouts = filtered.filter(t=>t.winning_amount).reduce((s,t)=>s+(t.winning_amount||0),0);
    document.getElementById('total-sales').innerText = totalSales + ' G';
    document.getElementById('commission-rate').innerText = companyInfo.agentCommission + '%';
    document.getElementById('commission-earned').innerText = commission.toFixed(2) + ' G';
    document.getElementById('total-payouts').innerText = payouts + ' G';
    document.getElementById('net-profit').innerText = (totalSales - payouts) + ' G';
    const detailDiv = document.getElementById('report-detail-list');
    if (drawId === 'all') {
        const drawStats = {};
        filtered.forEach(t => { drawStats[t.draw] = (drawStats[t.draw]||0) + t.total_amount; });
        detailDiv.innerHTML = Object.entries(drawStats).map(([d,a]) => `<div class="report-detail-item"><span>${d}</span><span>${a} G</span></div>`).join('');
    } else {
        detailDiv.innerHTML = `<div class="report-detail-item"><span>Total ${drawId}</span><span>${totalSales} G</span></div>`;
    }
}
function printReport() {
    const stats = document.getElementById('report-stats').cloneNode(true);
    const detail = document.getElementById('report-detail-list').cloneNode(true);
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Rapò</title><style>body{font-family:sans-serif;padding:20px}</style></head><body>${stats.outerHTML}${detail.outerHTML}</body></html>`);
    win.document.close();
    win.print();
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
    const drawId = document.getElementById('report-draw-select').value;
    loadReportData(drawId, start, end);
}

// ---------- AUTRES ÉCRANS ----------
function updateHistoryScreen() {
    const list = document.getElementById('history-list');
    list.innerHTML = savedTickets.length ? savedTickets.map(t => `<div class="ticket-item"><strong>#${t.ticket_number}</strong> - ${t.total_amount} G (${new Date(t.created_at).toLocaleString()})</div>`).join('') : '<p>Pa gen fich</p>';
}
function updateWinningTicketsScreen() {
    const list = document.getElementById('winning-tickets-list');
    list.innerHTML = winningTickets.length ? winningTickets.map(w => `<div class="winning-ticket"><strong>#${w.ticket_number}</strong> - ${w.winning_amount} G</div>`).join('') : '<p>Pa gen fiche gagnant</p>';
}
function openResultsCheckScreen() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('results-check-screen').style.display = 'block';
    const latestDiv = document.getElementById('latest-results');
    latestDiv.innerHTML = '';
    for (const [drawId, draw] of Object.entries(draws)) {
        for (const [time, label] of Object.entries(draw.times)) {
            const r = resultsDatabase[drawId]?.[time];
            if (r) latestDiv.innerHTML += `<div><strong>${draw.name} ${time}</strong> : ${r.lot1} | ${r.lot2} | ${r.lot3}</div>`;
        }
    }
}
async function checkWinningTickets() {
    const res = await apiCall('/api/tickets/winning');
    const container = document.getElementById('winning-tickets-container');
    if (res?.success && res.tickets.length) container.innerHTML = res.tickets.map(w => `<div class="winning-ticket"><strong>#${w.ticket_number}</strong> - ${w.winning_amount} HTG</div>`).join('');
    else container.innerHTML = '<p>Pa gen fiche gagnant</p>';
}
function showScreen(screenId) {
    document.querySelectorAll('.screen, .results-check-screen, .multi-tickets-screen, .container, .betting-screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (screenId === 'home') document.querySelector('.container').style.display = 'block';
    else {
        const screen = document.getElementById(screenId + '-screen');
        if (screen) {
            screen.style.display = 'block';
            if (screenId === 'report') loadReportByPeriod('15days');
            else if (screenId === 'history') updateHistoryScreen();
            else if (screenId === 'winning-tickets') updateWinningTicketsScreen();
        }
    }
}

// ---------- INITIALISATION ----------
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('lotato_token');
    if (!token) { window.location.href = '/index.html'; return; }
    const check = await apiCall('/api/auth/check');
    if (!check?.success) { logout(); return; }
    currentUser = check.user;
    await loadSettings();
    await loadResults();
    await loadMyTickets();
    await loadWinningTickets();
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
    setupEventListeners();
    renderCart();
});
function updateCurrentTime() {
    const now = new Date();
    document.getElementById('current-time').innerText = now.toLocaleDateString('fr-FR') + ' - ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}
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
    document.querySelectorAll('.game-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.game-category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showGamesPanel(btn.dataset.category);
            document.getElementById('bet-form').style.display = 'none';
        });
    });
    document.getElementById('save-print-ticket').addEventListener('click', saveAndPrintTicket);
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => showScreen(item.dataset.screen)));
    document.querySelectorAll('.back-button[data-screen]').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));
    // Rapport
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadReportByPeriod(btn.dataset.period);
        });
    });
    document.getElementById('apply-custom').addEventListener('click', () => {
        const start = new Date(document.getElementById('start-date').value);
        const end = new Date(document.getElementById('end-date').value);
        end.setHours(23,59,59);
        const drawId = document.getElementById('report-draw-select').value;
        loadReportData(drawId, start, end);
    });
    document.getElementById('print-report-btn').addEventListener('click', printReport);
    document.getElementById('report-draw-select').addEventListener('change', () => {
        const start = new Date(document.getElementById('start-date').value);
        const end = new Date(document.getElementById('end-date').value);
        end.setHours(23,59,59);
        const drawId = document.getElementById('report-draw-select').value;
        loadReportData(drawId, start, end);
    });
    document.getElementById('open-results-check').addEventListener('click', openResultsCheckScreen);
    document.getElementById('check-winners-btn').addEventListener('click', checkWinningTickets);
    document.getElementById('back-from-results').addEventListener('click', () => {
        document.getElementById('results-check-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    // Multi-tickets (simple affichage)
    document.getElementById('open-multi-tickets').addEventListener('click', async () => {
        document.querySelector('.container').style.display = 'none';
        document.getElementById('multi-tickets-screen').style.display = 'block';
        const res = await apiCall('/api/tickets/multi-draw');
        const list = document.getElementById('multi-tickets-list');
        if (res?.success && res.tickets.length) {
            list.innerHTML = res.tickets.map(t => `<div class="multi-ticket-item">Fiche #${t.id} - ${t.total} G</div>`).join('');
        } else {
            list.innerHTML = '<p>Pa gen fiche multi-tirages</p>';
        }
    });
    document.getElementById('back-from-multi-tickets').addEventListener('click', () => {
        document.getElementById('multi-tickets-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    document.getElementById('logout-btn').addEventListener('click', logout);
}