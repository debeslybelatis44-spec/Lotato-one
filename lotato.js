// ==========================================
// LOTATO - Agent (version finale professionnelle)
// Intègre le CartManager et l'impression thermique
// ==========================================

const API_BASE_URL = '';
let authToken = localStorage.getItem('lotato_token');
let currentUser = null;
let companyInfo = { name: "Lotato", phone: "+509 32 53 49 58", address: "Cap Haïtien", slogan: "Chwazi yon Jwet", logo: "", agentCommission: 10 };
let savedTickets = [];
let winningTickets = [];
let resultsDatabase = {};
let currentDraw = null, currentDrawTime = null;

// ---------- Configuration globale pour CartManager ----------
window.APP_STATE = {
    currentCart: [],
    agentId: null,
    agentName: '',
    selectedDraw: null,
    selectedDraws: new Set(),
    multiDrawMode: false,
    draws: [],
    lotteryConfig: { name: "Lotato", slogan: "Chwazi yon Jwet", logo: "" },
    globalBlockedNumbers: [],
    drawBlockedNumbers: {},
    numberLimits: {},
    isDrawBlocked: false,
    ticketsHistory: []
};

// ---------- Types de jeux ----------
const betTypes = {
    borlette: { name: "BORLETTE", multiplier: 60, category: "borlette", digits: 2 },
    boulpe: { name: "BOUL PE", multiplier: 60, category: "borlette", digits: 2 },
    nx: { name: "NX", multiplier: 60, category: "borlette" },
    lotto3: { name: "LOTO 3", multiplier: 500, category: "lotto", digits: 3 },
    lotto4: { name: "LOTO 4", multiplier: 5000, category: "lotto", digits: 2 },
    lotto5: { name: "LOTO 5", multiplier: 25000, category: "lotto", digits: 3 },
    grap: { name: "GRAP", multiplier: 500, category: "special", digits: 3 },
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
    APP_STATE.lotteryConfig = { name: companyInfo.name, slogan: companyInfo.slogan, logo: companyInfo.logo };
}

// ---------- CartManager (adapté de cartManager.js) ----------
const CartManager = {
    renderCart() {
        const display = document.getElementById('cart-display');
        const totalEl = document.getElementById('cart-total-display');
        const itemsCount = document.getElementById('items-count');
        if (!APP_STATE.currentCart.length) {
            display.innerHTML = '<div class="empty-msg">Panye vid</div>';
            totalEl.innerText = '0 Gdes';
            if (itemsCount) itemsCount.innerText = '0 jwèt';
            return;
        }
        let total = 0;
        let count = 0;
        display.innerHTML = APP_STATE.currentCart.map(bet => {
            total += bet.amount;
            count++;
            const abbr = this.getGameAbbreviation(bet.game, bet);
            let displayNumber = bet.number;
            if (bet.game === 'auto_marriage' && bet.number.includes('&')) displayNumber = bet.number.replace('&', '*');
            return `<div class="cart-item">
                        <span>${abbr} ${displayNumber}</span>
                        <span>${bet.amount} G</span>
                        <button onclick="CartManager.removeBet('${bet.id}')">✕</button>
                    </div>`;
        }).join('');
        totalEl.innerText = total.toLocaleString('fr-FR') + ' Gdes';
        if (itemsCount) itemsCount.innerText = count + ' jwèt';
    },
    removeBet(id) {
        APP_STATE.currentCart = APP_STATE.currentCart.filter(b => b.id != id);
        this.renderCart();
    },
    getGameAbbreviation(gameName, bet) {
        if (bet && bet.free && bet.freeType === 'special_marriage') return 'marg';
        const map = {
            'borlette':'bor', 'lotto3':'lo3', 'lotto4':'lo4', 'lotto5':'lo5',
            'auto_marriage':'mara', 'auto_lotto4':'loa4', 'auto_lotto5':'loa5',
            'mariage':'mar', 'grap':'grap', 'nx':'nx', 'boulpe':'bpe'
        };
        return map[gameName] || gameName;
    },
    addBet(gameType, number, amount, options = null) {
        const bet = betTypes[gameType];
        if (!bet) return false;
        const newBet = {
            id: Date.now() + Math.random(),
            game: gameType,
            name: bet.name,
            number: number,
            cleanNumber: number,
            amount: amount,
            multiplier: bet.multiplier,
            drawId: currentDraw,
            drawName: currentDraw ? draws[currentDraw]?.name : 'Tiraj',
            timestamp: new Date().toISOString()
        };
        if (options) newBet.options = options;
        APP_STATE.currentCart.push(newBet);
        this.renderCart();
        return true;
    }
};

