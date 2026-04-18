// ==========================================
// LOTATO - Interface Agent (Version Complète)
// ==========================================

const API_BASE_URL = '';
let authToken = localStorage.getItem('lotato_token');
let currentUser = null;

let companyInfo = { name: "Lotato", phone: "+509 32 53 49 58", address: "Cap Haïtien", slogan: "Chwazi yon Jwet", logo: "", agentCommission: 10 };
let savedTickets = [];
let winningTickets = [];
let resultsDatabase = {};
let currentDraw = null, currentDrawTime = null;

// Panier central
let APP_STATE = {
    currentCart: [],
    lotteryConfig: { name: "Lotato", slogan: "Chwazi yon Jwet", logo: "" }
};

const betTypes = {
    borlette: { name: "BORLETTE", multiplier: 60, multiplier2: 20, multiplier3: 10, category: "borlette" },
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

function logout() {
    localStorage.removeItem('lotato_token');
    window.location.href = '/index.html';
}

function showNotification(msg, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'info'}-circle"></i> ${msg}`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

async function loadMyTickets() {
    const res = await apiCall('/api/tickets');
    if (res?.success) savedTickets = res.tickets;
}
async function loadWinningTickets() {
    const res = await apiCall('/api/tickets/winning');
    if (res?.success) winningTickets = res.tickets;
}
async function loadResults() {
    const res = await apiCall('/api/results');
    if (res?.success) resultsDatabase = res.results;
}
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
    }
}

function printTicket(ticketId, ticketNumber) {
    const ticket = savedTickets.find(t => t.ticket_number == ticketNumber);
    if (!ticket) return;
    const win = window.open('', '_blank');
    const logoHtml = companyInfo.logo ? `<img src="${companyInfo.logo}" style="max-width:80px; margin-bottom:10px;">` : '';
    win.document.write(`
        <html><head><title>Ticket ${ticketNumber}</title>
        <style>body{font-family:monospace;padding:20px;text-align:center}.ticket{border:2px solid #000;padding:20px;max-width:400px;margin:auto}.total{font-weight:bold;margin-top:15px}</style>
        </head><body><div class="ticket">
        ${logoHtml}<h2>${companyInfo.name}</h2><div>${companyInfo.slogan}</div>
        <p>Ticket #${ticketNumber}</p><p>${new Date(ticket.created_at).toLocaleString()}</p><hr>
        ${ticket.bets.map(b => `<div>${b.bet_type}: ${b.numbers} - ${b.amount} G</div>`).join('')}<hr>
        <div class="total">Total: ${ticket.total_amount} G</div><div>${companyInfo.address}</div>
        </div></body></html>
    `);
    win.document.close();
    win.print();
}

