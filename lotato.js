// ==================== CONFIGURATION ====================
const API_BASE_URL = '';
let currentDraw = null;
let currentDrawTime = null;
let activeBets = [];
let savedTickets = [];
let winningTickets = [];
let resultsDatabase = {};
let companyInfo = {
    name: "Lotato",
    slogan: "Chwazi yon Jwet",
    logo: "",
    address: "",
    phone: "",
    agentCommission: 10,
    allowEditDelete: true,
    editDeleteDelay: 5
};
let drawsList = {
    miami: { name: "Miami", times: { morning: "1:30 PM", evening: "9:50 PM" } },
    georgia: { name: "Georgia", times: { morning: "12:30 PM", evening: "7:00 PM" } },
    newyork: { name: "New York", times: { morning: "2:30 PM", evening: "8:00 PM" } },
    texas: { name: "Texas", times: { morning: "12:00 PM", evening: "6:00 PM" } },
    tunisia: { name: "Tunisie", times: { morning: "10:30 AM", evening: "2:00 PM" } }
};

// ==================== UTILITAIRES ====================
async function apiCall(url, method = 'GET', body = null) {
    const token = localStorage.getItem('lotato_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
        const res = await fetch(url, options);
        if (res.status === 401) { logout(); return null; }
        return await res.json();
    } catch (e) { console.error(e); return null; }
}

function logout() {
    localStorage.removeItem('lotato_token');
    localStorage.removeItem('lotato_user');
    window.location.href = 'index.html';
}

function showNotification(msg, type = 'info') {
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'info'}-circle"></i> ${msg}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ==================== CHARGEMENT INITIAL ====================
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('lotato_token');
    if (!token) { window.location.href = 'index.html'; return; }
    const check = await apiCall('/api/auth/check');
    if (!check?.success) { logout(); return; }

    await loadSettings();
    await loadResults();
    await loadTickets();
    await loadWinningTickets();

    renderDrawsGrid();
    updateCompanyDisplay();
    setupEventListeners();
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
});

async function loadSettings() {
    const res = await apiCall('/api/settings');
    if (res?.success) {
        const s = res.settings;
        if (s.company_name) companyInfo.name = s.company_name;
        if (s.company_slogan) companyInfo.slogan = s.company_slogan;
        if (s.company_logo) companyInfo.logo = s.company_logo;
        if (s.company_address) companyInfo.address = s.company_address;
        if (s.agent_commission) companyInfo.agentCommission = s.agent_commission;
        if (s.allow_edit_delete !== undefined) companyInfo.allowEditDelete = s.allow_edit_delete;
        if (s.edit_delete_delay) companyInfo.editDeleteDelay = s.edit_delete_delay;
    }
}

async function loadResults() {
    const res = await apiCall('/api/results');
    if (res?.success) resultsDatabase = res.results;
}

async function loadTickets() {
    const res = await apiCall('/api/tickets');
    if (res?.success) savedTickets = res.tickets;
}

async function loadWinningTickets() {
    const res = await apiCall('/api/tickets/winning');
    if (res?.success) winningTickets = res.tickets;
}

function updateCompanyDisplay() {
    document.getElementById('company-name').innerText = companyInfo.name;
    document.getElementById('company-slogan').innerText = companyInfo.slogan;
    if (companyInfo.logo) document.getElementById('company-logo').src = companyInfo.logo;
}

function updateCurrentTime() {
    const now = new Date();
    document.getElementById('current-time').innerText = now.toLocaleString('fr-FR');
}

// ==================== AFFICHAGE DES TIRAGES ====================
function renderDrawsGrid() {
    const container = document.getElementById('draws-grid');
    container.innerHTML = '';
    for (const [id, draw] of Object.entries(drawsList)) {
        const card = document.createElement('div');
        card.className = 'draw-card';
        card.dataset.draw = id;
        card.innerHTML = `
            <h3>${draw.name}</h3>
            <div class="draw-buttons">
                <button class="draw-btn morning active" data-time="morning">${draw.times.morning}</button>
                <button class="draw-btn evening" data-time="evening">${draw.times.evening}</button>
            </div>
        `;
        card.querySelectorAll('.draw-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                card.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                openBettingScreen(id, btn.dataset.time);
            });
        });
        card.addEventListener('click', () => openBettingScreen(id, 'morning'));
        container.appendChild(card);
    }
}