// ---------- Impression ticket (inspirée de cartManager) ----------
async function saveAndPrintTicket() {
    if (!APP_STATE.currentCart.length) { showNotification("Panye vid", "warning"); return; }
    if (!currentDraw || !currentDrawTime) { showNotification("Chwazi yon tiraj anvan", "warning"); return; }

    const ticket = {
        draw: currentDraw,
        draw_time: currentDrawTime,
        bets: APP_STATE.currentCart.map(b => ({ type: b.game, number: b.number, amount: b.amount, multiplier: b.multiplier })),
        total: APP_STATE.currentCart.reduce((s,b)=>s+b.amount,0)
    };
    const res = await apiCall('/api/tickets', 'POST', { ticket });
    if (res?.success) {
        showNotification(`Fiche #${res.ticketNumber} sove!`, "success");
        await loadMyTickets();
        printThermalTicket(res.ticket);
        APP_STATE.currentCart = [];
        CartManager.renderCart();
        closeBettingScreen();
    }
}

function printThermalTicket(ticket) {
    const win = window.open('', '_blank', 'width=500,height=700');
    if (!win) { alert("Veuillez autoriser les pop-ups"); return; }
    const logoHtml = companyInfo.logo ? `<img src="${companyInfo.logo}" style="max-width:80px;">` : '';
    const drawName = draws[currentDraw]?.name || 'Tiraj';
    const formattedDate = new Date().toLocaleString('fr-FR');
    const betsHtml = ticket.bets.map(b => `<div class="bet-row"><span>${CartManager.getGameAbbreviation(b.type)} ${b.number}</span><span>${b.amount} G</span></div>`).join('');
    const total = ticket.total;
    win.document.write(`
        <!DOCTYPE html>
        <html><head><title>Ticket</title>
        <style>
            @page { size: 80mm auto; margin: 2mm; }
            body { font-family: 'Courier New', monospace; width: 76mm; margin: 0 auto; padding: 4mm; background: white; }
            .header { text-align: center; border-bottom: 2px dashed #000; }
            .header img { max-height: 60px; }
            .bet-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 12pt; }
            .total-row { display: flex; justify-content: space-between; margin-top: 8px; font-weight: bold; font-size: 14pt; }
            .footer { text-align: center; margin-top: 12px; font-size: 10pt; }
        </style>
        </head><body>
        <div class="header">
            ${logoHtml}<strong>${companyInfo.name}</strong><br><small>${companyInfo.slogan}</small>
        </div>
        <div class="info">Ticket #${ticket.ticket_number}<br>Tiraj: ${drawName}<br>Date: ${formattedDate}</div>
        <hr>${betsHtml}<hr>
        <div class="total-row"><span>TOTAL</span><span>${total} Gdes</span></div>
        <div class="footer">tickets valable 90j<br>${companyInfo.address}</div>
        </body></html>
    `);
    win.document.close();
    win.print();
}