// ---------- AFFICHAGE DES JEUX PAR CATÉGORIE ----------
function showGamesPanel(category) {
    const panel = document.getElementById('games-panel');
    const gamesList = {
        borlette: [
            { id: 'borlette', name: 'BORLETTE', desc: '2 chif - 1er lot ×60, 2e ×20, 3e ×10', multiplier: 'x60' },
            { id: 'boulpe', name: 'BOUL PE', desc: 'Boul pe (00-99)', multiplier: 'x60' },
            { id: 'nx', name: 'NX (Boul N0-N9)', desc: '10 boule Nx', multiplier: 'x60' }
        ],
        lotto: [
            { id: 'lotto3', name: 'LOTO 3', desc: '3 chif (lot 1 + 1 chif devan)', multiplier: 'x500' },
            { id: 'lotto4', name: 'LOTO 4', desc: '4 chif (lot 1+2 accumulate) - 3 opsyon', multiplier: 'x5000' },
            { id: 'lotto5', name: 'LOTO 5', desc: '5 chif (lot 1+2+3 accumulate) - 3 opsyon', multiplier: 'x25000' }
        ],
        special: [
            { id: 'grap', name: 'GRAP', desc: 'Boule paire (111, 222...)', multiplier: 'x500' },
            { id: 'marriage', name: 'MARYAJ', desc: 'Maryaj 2 chif', multiplier: 'x1000' },
            { id: 'auto-marriage', name: 'MARYAJ OTOMATIK', desc: 'Marie boules otomatik', multiplier: 'x1000' },
            { id: 'auto-lotto4', name: 'LOTO 4 OTOMATIK', desc: 'Lotto 4 otomatik', multiplier: 'x5000' }
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

// ---------- FORMULAIRES DE PARI ----------
function showBetForm(gameType) {
    const bet = betTypes[gameType];
    const formDiv = document.getElementById('bet-form');
    document.getElementById('games-panel').style.display = 'none';
    formDiv.style.display = 'block';
    let html = `<h3>${bet.name}</h3>`;

    if (gameType === 'borlette' || gameType === 'boulpe') {
        html += `<div class="form-group">
                    <label>Antre plizyè boule (2 chif chak)</label>
                    <div id="multi-number-grid" class="multi-number-grid"></div>
                    <button type="button" id="add-multi-numbers" class="btn-primary" style="margin-top:8px;">+ Ajoute tout</button>
                 </div>
                 <div id="multi-amount-section" style="display:none; margin-top:10px;">
                    <label>Montan chak boule</label>
                    <input type="number" id="multi-amount" value="1" min="1">
                    <button id="confirm-multi" class="btn-primary">Konfime & Ajoute</button>
                 </div>
                 <hr><div class="form-group">
                    <label>Antre yon sèl boule</label>
                    <input type="text" id="single-number" placeholder="Eg: 12" maxlength="2">
                    <label>Montan</label>
                    <input type="number" id="single-amount" value="1">
                    <button id="add-single" class="btn-primary" style="margin-top:8px;">Ajoute</button>
                 </div>`;
    } else if (gameType === 'nx') {
        html += `<div class="form-group"><label>Chwazi N0 a N9</label><div class="multi-number-grid" id="nx-buttons">${[...Array(10)].map((_,i)=>`<button type="button" class="nx-ball" data-n="${i}">N${i}</button>`).join('')}</div><label>Montan chak boule</label><input type="number" id="nx-amount" value="1"><button id="add-nx" class="btn-primary">Ajoute seleksyon</button></div>`;
    } else if (gameType === 'marriage') {
        html += `<div class="number-inputs"><input type="text" id="marriage-n1" placeholder="00" maxlength="2"><input type="text" id="marriage-n2" placeholder="00" maxlength="2"></div><label>Montan</label><input type="number" id="marriage-amount" value="1"><button id="add-marriage" class="btn-primary">Ajoute</button>`;
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        const digits = gameType === 'lotto4' ? 2 : 3;
        html += `<div class="number-inputs"><input type="text" id="lotto-n1" placeholder="${'0'.repeat(digits)}" maxlength="${digits}"><input type="text" id="lotto-n2" placeholder="00" maxlength="2"></div>
                 <div class="options-container"><label><input type="checkbox" id="opt1" checked> Opsyon 1</label> <label><input type="checkbox" id="opt2" checked> Opsyon 2</label> <label><input type="checkbox" id="opt3" checked> Opsyon 3</label></div>
                 <label>Montan pa opsyon</label><input type="number" id="lotto-amount" value="1"><button id="add-lotto" class="btn-primary">Ajoute</button>`;
    } else if (gameType === 'grap') {
        html += `<div class="form-group"><label>Chwazi boule paire</label><div class="multi-number-grid">${['111','222','333','444','555','666','777','888','999','000'].map(p=>`<button class="pair-ball" data-pair="${p}">${p}</button>`).join('')}</div><label>Montan</label><input type="number" id="grap-amount" value="1"><button id="add-grap" class="btn-primary">Ajoute</button></div>`;
    } else if (gameType === 'auto-marriage' || gameType === 'auto-lotto4') {
        html += `<div><button id="use-basket-balls">Itilize Boul nan Panye</button> <button id="enter-manual-balls">Antre Manyèlman</button></div>
                 <div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56"><button id="process-manual">Proses</button></div>
                 <div><strong>Boules chwazi:</strong> <span id="selected-balls-list">Pa gen</span></div>
                 ${gameType === 'auto-lotto4' ? '<label><input type="checkbox" id="include-reverse" checked> Enkli renverse</label>' : ''}
                 <label>Montan chak parye</label><input type="number" id="auto-amount" value="1"><button id="add-auto" class="btn-primary">Ajoute otomatik</button>`;
    }

    html += `<div class="bet-actions"><button id="close-form" class="btn-secondary">Fèmen</button></div>`;
    formDiv.innerHTML = html;

    // Événements spécifiques
    if (gameType === 'borlette' || gameType === 'boulpe') {
        initMultiNumberGrid(2);
        document.getElementById('add-multi-numbers').onclick = () => document.getElementById('multi-amount-section').style.display = 'block';
        document.getElementById('confirm-multi').onclick = () => addMultiNumbers(gameType);
        document.getElementById('add-single').onclick = () => addSingleBet(gameType);
    } else if (gameType === 'nx') {
        document.querySelectorAll('.nx-ball').forEach(btn => {
            btn.onclick = () => addNxBet(btn.dataset.n);
        });
    } else if (gameType === 'marriage') {
        document.getElementById('add-marriage').onclick = () => addMarriageBet();
    } else if (gameType === 'lotto4' || gameType === 'lotto5') {
        document.getElementById('add-lotto').onclick = () => addLottoBet(gameType);
    } else if (gameType === 'grap') {
        document.querySelectorAll('.pair-ball').forEach(btn => {
            btn.onclick = () => {
                const amount = parseInt(document.getElementById('grap-amount').value);
                addToCart({ id: Date.now()+Math.random(), type: gameType, name: bet.name, number: btn.dataset.pair, amount, multiplier: bet.multiplier });
                showNotification("Ajoute!", "success");
            };
        });
    } else if (gameType === 'auto-marriage' || gameType === 'auto-lotto4') {
        let selectedBalls = [];
        document.getElementById('use-basket-balls').onclick = () => {
            selectedBalls = [...new Set(APP_STATE.currentCart.filter(b=>b.type==='borlette').map(b=>b.number))];
            document.getElementById('selected-balls-list').innerText = selectedBalls.join(', ') || 'Pa gen';
        };
        document.getElementById('enter-manual-balls').onclick = () => document.getElementById('manual-balls-input').style.display = 'block';
        document.getElementById('process-manual').onclick = () => {
            const input = document.getElementById('manual-balls').value.trim();
            selectedBalls = [...new Set(input.split(/\s+/).filter(b=>/^\d{2}$/.test(b)))];
            document.getElementById('selected-balls-list').innerText = selectedBalls.join(', ') || 'Pa gen';
            document.getElementById('manual-balls-input').style.display = 'none';
        };
        document.getElementById('add-auto').onclick = () => {
            const amount = parseInt(document.getElementById('auto-amount').value);
            if (selectedBalls.length < 2) return showNotification("Fò gen omwen 2 boul", "warning");
            if (gameType === 'auto-marriage') {
                for (let i=0; i<selectedBalls.length; i++)
                    for (let j=i+1; j<selectedBalls.length; j++)
                        addToCart({ id: Date.now()+Math.random(), type: 'marriage', name: bet.name, number: `${selectedBalls[i]}*${selectedBalls[j]}`, amount, multiplier: bet.multiplier });
            } else {
                const incReverse = document.getElementById('include-reverse')?.checked;
                for (let i=0; i<selectedBalls.length; i++)
                    for (let j=i+1; j<selectedBalls.length; j++) {
                        addToCart({ id: Date.now()+Math.random(), type: 'lotto4', name: bet.name, number: selectedBalls[i]+selectedBalls[j], amount, multiplier: bet.multiplier });
                        if (incReverse) addToCart({ id: Date.now()+Math.random(), type: 'lotto4', name: bet.name+' (R)', number: selectedBalls[j]+selectedBalls[i], amount, multiplier: bet.multiplier });
                    }
            }
            showNotification("Ajoute!", "success");
            formDiv.style.display = 'none';
            document.getElementById('games-panel').style.display = 'block';
        };
    }

    document.getElementById('close-form').onclick = () => {
        formDiv.style.display = 'none';
        document.getElementById('games-panel').style.display = 'block';
    };
}

function initMultiNumberGrid(digits=2) {
    const grid = document.getElementById('multi-number-grid');
    grid.innerHTML = '';
    for (let i=0; i<12; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = digits;
        input.placeholder = '00';
        input.addEventListener('input', function(e) {
            if (this.value.length === digits) {
                const next = this.parentElement.querySelector(`input:nth-child(${Array.from(this.parentElement.children).indexOf(this)+2})`);
                if (next) next.focus();
            }
        });
        grid.appendChild(input);
    }
}

function addMultiNumbers(gameType) {
    const inputs = document.querySelectorAll('#multi-number-grid input');
    const numbers = Array.from(inputs).map(i => i.value.trim()).filter(v => /^\d{2}$/.test(v));
    if (numbers.length === 0) return showNotification("Antre omwen yon boule", "warning");
    const amount = parseInt(document.getElementById('multi-amount').value);
    if (isNaN(amount) || amount <= 0) return showNotification("Montan valid", "warning");
    numbers.forEach(num => {
        addToCart({ id: Date.now()+Math.random(), type: gameType, name: betTypes[gameType].name, number: num, amount, multiplier: betTypes[gameType].multiplier });
    });
    showNotification(`${numbers.length} parye ajoute`, "success");
    document.getElementById('multi-amount-section').style.display = 'none';
    inputs.forEach(i => i.value = '');
}

function addSingleBet(gameType) {
    const number = document.getElementById('single-number').value.trim();
    const amount = parseInt(document.getElementById('single-amount').value);
    if (!/^\d{2}$/.test(number)) return showNotification("Boule dwe 2 chif", "warning");
    if (isNaN(amount) || amount <= 0) return showNotification("Montan valid", "warning");
    addToCart({ id: Date.now()+Math.random(), type: gameType, name: betTypes[gameType].name, number, amount, multiplier: betTypes[gameType].multiplier });
    showNotification("Ajoute!", "success");
    document.getElementById('single-number').value = '';
}

function addNxBet(n) {
    const amount = parseInt(document.getElementById('nx-amount').value);
    if (isNaN(amount)) return;
    for (let tens=0; tens<=9; tens++) {
        const num = tens.toString() + n.toString();
        addToCart({ id: Date.now()+Math.random(), type: 'borlette', name: `NX N${n}`, number: num, amount, multiplier: 60 });
    }
    showNotification(`10 boule N${n} ajoute`, "success");
}

function addMarriageBet() {
    const n1 = document.getElementById('marriage-n1').value;
    const n2 = document.getElementById('marriage-n2').value;
    const amount = parseInt(document.getElementById('marriage-amount').value);
    if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) return showNotification("Chak chif dwe 2 chif", "warning");
    addToCart({ id: Date.now()+Math.random(), type: 'marriage', name: 'MARYAJ', number: `${n1}*${n2}`, amount, multiplier: 1000 });
    showNotification("Ajoute!", "success");
}

function addLottoBet(gameType) {
    const n1 = document.getElementById('lotto-n1').value;
    const n2 = document.getElementById('lotto-n2').value;
    const opt1 = document.getElementById('opt1').checked;
    const opt2 = document.getElementById('opt2').checked;
    const opt3 = document.getElementById('opt3').checked;
    const optCount = [opt1, opt2, opt3].filter(Boolean).length;
    if (optCount === 0) return showNotification("Chwazi omwen yon opsyon", "warning");
    const perAmount = parseInt(document.getElementById('lotto-amount').value);
    const totalAmount = perAmount * optCount;
    addToCart({ id: Date.now()+Math.random(), type: gameType, name: betTypes[gameType].name, number: n1+n2, amount: totalAmount, multiplier: betTypes[gameType].multiplier, options: {opt1,opt2,opt3}, perOptionAmount: perAmount });
    showNotification("Ajoute!", "success");
}

// ---------- OUVERTURE ÉCRAN DE PARI ----------
function openBettingScreen(drawId, time) {
    currentDraw = drawId;
    currentDrawTime = time;
    const draw = draws[drawId];
    // On reste dans l'écran d'accueil, on affiche juste le panneau des jeux
    document.querySelector('.container').style.display = 'block';
    // Forcer l'affichage de la catégorie Borlette
    document.querySelectorAll('.game-category-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.game-category-btn[data-category="borlette"]').classList.add('active');
    showGamesPanel('borlette');
    document.getElementById('bet-form').style.display = 'none';
    showNotification(`Tiraj ${draw.name} ${time === 'morning' ? 'Maten' : 'Swè'} chwazi`, 'success');
}

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
    win.document.write(`<html><head><title>Rapò</title><style>body{font-family:sans-serif;padding:20px}.stat-card{background:#f0f0f0;margin:10px;padding:10px;border-radius:8px}</style></head><body>${stats.outerHTML}${detail.outerHTML}</body></html>`);
    win.document.close();
    win.print();
}

// ---------- AUTRES ÉCRANS ----------
function updateHistoryScreen() {
    const list = document.getElementById('history-list');
    if (!savedTickets.length) { list.innerHTML = '<p>Pa gen fich</p>'; return; }
    list.innerHTML = savedTickets.map(t => `<div class="ticket-item"><strong>#${t.ticket_number}</strong> - ${t.total_amount} G (${new Date(t.created_at).toLocaleString()})</div>`).join('');
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
    if (res?.success && res.tickets.length) {
        container.innerHTML = res.tickets.map(w => `<div class="winning-ticket"><strong>#${w.ticket_number}</strong> - ${w.winning_amount} HTG</div>`).join('');
    } else container.innerHTML = '<p>Pa gen fiche gagnant</p>';
}
function showScreen(screenId) {
    document.querySelectorAll('.screen, .results-check-screen, .multi-tickets-screen, .report-screen, .container').forEach(s => s.style.display = 'none');
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
    showGamesPanel('borlette');
    renderCart();
});