// ==================== ÉCRAN DE PARI ====================
function openBettingScreen(drawId, time) {
    currentDraw = drawId;
    currentDrawTime = time;
    document.getElementById('betting-draw-name').innerText = `${drawsList[drawId].name} (${time === 'morning' ? 'Maten' : 'Swè'})`;
    document.querySelector('.app-container').style.display = 'none';
    document.getElementById('betting-screen').style.display = 'block';
    activeBets = [];
    renderCart();
    hideAllCategories();
    document.querySelector('.games-category[data-cat="borlette"]').style.display = 'grid';
}

function hideAllCategories() {
    document.querySelectorAll('.games-category').forEach(cat => cat.style.display = 'none');
}

function setupGameListeners() {
    document.querySelectorAll('.game-card').forEach(card => {
        card.removeEventListener('click', gameClickHandler);
        card.addEventListener('click', gameClickHandler);
    });
}
function gameClickHandler(e) {
    const game = this.dataset.game;
    if (game === 'nx') showNxForm();
    else if (game === 'auto-marriage' || game === 'auto-lotto4') showAutoForm(game);
    else showBetForm(game);
}

function showBetForm(game) {
    document.getElementById('games-container').style.display = 'none';
    const formDiv = document.getElementById('bet-form');
    formDiv.style.display = 'block';
    document.getElementById('form-title').innerText = game.toUpperCase();
    document.getElementById('special-options').style.display = 'none';
    if (game === 'lotto4' || game === 'lotto5') {
        document.getElementById('special-options').style.display = 'block';
        document.getElementById('special-options').innerHTML = `
            <label><input type="checkbox" id="opt1" checked> Opsyon 1</label>
            <label><input type="checkbox" id="opt2" checked> Opsyon 2</label>
            <label><input type="checkbox" id="opt3" checked> Opsyon 3</label>
        `;
    }
    const addBtn = document.getElementById('add-bulk-btn');
    addBtn.onclick = () => addBulkBet(game);
    document.getElementById('back-to-games').onclick = () => {
        formDiv.style.display = 'none';
        document.getElementById('games-container').style.display = 'block';
    };
}

function addBulkBet(game) {
    const numbersStr = document.getElementById('numbers-input').value.trim();
    const amount = parseInt(document.getElementById('amount-input').value);
    if (!numbersStr || isNaN(amount) || amount <= 0) {
        showNotification("Antre nimewo ak montan valab", "error");
        return;
    }
    let numbers = numbersStr.split(/\s+/).filter(n => /^\d{2,3}$/.test(n));
    if (game === 'lotto3' || game === 'grap') numbers = numbers.filter(n => n.length === 3);
    else numbers = numbers.filter(n => n.length === 2);
    if (numbers.length === 0) {
        showNotification("Nimewo pa valab (2 oswa 3 chif)", "error");
        return;
    }
    if (game === 'lotto4' || game === 'lotto5') {
        const opt1 = document.getElementById('opt1')?.checked;
        const opt2 = document.getElementById('opt2')?.checked;
        const opt3 = document.getElementById('opt3')?.checked;
        const optCount = [opt1, opt2, opt3].filter(Boolean).length;
        if (optCount === 0) return showNotification("Chwazi omwen yon opsyon", "error");
        const perAmount = amount;
        const totalAmount = perAmount * optCount;
        numbers.forEach(num => {
            activeBets.push({
                id: Date.now() + Math.random(),
                game: game,
                number: num,
                amount: totalAmount,
                options: { option1: opt1, option2: opt2, option3: opt3 },
                perAmount: perAmount
            });
        });
    } else {
        numbers.forEach(num => {
            activeBets.push({
                id: Date.now() + Math.random(),
                game: game,
                number: num,
                amount: amount
            });
        });
    }
    renderCart();
    showNotification(`${numbers.length} parye ajoute`, "success");
    document.getElementById('numbers-input').value = '';
    document.getElementById('amount-input').value = '1';
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('games-container').style.display = 'block';
}

