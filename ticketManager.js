// ==================== GESTION DES TICKETS (sans pending) ====================
let savedTickets = [];
let ticketNumber = 1;

async function saveTicket() {
    console.log("Sauvegarde ticket via API");
    if (activeBets.length === 0) {
        showNotification("Pa gen okenn parye pou sove nan fiche a", "warning");
        return;
    }
    if (!currentAdmin || !currentAdmin.id) {
        showNotification("Erreur: utilisateur non identifié", "error");
        return;
    }

    const ticket = {
        number: ticketNumber,
        date: new Date().toISOString(),
        draw: currentDraw,
        draw_time: currentDrawTime,
        bets: activeBets.map(bet => ({
            type: bet.type,
            name: bet.name,
            number: bet.number,
            amount: bet.amount,
            multiplier: bet.multiplier,
            isGroup: bet.isGroup || false,
            details: bet.details || [],
            options: bet.options || {},
            perOptionAmount: bet.perOptionAmount || null,
            isLotto4: bet.isLotto4 || false,
            isLotto5: bet.isLotto5 || false,
            isAuto: bet.isAuto || false
        })),
        total: activeBets.reduce((sum, bet) => sum + bet.amount, 0),
        agent_name: currentAdmin.name,
        agent_id: currentAdmin.id,
        subsystem_id: currentAdmin.subsystem_id
    };

    try {
        const response = await apiCall(APP_CONFIG.tickets, 'POST', ticket);
        console.log("Réponse API:", response);
        if (response && response.success === true) {
            const savedTicket = {
                _id: response.ticket._id,
                number: ticket.number,
                date: ticket.date,
                draw: ticket.draw,
                drawTime: ticket.draw_time,
                bets: ticket.bets,
                total: ticket.total,
                agentName: ticket.agent_name
            };
            savedTickets.push(savedTicket);
            ticketNumber++;
            showNotification("Fiche sove avèk siksè!", "success");
            activeBets = [];
            updateBetsList();
        } else {
            const errorMsg = response?.error || "Erreur inconnue du serveur";
            showNotification(`Erreur: ${errorMsg}`, "error");
            console.error("Erreur API:", response);
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du ticket:', error);
        showNotification("Erreur de connexion au serveur", "error");
    }
}

async function loadTicketsFromAPI() {
    try {
        const data = await apiCall(APP_CONFIG.tickets);
        if (data && data.success) {
            savedTickets = data.tickets || [];
            ticketNumber = savedTickets.length + 1;
        }
    } catch (e) {
        console.error("Erreur chargement tickets", e);
    }
}

function updateTicketManagementScreen() {
    const list = document.getElementById('ticket-management-list');
    if (savedTickets.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-file-invoice"></i><p>Pa gen fiche ki sove.</p></div>';
        return;
    }
    const sorted = [...savedTickets].sort((a,b)=>new Date(b.date)-new Date(a.date));
    let html = '';
    sorted.forEach(t => {
        const date = new Date(t.date);
        const canEdit = (Date.now()-date) <= FIVE_MINUTES;
        const grouped = groupBetsByType(t.bets);
        let betsHTML = '';
        for (let [type, bets] of Object.entries(grouped)) {
            const totalAmt = bets.reduce((s,b)=>s+b.amount,0);
            betsHTML += `<div><strong>${type}:</strong> ${bets.length} parye (${totalAmt} G)</div>`;
        }
        html += `<div class="ticket-management"><div class="ticket-management-header"><div><strong>Fiche #${String(t.number).padStart(6,'0')}</strong>${t.draw?`<div>${draws[t.draw]?.name} (${t.drawTime==='morning'?'Maten':'Swè'})</div>`:''}</div><div>${date.toLocaleString()}<div><strong>${t.total||0} G</strong></div></div></div><div class="ticket-details">${betsHTML}${t.agentName?`<div>Ajan: ${t.agentName}</div>`:''}</div>${canEdit?`<div><button class="edit-btn" onclick="loadTicketForEdit('${t._id}')">Modifye</button><button class="delete-btn" onclick="deleteTicket('${t._id}')">Efase</button></div>`:`<div style="color:#7f8c8d;font-size:0.9rem;">Fiche sa pa ka modifye ankò (5 minit deja pase)</div>`}</div>`;
    });
    list.innerHTML = html;
}

function groupBetsByType(bets) {
    const groups = {};
    bets.forEach(bet => {
        const key = bet.name;
        if (!groups[key]) groups[key] = [];
        groups[key].push({...bet});
    });
    return groups;
}

window.loadTicketForEdit = function(ticketId) {
    console.log("Charger ticket pour modification:", ticketId);
    let ticket = savedTickets.find(t => t._id === ticketId);
    if (!ticket) {
        showNotification("Fiche pa jwenn", "error");
        return;
    }
    const ticketDate = new Date(ticket.date);
    const now = new Date();
    const timeDiff = now - ticketDate;
    if (timeDiff > FIVE_MINUTES) {
        showNotification("Fiche sa pa ka modifye ankò. 5 minit deja pase.", "warning");
        return;
    }
    if (!confirm(`Èske ou vreman vle modifye fiche #${String(ticket.number).padStart(6, '0')}?`)) return;
    activeBets = [...ticket.bets];
    currentDraw = ticket.draw;
    currentDrawTime = ticket.drawTime;
    savedTickets = savedTickets.filter(t => t._id !== ticketId);
    updateBetsList();
    updateTicketManagementScreen();
    openBettingScreen(ticket.draw, ticket.drawTime);
    showNotification(`Fiche #${String(ticket.number).padStart(6, '0')} chaje pou modification`, "success");
};

window.deleteTicket = function(ticketId) {
    let ticket = savedTickets.find(t => t._id === ticketId);
    if (!ticket) {
        showNotification("Fiche pa jwenn", "error");
        return;
    }
    const ticketDate = new Date(ticket.date);
    const now = new Date();
    const timeDiff = now - ticketDate;
    if (timeDiff > FIVE_MINUTES) {
        showNotification("Fiche sa pa ka efase ankò. 5 minit deja pase.", "warning");
        return;
    }
    if (!confirm(`Èske ou vreman vle efase fiche #${String(ticket.number).padStart(6, '0')}?`)) return;
    savedTickets = savedTickets.filter(t => t._id !== ticketId);
    updateTicketManagementScreen();
    showNotification(`Fiche #${String(ticket.number).padStart(6, '0')} efase avèk siksè`, "success");
};