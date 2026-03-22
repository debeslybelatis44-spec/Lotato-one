// ==================== RÉSULTATS ET GAINS ====================
let winningTickets = [];

async function loadResultsFromDatabase() {
    try {
        const data = await apiCall(APP_CONFIG.results);
        if (data && data.results) resultsDatabase = data.results;
        updateResultsDisplay();
    } catch(e) { console.error(e); showNotification("Erreur chargement résultats", "error"); }
}

async function checkForNewResults() {
    if (!navigator.onLine) return;
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
    const allTickets = savedTickets;
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