function showNxForm() {
    document.getElementById('games-container').style.display = 'none';
    const formDiv = document.getElementById('bet-form');
    formDiv.style.display = 'block';
    document.getElementById('form-title').innerText = "NX (Boul N0-N9)";
    document.getElementById('special-options').innerHTML = `
        <div class="nx-balls" style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:10px 0;">
            ${[...Array(10)].map((_, i) => `<div class="nx-ball" data-n="${i}">N${i}</div>`).join('')}
        </div>
    `;
    document.getElementById('special-options').style.display = 'block';
    document.querySelectorAll('.nx-ball').forEach(ball => {
        ball.onclick = () => {
            const n = ball.dataset.n;
            const amount = parseInt(document.getElementById('amount-input').value);
            if (isNaN(amount) || amount <= 0) return showNotification("Montan valid", "error");
            const numbers = Array.from({ length: 10 }, (_, i) => String(i + parseInt(n)).padStart(2, '0'));
            activeBets.push({
                id: Date.now() + Math.random(),
                game: 'borlette',
                number: `N${n} (${n}0-${n}9)`,
                amount: amount * 10,
                isGroup: true
            });
            renderCart();
            showNotification(`10 boule N${n} ajoute`, "success");
        };
    });
    document.getElementById('add-bulk-btn').onclick = () => {
        const amount = parseInt(document.getElementById('amount-input').value);
        if (isNaN(amount) || amount <= 0) return;
        for (let i = 0; i <= 9; i++) {
            const numbers = Array.from({ length: 10 }, (_, k) => String(k + i).padStart(2, '0'));
            activeBets.push({ id: Date.now() + Math.random() + i, game: 'borlette', number: `N${i}`, amount: amount * 10 });
        }
        renderCart();
        showNotification("10 seri Nx ajoute", "success");
    };
    document.getElementById('back-to-games').onclick = () => {
        formDiv.style.display = 'none';
        document.getElementById('games-container').style.display = 'block';
    };
}

function showAutoForm(game) {
    document.getElementById('games-container').style.display = 'none';
    const formDiv = document.getElementById('bet-form');
    formDiv.style.display = 'block';
    document.getElementById('form-title').innerText = game === 'auto-marriage' ? "MARYAJ OTOMATIK" : "LOTO 4 OTOMATIK";
    document.getElementById('special-options').innerHTML = `
        <button id="use-cart-balls" class="btn-secondary">Itilize boul nan panye</button>
        <input type="text" id="manual-balls" placeholder="12 34 56" style="margin-top:8px;">
        <button id="process-balls" class="btn-primary">Proses</button>
        <div>Boul chwazi: <span id="selected-balls-display">Pa gen</span></div>
    `;
    document.getElementById('special-options').style.display = 'block';
    let selectedBalls = [];
    document.getElementById('use-cart-balls').onclick = () => {
        selectedBalls = [...new Set(activeBets.filter(b => b.game === 'borlette' && !b.isGroup).map(b => b.number))];
        document.getElementById('selected-balls-display').innerText = selectedBalls.join(', ') || 'Pa gen';
    };
    document.getElementById('process-balls').onclick = () => {
        const input = document.getElementById('manual-balls').value.trim();
        const balls = input.split(/\s+/).filter(b => /^\d{2}$/.test(b));
        selectedBalls = [...new Set(balls)];
        document.getElementById('selected-balls-display').innerText = selectedBalls.join(', ') || 'Pa gen';
    };
    document.getElementById('add-bulk-btn').onclick = () => {
        const amount = parseInt(document.getElementById('amount-input').value);
        if (selectedBalls.length < 2) return showNotification("Fò gen omwen 2 boul", "error");
        if (game === 'auto-marriage') {
            for (let i = 0; i < selectedBalls.length; i++) {
                for (let j = i+1; j < selectedBalls.length; j++) {
                    activeBets.push({ id: Date.now()+Math.random(), game: 'marriage', number: `${selectedBalls[i]}*${selectedBalls[j]}`, amount });
                }
            }
        } else {
            for (let i = 0; i < selectedBalls.length; i++) {
                for (let j = i+1; j < selectedBalls.length; j++) {
                    activeBets.push({ id: Date.now()+Math.random(), game: 'lotto4', number: selectedBalls[i]+selectedBalls[j], amount });
                    activeBets.push({ id: Date.now()+Math.random(), game: 'lotto4', number: selectedBalls[j]+selectedBalls[i], amount });
                }
            }
        }
        renderCart();
        showNotification("Parye otomatik ajoute", "success");
        formDiv.style.display = 'none';
        document.getElementById('games-container').style.display = 'block';
    };
    document.getElementById('back-to-games').onclick = () => {
        formDiv.style.display = 'none';
        document.getElementById('games-container').style.display = 'block';
    };
}