function updateCurrentTime() {
    const now = new Date();
    document.getElementById('current-time').innerText = now.toLocaleDateString('fr-FR') + ' - ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}

function setupEventListeners() {
    // Cartes tirages
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
    // Boutons catégories
    document.querySelectorAll('.game-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.game-category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showGamesPanel(btn.dataset.category);
            document.getElementById('bet-form').style.display = 'none';
        });
    });
    // Sauvegarde ticket
    document.getElementById('save-print-ticket').addEventListener('click', saveAndPrintTicket);
    // Navigation
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
    // Résultats
    document.getElementById('open-results-check').addEventListener('click', openResultsCheckScreen);
    document.getElementById('check-winners-btn').addEventListener('click', checkWinningTickets);
    document.getElementById('back-from-results').addEventListener('click', () => {
        document.getElementById('results-check-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    // Multi tickets (simple)
    document.getElementById('open-multi-tickets').addEventListener('click', () => {
        document.querySelector('.container').style.display = 'none';
        document.getElementById('multi-tickets-screen').style.display = 'block';
        document.getElementById('multi-tickets-list').innerHTML = '<p>Fonctionnalité multi-tirages à implémenter côté serveur</p>';
    });
    document.getElementById('back-from-multi-tickets').addEventListener('click', () => {
        document.getElementById('multi-tickets-screen').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    });
    // Recherches
    document.getElementById('search-winning-btn').addEventListener('click', () => {
        const term = document.getElementById('search-winning-tickets').value.toLowerCase();
        const filtered = winningTickets.filter(w => w.ticket_number.toLowerCase().includes(term));
        document.getElementById('winning-tickets-list').innerHTML = filtered.length ? filtered.map(w => `<div>${w.ticket_number}</div>`).join('') : '<p>Pa gen</p>';
    });
    document.getElementById('search-history-btn').addEventListener('click', () => {
        const term = document.getElementById('search-history').value.toLowerCase();
        const filtered = savedTickets.filter(t => t.ticket_number.toLowerCase().includes(term));
        document.getElementById('history-list').innerHTML = filtered.length ? filtered.map(t => `<div>${t.ticket_number}</div>`).join('') : '<p>Pa gen</p>';
    });
    document.getElementById('logout-btn').addEventListener('click', logout);
}