// ==================== MULTI-TIRAGES ====================
let currentMultiDrawTicket = {
    id: Date.now().toString(),
    bets: [],
    totalAmount: 0,
    draws: new Set(),
    createdAt: new Date().toISOString()
};
let multiDrawTickets = [];

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
        const response = await apiCall(APP_CONFIG.multiDrawTickets, 'POST', ticket);
        if (response && response.success) {
            printMultiDrawTicket(ticket);
            currentMultiDrawTicket = { id: Date.now().toString(), bets: [], totalAmount: 0, draws: new Set(), createdAt: new Date().toISOString() };
            updateMultiDrawTicketDisplay();
            await loadMultiDrawTickets();
            showNotification("Fiche multi-tirages anrejistre ak enprime!", "success");
        } else {
            showNotification("Erreur sauvegarde fiche multi-tirages", "error");
        }
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