function renderCart() {
    const container = document.getElementById('cart-items');
    let total = 0;
    if (!activeBets.length) {
        container.innerHTML = '<div class="empty-cart">Panye vid</div>';
        document.getElementById('cart-total').innerText = '0';
        return;
    }
    container.innerHTML = activeBets.map(bet => {
        total += bet.amount;
        return `<div class="cart-item">
            <span>${bet.game.toUpperCase()} ${bet.number}</span>
            <span>${bet.amount} G <i class="fas fa-times cart-item-remove" data-id="${bet.id}"></i></span>
        </div>`;
    }).join('');
    document.getElementById('cart-total').innerText = total;
    document.querySelectorAll('.cart-item-remove').forEach(icon => {
        icon.onclick = () => {
            const id = parseFloat(icon.dataset.id);
            activeBets = activeBets.filter(b => b.id !== id);
            renderCart();
        };
    });
}

async function saveAndPrintCart() {
    if (!activeBets.length) return showNotification("Panye vid", "error");
    const payload = {
        draw: currentDraw,
        draw_time: currentDrawTime,
        bets: activeBets.map(b => ({
            type: b.game,
            number: b.number,
            amount: b.amount,
            options: b.options || null
        })),
        total: activeBets.reduce((s,b)=>s+b.amount,0)
    };
    const res = await apiCall('/api/tickets', 'POST', { ticket: payload });
    if (res?.success) {
        showNotification(`Ticket #${res.ticketNumber} enregistre`, "success");
        await loadTickets();
        // Impression
        const ticket = savedTickets.find(t => t.ticket_number === res.ticketNumber);
        if (ticket) printTicket(ticket);
        activeBets = [];
        renderCart();
        closeBettingScreen();
    } else {
        showNotification("Erreur sauvegarde", "error");
    }
}

