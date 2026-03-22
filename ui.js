// ==================== INTERFACE UTILISATEUR ====================
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

function updateCurrentTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const dateString = now.toLocaleDateString('fr-FR', options);
    const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('current-time').textContent = `${dateString} - ${timeString}`;
    document.getElementById('ticket-date').textContent = `${dateString} - ${timeString}`;
}

function showMainApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'block';
}

function updateLogoDisplay() {
    document.querySelectorAll('#company-logo, #ticket-logo').forEach(logo => {
        logo.src = companyLogo;
        logo.onerror = () => logo.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YzOWMxMiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Qk9STEVUVEU8L3RleHQ+PC9zdmc+';
    });
}

function setupConnectionDetection() {
    window.addEventListener('online', () => {
        showNotification("Koneksyon entènèt retabli", "success");
        checkForNewResults();
    });
    window.addEventListener('offline', () => {
        showNotification("Pa konekte ak entènèt", "warning");
    });
}

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
        historyList.innerHTML += `<div class="history-item"><div class="history-header"><span class="history-draw">${draws[t.draw]?.name} (${t.drawTime==='morning'?'Maten':'Swè'})</span><span class="history-date">${date.toLocaleString()}</span></div><div class="history-bets">${betsHTML}</div><div class="history-total"><span>Total:</span><span>${t.total} G</span></div>${canEdit?`<div><button class="edit-btn" onclick="loadTicketForEdit('${t._id}')">Modifye</button><button class="delete-btn" onclick="deleteTicket('${t._id}')">Efase</button></div>`:''}</div>`;
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

function searchTicket() {
    const term = document.getElementById('search-ticket-number').value.toLowerCase();
    const items = document.querySelectorAll('#ticket-management-list .ticket-management');
    items.forEach(item => {
        if (!term) item.style.display = 'block';
        else item.style.display = item.textContent.toLowerCase().includes(term) ? 'block' : 'none';
    });
}

function showAllTickets() { document.getElementById('search-ticket-number').value=''; updateTicketManagementScreen(); }
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