// ---------- AFFICHAGE DES JEUX PAR CATÉGORIE ----------
function showGamesPanel(category) {
    const panel = document.getElementById('games-panel');
    const gamesList = {
        borlette: [
            { id: 'borlette', name: 'BORLETTE', desc: '2 chif - 1er ×60, 2e ×20, 3e ×10', multiplier: 'x60' },
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

// ---------- FORMULAIRE DE PARI (saisie simple + ajout groupé) ----------
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
    const maxLen = bet.digits || 2;
    numberInput.maxLength = maxLen;
    numberInput.placeholder = "0".repeat(maxLen);
    numberInput.focus();

    // Réinitialiser le formulaire pour marriage / lotto4/5
    const inlineDiv = document.querySelector('.inline-form');
    if (gameType === 'marriage') {
        inlineDiv.innerHTML = `<input type="text" id="bet-number1" placeholder="00" maxlength="2" style="flex:1">
                               <input type="text" id="bet-number2" placeholder="00" maxlength="2" style="flex:1">
                               <input type="number" id="bet-amount" placeholder="Montan" value="1" style="flex:1">
                               <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;
        const n1 = document.getElementById('bet-number1');
        const n2 = document.getElementById('bet-number2');
        n1.addEventListener('input', () => { if (n1.value.length === 2) n2.focus(); });
        n2.addEventListener('input', () => { if (n2.value.length === 2) document.getElementById('bet-amount').focus(); });
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        const digits = gameType === 'lotto4' ? 2 : 3;
        inlineDiv.innerHTML = `<input type="text" id="bet-number1" placeholder="${'0'.repeat(digits)}" maxlength="${digits}" style="flex:1">
                               <input type="text" id="bet-number2" placeholder="00" maxlength="2" style="flex:1">
                               <input type="number" id="bet-amount" placeholder="Montan pa opsyon" value="1" style="flex:1">
                               <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;
        const n1 = document.getElementById('bet-number1');
        const n2 = document.getElementById('bet-number2');
        n1.addEventListener('input', () => { if (n1.value.length === digits) n2.focus(); });
        n2.addEventListener('input', () => { if (n2.value.length === 2) document.getElementById('bet-amount').focus(); });
    } else if (gameType === 'nx') {
        inlineDiv.innerHTML = `<div style="display:grid; grid-template-columns:repeat(5,1fr); gap:6px; width:100%;">
                                ${[...Array(10)].map((_,i)=>`<button type="button" class="nx-ball" data-n="${i}">N${i}</button>`).join('')}
                               </div>
                               <input type="number" id="bet-amount" placeholder="Montan" value="1" style="flex:1">
                               <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;
        document.querySelectorAll('.nx-ball').forEach(btn => {
            btn.onclick = () => {
                const n = btn.dataset.n;
                const amount = parseInt(document.getElementById('bet-amount').value);
                if (isNaN(amount)) return;
                for (let t=0; t<=9; t++) {
                    const num = t.toString() + n.toString();
                    CartManager.addBet('borlette', num, amount);
                }
                showNotification(`10 boule N${n} ajoute`, "success");
            };
        });
        document.getElementById('add-bet-btn').onclick = () => showNotification("Chwazi yon bouton Nx", "info");
        return;
    } else {
        inlineDiv.innerHTML = `<input type="text" id="bet-number" placeholder="Nimewo" maxlength="${maxLen}" style="flex:2">
                               <input type="number" id="bet-amount" placeholder="Montan" value="1" min="1" style="flex:1">
                               <button id="add-bet-btn" class="add-icon"><i class="fas fa-check"></i></button>`;
        const numInput = document.getElementById('bet-number');
        numInput.addEventListener('input', () => {
            if (numInput.value.length === maxLen) document.getElementById('bet-amount').focus();
        });
    }
    document.getElementById('add-bet-btn').onclick = () => addBet();
    // Ajout groupé
    document.getElementById('toggle-bulk').onclick = () => {
        const div = document.getElementById('bulk-input-group');
        div.style.display = div.style.display === 'none' ? 'block' : 'none';
    };
    document.getElementById('bulk-add-btn').onclick = () => addMultipleBets();
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
        CartManager.addBet('marriage', `${n1}*${n2}`, amount);
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
        const totalAmount = perAmount * 3; // 3 options
        CartManager.addBet(gameType, n1+n2, totalAmount);
        showNotification("Ajoute!", "success");
        document.getElementById('bet-number1').value = '';
        document.getElementById('bet-number2').value = '';
        document.getElementById('bet-number1').focus();
        return;
    }
    const number = document.getElementById('bet-number').value.trim();
    const amount = parseInt(document.getElementById('bet-amount').value);
    let isValid = false;
    if (gameType === 'borlette' || gameType === 'boulpe') isValid = /^\d{2}$/.test(number);
    else if (gameType === 'lotto3' || gameType === 'grap') isValid = /^\d{3}$/.test(number);
    else return;
    if (!isValid) return showNotification("Nimewo pa valid", "warning");
    if (isNaN(amount) || amount <= 0) return showNotification("Montan valid", "warning");
    CartManager.addBet(gameType, number, amount);
    showNotification("Ajoute!", "success");
    document.getElementById('bet-number').value = '';
    document.getElementById('bet-number').focus();
}

function addMultipleBets() {
    const raw = document.getElementById('bulk-numbers').value;
    const numbers = raw.split(/[\s,]+/).filter(n => /^\d{2,3}$/.test(n));
    if (!numbers.length) return showNotification("Antre omwen yon nimewo valid", "warning");
    const amount = parseInt(document.getElementById('bet-amount').value);
    if (isNaN(amount)) return showNotification("Montan invalid", "warning");
    numbers.forEach(num => CartManager.addBet(currentGameType, num, amount));
    showNotification(`${numbers.length} parye ajoute`, "success");
    document.getElementById('bulk-numbers').value = '';
    document.getElementById('bulk-input-group').style.display = 'none';
}

// ---------- OUVERTURE / FERMETURE ÉCRAN PARI ----------
function openBettingScreen(drawId, time) {
    currentDraw = drawId;
    currentDrawTime = time;
    const draw = draws[drawId];
    document.getElementById('betting-title').innerHTML = `${draw.name} (${time === 'morning' ? 'Maten' : 'Swè'})`;
    document.querySelector('.container').style.display = 'none';
    document.getElementById('betting-screen').style.display = 'block';
    document.querySelectorAll('.game-category-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.game-category-btn[data-category="borlette"]').classList.add('active');
    showGamesPanel('borlette');
    document.getElementById('bet-form').style.display = 'none';
    CartManager.renderCart();
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
    APP_STATE.agentId = currentUser.id;
    APP_STATE.agentName = currentUser.name;
    await loadSettings();
    await loadResults();
    await loadMyTickets();
    await loadWinningTickets();
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
    setupEventListeners();
    CartManager.renderCart();
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
    document.getElementById('open-multi-tickets').addEventListener('click', async () => {
        document.querySelector('.container').style.display = 'none';
        document.getElementById('multi-tickets-screen').style.display = 'block';
        const res = await apiCall('/api/tickets/multi-draw');
        const list = document.getElementById('multi-tickets-list');
        if (res?.success && res.tickets.length) list.innerHTML = res.tickets.map(t => `<div class="multi-ticket-item">Fiche #${t.id} - ${t.total} G</div>`).join('');
        else list.innerHTML = '<p>Pa gen fiche multi-tirages</p>';
    });
    document.getElementById('back-from-multi-tickets').addEventListener('click', () => {
        document.getElementById('multi-tickets-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    document.getElementById('logout-btn').addEventListener('click', logout);
}