function printTicket(ticket) {
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Ticket ${ticket.ticket_number}</title>
        <style>body{font-family:monospace;padding:20px} .ticket{border:2px solid #000;padding:20px;max-width:400px}</style>
        </head><body>
        <div class="ticket">
            ${companyInfo.logo ? `<img src="${companyInfo.logo}" style="max-width:80px">` : ''}
            <h2>${companyInfo.name}</h2>
            <p>${companyInfo.slogan}</p>
            <p>Ticket #${ticket.ticket_number}</p>
            <p>${new Date(ticket.created_at).toLocaleString()}</p>
            <hr>
            ${ticket.bets.map(b => `<div>${b.bet_type}: ${b.numbers} - ${b.amount} G</div>`).join('')}
            <hr>
            <div>Total: ${ticket.total_amount} G</div>
            <p>${companyInfo.address}</p>
        </div>
        </body></html>
    `);
    win.document.close();
    win.print();
}

function closeBettingScreen() {
    document.getElementById('betting-screen').style.display = 'none';
    document.querySelector('.app-container').style.display = 'block';
    document.getElementById('games-container').style.display = 'block';
    document.getElementById('bet-form').style.display = 'none';
}

// ==================== HISTORIQUE & GESTION ====================
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!savedTickets.length) { container.innerHTML = '<p>Aucun ticket</p>'; return; }
    const now = new Date();
    container.innerHTML = savedTickets.map(t => {
        const createdAt = new Date(t.created_at);
        const diffMins = (now - createdAt) / 60000;
        const canEdit = companyInfo.allowEditDelete && diffMins <= companyInfo.editDeleteDelay;
        return `
            <div class="history-item" data-id="${t.id}">
                <div><strong>#${t.ticket_number}</strong> - ${t.total_amount} G - ${createdAt.toLocaleString()}</div>
                <div class="history-actions">
                    ${canEdit ? `<button class="edit-ticket" data-id="${t.id}"><i class="fas fa-edit"></i> Modifye</button>` : ''}
                    ${canEdit ? `<button class="delete-ticket" data-id="${t.id}"><i class="fas fa-trash"></i> Efase</button>` : ''}
                    <button class="replay-ticket" data-id="${t.id}"><i class="fas fa-redo"></i> Rejoue</button>
                    <button class="print-ticket" data-id="${t.id}"><i class="fas fa-print"></i> Enprime</button>
                </div>
            </div>
        `;
    }).join('');
    attachHistoryActions();
}

function attachHistoryActions() {
    document.querySelectorAll('.edit-ticket').forEach(btn => btn.onclick = () => openEditTicket(btn.dataset.id));
    document.querySelectorAll('.delete-ticket').forEach(btn => btn.onclick = () => deleteTicket(btn.dataset.id));
    document.querySelectorAll('.replay-ticket').forEach(btn => btn.onclick = () => openReplayTicket(btn.dataset.id));
    document.querySelectorAll('.print-ticket').forEach(btn => btn.onclick = () => {
        const ticket = savedTickets.find(t => t.id == btn.dataset.id);
        if (ticket) printTicket(ticket);
    });
}

async function deleteTicket(id) {
    if (!confirm("Efase tikè sa?")) return;
    const res = await apiCall(`/api/tickets/${id}`, 'DELETE');
    if (res?.success) {
        await loadTickets();
        renderHistory();
        showNotification("Ticket efase", "success");
    }
}

function openEditTicket(id) {
    const ticket = savedTickets.find(t => t.id == id);
    if (!ticket) return;
    document.getElementById('edit-ticket-num').innerText = ticket.ticket_number;
    const container = document.getElementById('edit-bets-list');
    container.innerHTML = ticket.bets.map((bet, idx) => `
        <div><span>${bet.bet_type} ${bet.numbers}</span> <input type="number" id="edit-amt-${idx}" value="${bet.amount}" style="width:80px"></div>
    `).join('');
    document.getElementById('edit-modal').style.display = 'flex';
    document.getElementById('save-edit-btn').onclick = async () => {
        const newBets = ticket.bets.map((bet, idx) => ({
            ...bet,
            amount: parseInt(document.getElementById(`edit-amt-${idx}`).value) || bet.amount
        }));
        const newTotal = newBets.reduce((s,b)=>s+b.amount,0);
        const res = await apiCall(`/api/tickets/${id}`, 'PUT', { bets: newBets, total: newTotal });
        if (res?.success) {
            await loadTickets();
            renderHistory();
            document.getElementById('edit-modal').style.display = 'none';
            showNotification("Ticket modifye", "success");
        }
    };
}

function openReplayTicket(id) {
    const ticket = savedTickets.find(t => t.id == id);
    if (!ticket) return;
    document.getElementById('replay-ticket-num').innerText = ticket.ticket_number;
    const drawSelect = document.getElementById('replay-draw');
    const timeSelect = document.getElementById('replay-time');
    drawSelect.innerHTML = '';
    for (const [did, d] of Object.entries(drawsList)) {
        const opt = document.createElement('option');
        opt.value = did;
        opt.textContent = d.name;
        drawSelect.appendChild(opt);
    }
    drawSelect.onchange = () => {
        const did = drawSelect.value;
        timeSelect.innerHTML = '';
        for (const [t, label] of Object.entries(drawsList[did].times)) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t === 'morning' ? 'Maten' : 'Swè';
            timeSelect.appendChild(opt);
        }
    };
    drawSelect.dispatchEvent(new Event('change'));
    document.getElementById('replay-modal').style.display = 'flex';
    document.getElementById('confirm-replay').onclick = async () => {
        const newDraw = drawSelect.value;
        const newTime = timeSelect.value;
        const newBets = ticket.bets.map(b => ({
            type: b.bet_type,
            number: b.numbers,
            amount: b.amount,
            options: b.options || null
        }));
        const payload = { draw: newDraw, draw_time: newTime, bets: newBets, total: ticket.total_amount };
        const res = await apiCall('/api/tickets', 'POST', { ticket: payload });
        if (res?.success) {
            await loadTickets();
            renderHistory();
            document.getElementById('replay-modal').style.display = 'none';
            showNotification(`Ticket rejoue nan ${drawsList[newDraw].name}`, "success");
        }
    };
}

// ==================== RÉSULTATS ====================
function showResultsScreen() {
    document.querySelector('.app-container').style.display = 'none';
    const screen = document.getElementById('results-screen');
    screen.style.display = 'block';
    const container = document.getElementById('results-list');
    container.innerHTML = '';
    for (const [drawId, draw] of Object.entries(drawsList)) {
        for (const [time, tLabel] of Object.entries(draw.times)) {
            const res = resultsDatabase[drawId]?.[time];
            if (res) {
                container.innerHTML += `<div><strong>${draw.name} (${time})</strong> : ${res.lot1} | ${res.lot2} | ${res.lot3}</div>`;
            }
        }
    }
    document.getElementById('check-winners-from-results').onclick = async () => {
        await loadWinningTickets();
        const winnersDiv = document.getElementById('winners-list');
        if (!winningTickets.length) winnersDiv.innerHTML = '<p>Pa gen tikè genyen</p>';
        else winnersDiv.innerHTML = winningTickets.map(w => `<div>Ticket #${w.ticket_number} - ${w.winning_amount} G</div>`).join('');
    };
}

// ==================== RAPPORTS ====================
async function loadReport(period) {
    const end = new Date();
    let start = new Date();
    if (period === 'today') start.setHours(0,0,0,0);
    else if (period === '7days') start.setDate(end.getDate()-7);
    else if (period === '15days') start.setDate(end.getDate()-15);
    else if (period === 'month') start = new Date(end.getFullYear(), end.getMonth(), 1);
    const filtered = savedTickets.filter(t => new Date(t.created_at) >= start && new Date(t.created_at) <= end);
    const totalSales = filtered.reduce((s,t)=>s+t.total_amount,0);
    const commission = totalSales * (companyInfo.agentCommission/100);
    const statsDiv = document.getElementById('report-stats');
    statsDiv.innerHTML = `
        <div class="stat-card">Total vant: ${totalSales} G</div>
        <div class="stat-card">Komisyon (${companyInfo.agentCommission}%): ${commission} G</div>
        <div class="stat-card">Nimewo tikè: ${filtered.length}</div>
    `;
}

// ==================== NAVIGATION & ÉVÉNEMENTS ====================
function setupEventListeners() {
    // Navigation basse
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            const screen = item.dataset.screen;
            document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
            document.querySelector('.app-container').style.display = 'none';
            if (screen === 'home') document.querySelector('.app-container').style.display = 'block';
            else if (screen === 'report') { document.getElementById('report-screen').style.display = 'block'; loadReport('15days'); }
            else if (screen === 'history') { document.getElementById('history-screen').style.display = 'block'; renderHistory(); }
            else if (screen === 'winners') { document.getElementById('winners-screen').style.display = 'block'; updateWinnersScreen(); }
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        };
    });
    document.querySelectorAll('.back-to-home').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
            document.querySelector('.app-container').style.display = 'block';
            document.querySelector('.nav-item[data-screen="home"]').classList.add('active');
        };
    });
    document.getElementById('show-results-btn').onclick = showResultsScreen;
    document.getElementById('apply-report').onclick = () => {
        const period = document.getElementById('period-select').value;
        loadReport(period);
    };
    document.getElementById('save-print-cart').onclick = saveAndPrintCart;
    document.getElementById('back-home-btn').onclick = closeBettingScreen;
    // Onglets dans l'écran de pari
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const cat = tab.dataset.cat;
            document.querySelectorAll('.games-category').forEach(g => g.style.display = 'none');
            document.querySelector(`.games-category[data-cat="${cat}"]`).style.display = 'grid';
        };
    });
    setupGameListeners();
    // Fermeture modales
    document.querySelectorAll('.modal-close').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
}

async function updateWinnersScreen() {
    await loadWinningTickets();
    const container = document.getElementById('winners-container');
    if (!winningTickets.length) container.innerHTML = '<p>Pa gen tikè genyen</p>';
    else container.innerHTML = winningTickets.map(w => `<div class="winner-item">#${w.ticket_number} - ${w.winning_amount} G</div>`).join('');
}

// Lancement