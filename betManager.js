// ==================== GESTION DES PARIS ====================
let activeBets = [];
let currentDraw = null;
let currentDrawTime = null;
let selectedBalls = [];

function updateBetsList() {
    const betsList = document.getElementById('bets-list');
    const betTotal = document.getElementById('bet-total');
    betsList.innerHTML = '';
    if (activeBets.length === 0) {
        betsList.innerHTML = '<p>Pa gen okenn parye aktif.</p>';
        betTotal.textContent = '0 goud';
        const notif = document.querySelector('.total-notification');
        if (notif) notif.remove();
        return;
    }
    const grouped = {};
    activeBets.forEach((bet, idx) => {
        const key = bet.isLotto4 || bet.isLotto5 ? `${bet.type}_${bet.number}_${JSON.stringify(bet.options)}` : `${bet.type}_${bet.number}`;
        if (!grouped[key]) grouped[key] = { bet, count: 1, totalAmount: bet.amount, indexes: [idx] };
        else { grouped[key].count++; grouped[key].totalAmount += bet.amount; grouped[key].indexes.push(idx); }
    });
    for (const g of Object.values(grouped)) {
        const bet = g.bet;
        const div = document.createElement('div');
        div.className = 'bet-item';
        if (bet.isGroup) {
            div.innerHTML = `<div class="bet-details"><strong>${bet.name}</strong><br>${bet.number} (${bet.details.length} parye)</div><div class="bet-amount">${g.totalAmount} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        } else if (bet.isLotto4 || bet.isLotto5) {
            let opts = [];
            if (bet.options.option1) opts.push('Opsyon 1');
            if (bet.options.option2) opts.push('Opsyon 2');
            if (bet.options.option3) opts.push('Opsyon 3');
            div.innerHTML = `<div class="bet-details"><strong>${bet.name}</strong><br>${bet.number}<br><small style="color:#7f8c8d;">${opts.join(', ')}</small></div><div class="bet-amount">${g.totalAmount} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        } else {
            div.innerHTML = `<div class="bet-details"><strong>${bet.name}</strong><br>${bet.number}</div><div class="bet-amount">${g.totalAmount} goud <span class="bet-remove" data-indexes="${g.indexes.join(',')}"><i class="fas fa-times"></i></span></div>`;
        }
        betsList.appendChild(div);
        div.querySelector('.bet-remove')?.addEventListener('click', function() {
            const indexes = this.getAttribute('data-indexes').split(',').map(Number);
            indexes.sort((a,b)=>b-a).forEach(i => activeBets.splice(i,1));
            updateBetsList();
        });
    }
    const total = activeBets.reduce((s,b)=>s+b.amount,0);
    betTotal.textContent = `${total} goud`;
    updateNormalBetTotalNotification();
}

function updateNormalBetTotalNotification() {
    const total = activeBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (total > 0) showTotalNotification(total, 'normal');
}

function showTotalNotification(totalAmount, type = 'normal') {
    const container = document.getElementById('total-notification-container');
    const old = document.querySelector('.total-notification');
    if (old) old.remove();
    const notification = document.createElement('div');
    notification.className = 'total-notification';
    let typeText = type === 'multi-draw' ? 'Multi-Tirages' : 'Normal';
    notification.innerHTML = `<i class="fas fa-calculator"></i><span>Total ${typeText}:</span><span class="total-amount">${totalAmount} G</span>`;
    container.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function openBettingScreen(drawId, time = null) {
    currentDraw = drawId;
    currentDrawTime = time;
    const draw = draws[drawId];
    let title = draw.name;
    if (time) title += ` (${time === 'morning' ? 'Maten' : 'Swè'})`;
    document.getElementById('betting-title').textContent = title;
    const bettingScreen = document.getElementById('betting-screen');
    bettingScreen.style.display = 'block';
    bettingScreen.classList.remove('slide-out');
    bettingScreen.classList.add('slide-in');
    document.querySelector('.container').style.display = 'none';
    document.getElementById('games-interface').style.display = 'block';
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('active-bets').style.display = 'block';
    setupGameSelection();
    updateBetsList();
}

function closeBettingScreen() {
    const bettingScreen = document.getElementById('betting-screen');
    bettingScreen.classList.remove('slide-in');
    bettingScreen.classList.add('slide-out');
    setTimeout(() => {
        bettingScreen.style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    }, 300);
}

function setupGameSelection() {
    document.querySelectorAll('.game-item').forEach(item => {
        item.replaceWith(item.cloneNode(true));
    });
    document.querySelectorAll('.game-item').forEach(item => {
        item.addEventListener('click', function() {
            const gameType = this.getAttribute('data-game');
            if (gameType === 'auto-marriage' || gameType === 'auto-lotto4') showAutoGameForm(gameType);
            else showBetForm(gameType);
        });
    });
}

function showBetForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    let formHTML = '';
    switch(gameType) {
        case 'lotto3':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="lotto3-number" placeholder="000" maxlength="3"><input type="number" id="lotto3-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'marriage':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="form-group"><label>2 Chif yo</label><div class="number-inputs"><input type="text" id="marriage-number1" placeholder="00" maxlength="2"><input type="text" id="marriage-number2" placeholder="00" maxlength="2"></div></div><div class="quick-bet-form"><input type="number" id="marriage-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'borlette':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="borlette-number" placeholder="00" maxlength="2"><input type="number" id="borlette-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div><div class="n-balls-container">${'0123456789'.split('').map(n => `<div class="n-ball" data-n="${n}">N${n}</div>`).join('')}</div>`;
            break;
        case 'boulpe':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="quick-bet-form"><input type="text" id="boulpe-number" placeholder="00" maxlength="2"><input type="number" id="boulpe-amount" placeholder="Kantite" min="1"><button class="btn-primary" id="add-bet">Ajoute</button></div><div class="bet-actions"><button class="btn-secondary" id="return-to-types">Retounen</button></div><div class="n-balls-container">${['00','11','22','33','44','55','66','77','88','99'].map(b => `<div class="n-ball" data-number="${b}">${b}</div>`).join('')}<div class="bo-ball" id="bo-all">BO</div></div>`;
            break;
        case 'lotto4':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="form-group"><label>4 Chif yo</label><div class="number-inputs"><input type="text" id="lotto4-number1" placeholder="00" maxlength="2"><input type="text" id="lotto4-number2" placeholder="00" maxlength="2"></div></div><div class="options-container"><div class="option-checkbox"><input type="checkbox" id="lotto4-option1" checked><label><strong>Opsyon 1:</strong> lot2 + lot3</label><span class="option-multiplier">×5000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto4-option2" checked><label><strong>Opsyon 2:</strong> 2 dènye chif lot1 + lot2</label><span class="option-multiplier">×5000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto4-option3" checked><label><strong>Opsyon 3:</strong> N'importe lòd lot2 ak lot3</label><span class="option-multiplier">×5000</span></div></div><div class="form-group"><label>Kantite pa opsyon</label><input type="number" id="lotto4-amount" min="1" value="1"><small>Total = kantite × nimewo opsyon chwazi</small></div><div class="bet-actions"><button class="btn-primary" id="add-bet">Ajoute</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'lotto5':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="form-group"><label>5 Chif yo</label><div class="number-inputs"><input type="text" id="lotto5-number1" placeholder="000" maxlength="3"><input type="text" id="lotto5-number2" placeholder="00" maxlength="2"></div></div><div class="options-container"><div class="option-checkbox"><input type="checkbox" id="lotto5-option1" checked><label><strong>Opsyon 1:</strong> lot1 + lot2</label><span class="option-multiplier">×25000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto5-option2" checked><label><strong>Opsyon 2:</strong> lot1 + lot3</label><span class="option-multiplier">×25000</span></div><div class="option-checkbox"><input type="checkbox" id="lotto5-option3" checked><label><strong>Opsyon 3:</strong> N'importe fason 5 boul yo</label><span class="option-multiplier">×25000</span></div></div><div class="form-group"><label>Kantite pa opsyon</label><input type="number" id="lotto5-amount" min="1" value="1"><small>Total = kantite × nimewo opsyon chwazi</small></div><div class="bet-actions"><button class="btn-primary" id="add-bet">Ajoute</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
        case 'grap':
            formHTML = `<h3>${bet.name} - ${bet.description}</h3><div style="margin-bottom:15px;"><div class="all-graps-btn" id="select-all-graps">Chwazi Tout Graps</div><div class="all-graps-btn" id="deselect-all-graps">Retire Tout Graps</div></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;" id="grap-selection-container">${['111','222','333','444','555','666','777','888','999','000'].map(g => `<div class="pair-ball" data-pair="${g}">${g}</div>`).join('')}</div><div class="form-group"><label>Kantite pou chak grap</label><input type="number" id="grap-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-selected-graps">Ajoute Graps Chwazi</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
            break;
    }
    betForm.innerHTML = formHTML;
    setupAutoFocusInputs();
    if (gameType === 'grap') setupGrapSelection();
    else document.getElementById('add-bet')?.addEventListener('click', () => addBet(gameType));
    document.getElementById('return-to-types')?.addEventListener('click', () => {
        betForm.style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    });
    if (gameType === 'boulpe') {
        document.querySelectorAll('.n-ball[data-number]').forEach(ball => {
            ball.addEventListener('click', () => {
                document.getElementById('boulpe-number').value = ball.getAttribute('data-number');
                document.getElementById('boulpe-amount').focus();
            });
        });
        document.getElementById('bo-all')?.addEventListener('click', () => {
            const amount = prompt("Kantite pou chak boule pe (00-99):", "1");
            if (amount && !isNaN(amount) && amount > 0) {
                const numbers = ['00','11','22','33','44','55','66','77','88','99'];
                activeBets.push({ type: gameType, name: 'BOUL PE (Tout)', number: '00-99', amount: parseInt(amount) * numbers.length, multiplier: bet.multiplier, isGroup: true, details: numbers.map(n => ({number: n, amount: parseInt(amount)})) });
                updateBetsList();
                showNotification(`${numbers.length} boule pe ajoute!`, "success");
            }
        });
    }
    if (gameType === 'borlette') {
        document.querySelectorAll('.n-ball[data-n]').forEach(ball => {
            ball.addEventListener('click', () => {
                const n = ball.getAttribute('data-n');
                const numbers = Array.from({length:10}, (_,i) => i.toString()+n);
                const amount = prompt(`Kantite pou chak boule nan N${n}:`, "1");
                if (amount && !isNaN(amount) && amount > 0) {
                    activeBets.push({ type: gameType, name: `N${n} (Tout)`, number: `0${n}-9${n}`, amount: parseInt(amount) * numbers.length, multiplier: bet.multiplier, isGroup: true, details: numbers.map(num => ({number: num, amount: parseInt(amount)})) });
                    updateBetsList();
                    showNotification(`${numbers.length} boule N${n} ajoute!`, "success");
                }
            });
        });
    }
    const firstInput = betForm.querySelector('input[type="text"]');
    if (firstInput) firstInput.focus();
    document.getElementById('active-bets').style.display = 'block';
}

function setupAutoFocusInputs() {
    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', function(e) {
            const maxLen = parseInt(this.getAttribute('maxlength'));
            if (maxLen && this.value.length >= maxLen) {
                const all = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
                const idx = all.indexOf(this);
                if (idx < all.length-1) all[idx+1].focus();
            }
        });
        input.addEventListener('keydown', function(e) {
            const all = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
            const idx = all.indexOf(this);
            if (e.key === 'ArrowRight' && idx < all.length-1) { e.preventDefault(); all[idx+1].focus(); }
            else if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); all[idx-1].focus(); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (idx < all.length-1) all[idx+1].focus();
                else document.getElementById('add-bet')?.click();
            }
        });
    });
}

function setupGrapSelection() {
    let selectedGraps = new Set();
    const grapBalls = document.querySelectorAll('#grap-selection-container .pair-ball');
    grapBalls.forEach(ball => {
        ball.addEventListener('click', () => {
            ball.classList.toggle('selected');
            const pair = ball.getAttribute('data-pair');
            if (ball.classList.contains('selected')) selectedGraps.add(pair);
            else selectedGraps.delete(pair);
        });
    });
    document.getElementById('select-all-graps')?.addEventListener('click', () => {
        grapBalls.forEach(b => { b.classList.add('selected'); selectedGraps.add(b.getAttribute('data-pair')); });
    });
    document.getElementById('deselect-all-graps')?.addEventListener('click', () => {
        grapBalls.forEach(b => { b.classList.remove('selected'); selectedGraps.delete(b.getAttribute('data-pair')); });
    });
    document.getElementById('add-selected-graps')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('grap-amount').value);
        const selected = document.querySelectorAll('#grap-selection-container .pair-ball.selected');
        if (selected.length === 0) { showNotification("Tanpri chwazi omwen yon grap", "warning"); return; }
        if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab", "warning"); return; }
        selected.forEach(ball => {
            const pair = ball.getAttribute('data-pair');
            activeBets.push({ type: 'grap', name: 'GRAP', number: pair, amount: amount, multiplier: betTypes.grap.multiplier });
            ball.classList.remove('selected');
            selectedGraps.delete(pair);
        });
        updateBetsList();
        showNotification(`${selected.length} graps ajoute!`, "success");
        document.getElementById('grap-amount').value = '1';
    });
}

function addBet(betType) {
    const bet = betTypes[betType];
    let number, amount;
    switch(betType) {
        case 'lotto3':
            number = document.getElementById('lotto3-number').value;
            amount = parseInt(document.getElementById('lotto3-amount').value);
            if (!/^\d{3}$/.test(number)) { showNotification("Lotto 3 dwe gen 3 chif", "warning"); return; }
            break;
        case 'marriage':
            const n1 = document.getElementById('marriage-number1').value;
            const n2 = document.getElementById('marriage-number2').value;
            number = `${n1}*${n2}`;
            amount = parseInt(document.getElementById('marriage-amount').value);
            if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) { showNotification("Chak chif maryaj dwe gen 2 chif", "warning"); return; }
            break;
        case 'borlette':
            number = document.getElementById('borlette-number').value;
            amount = parseInt(document.getElementById('borlette-amount').value);
            if (!/^\d{2}$/.test(number)) { showNotification("Borlette dwe gen 2 chif", "warning"); return; }
            break;
        case 'boulpe':
            number = document.getElementById('boulpe-number').value;
            amount = parseInt(document.getElementById('boulpe-amount').value);
            if (!/^\d{2}$/.test(number)) { showNotification("Boul pe dwe gen 2 chif", "warning"); return; }
            if (number[0] !== number[1]) { showNotification("Pou boul pe, fòk de chif yo menm!", "warning"); return; }
            break;
        case 'lotto4':
            const n4_1 = document.getElementById('lotto4-number1').value;
            const n4_2 = document.getElementById('lotto4-number2').value;
            number = n4_1 + n4_2;
            const opt1 = document.getElementById('lotto4-option1')?.checked || false;
            const opt2 = document.getElementById('lotto4-option2')?.checked || false;
            const opt3 = document.getElementById('lotto4-option3')?.checked || false;
            amount = parseInt(document.getElementById('lotto4-amount').value);
            if (!/^\d{2}$/.test(n4_1) || !/^\d{2}$/.test(n4_2)) { showNotification("Chak boule Lotto 4 dwe gen 2 chif", "warning"); return; }
            const optsCount = [opt1,opt2,opt3].filter(Boolean).length;
            if (optsCount === 0) { showNotification("Tanpri chwazi omwen yon opsyon", "warning"); return; }
            activeBets.push({ type: betType, name: bet.name, number, amount: amount * optsCount, multiplier: bet.multiplier, options: { option1: opt1, option2: opt2, option3: opt3 }, perOptionAmount: amount, isLotto4: true });
            updateBetsList();
            showNotification("Lotto 4 ajoute!", "success");
            closeBetForm();
            return;
        case 'lotto5':
            const n5_1 = document.getElementById('lotto5-number1').value;
            const n5_2 = document.getElementById('lotto5-number2').value;
            number = n5_1 + n5_2;
            const o1 = document.getElementById('lotto5-option1')?.checked || false;
            const o2 = document.getElementById('lotto5-option2')?.checked || false;
            const o3 = document.getElementById('lotto5-option3')?.checked || false;
            amount = parseInt(document.getElementById('lotto5-amount').value);
            if (!/^\d{3}$/.test(n5_1) || !/^\d{2}$/.test(n5_2)) { showNotification("Lotto 5: Premye boule 3 chif, Dezyèm 2 chif", "warning"); return; }
            const opts5Count = [o1,o2,o3].filter(Boolean).length;
            if (opts5Count === 0) { showNotification("Tanpri chwazi omwen yon opsyon", "warning"); return; }
            activeBets.push({ type: betType, name: bet.name, number, amount: amount * opts5Count, multiplier: bet.multiplier, options: { option1: o1, option2: o2, option3: o3 }, perOptionAmount: amount, isLotto5: true });
            updateBetsList();
            showNotification("Lotto 5 ajoute!", "success");
            closeBetForm();
            return;
        default:
            return;
    }
    if (!number || isNaN(amount) || amount <= 0) { showNotification("Nimewo ak kantite valab", "warning"); return; }
    activeBets.push({ type: betType, name: bet.name, number, amount, multiplier: bet.multiplier });
    updateBetsList();
    showNotification("Parye ajoute!", "success");
    closeBetForm();
}

function closeBetForm() {
    document.getElementById('bet-form').style.display = 'none';
    document.getElementById('games-interface').style.display = 'block';
}

function showAutoGameForm(gameType) {
    const bet = betTypes[gameType];
    document.getElementById('games-interface').style.display = 'none';
    document.getElementById('bet-type-nav').style.display = 'none';
    document.getElementById('auto-buttons').style.display = 'none';
    const betForm = document.getElementById('bet-form');
    betForm.style.display = 'block';
    selectedBalls = [];
    let formHTML = '';
    if (gameType === 'auto-marriage') {
        formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="options-container"><div><div class="all-graps-btn" id="use-basket-balls">Itilize Boul nan Panye</div><div class="all-graps-btn" id="enter-manual-balls">Antre Boul Manyèlman</div></div><div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56 78"><button class="btn-primary" id="process-manual-balls">Proses Boul yo</button></div><div><strong>Boules disponib:</strong><div id="available-balls-list"></div></div><div><div class="all-graps-btn" id="clear-balls-btn">Retire Tout Boul</div></div><div><strong>Boules sélectionnées:</strong><div id="selected-balls-list">Pa gen boul chwazi</div></div></div><div class="form-group"><label>Kantite pou chak maryaj</label><input type="number" id="auto-game-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-auto-marriages">Ajoute Maryaj Otomatik</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    } else if (gameType === 'auto-lotto4') {
        formHTML = `<h3>${bet.name} - ${bet.description}</h3><div class="options-container"><div><div class="all-graps-btn" id="use-basket-balls">Itilize Boul nan Panye</div><div class="all-graps-btn" id="enter-manual-balls">Antre Boul Manyèlman</div></div><div id="manual-balls-input" style="display:none;"><input type="text" id="manual-balls" placeholder="12 34 56 78"><button class="btn-primary" id="process-manual-balls">Proses Boul yo</button></div><div><strong>Boules disponib:</strong><div id="available-balls-list"></div></div><div><div class="all-graps-btn" id="clear-balls-btn">Retire Tout Boul</div></div><div><strong>Boules sélectionnées:</strong><div id="selected-balls-list">Pa gen boul chwazi</div></div><div><label><input type="checkbox" id="include-reverse" checked> Enkli renverse yo</label></div></div><div class="form-group"><label>Kantite pou chak Lotto 4</label><input type="number" id="auto-game-amount" min="1" value="1"></div><div class="bet-actions"><button class="btn-primary" id="add-auto-lotto4">Ajoute Lotto 4 Otomatik</button><button class="btn-secondary" id="return-to-types">Retounen</button></div>`;
    }
    betForm.innerHTML = formHTML;
    document.getElementById('use-basket-balls')?.addEventListener('click', loadBasketBalls);
    document.getElementById('enter-manual-balls')?.addEventListener('click', () => { document.getElementById('manual-balls-input').style.display = 'block'; });
    document.getElementById('process-manual-balls')?.addEventListener('click', processManualBalls);
    document.getElementById('clear-balls-btn')?.addEventListener('click', () => { selectedBalls = []; updateSelectedBallsList(); updateAvailableBallsList(); });
    if (gameType === 'auto-marriage') document.getElementById('add-auto-marriages')?.addEventListener('click', addAutoMarriages);
    else document.getElementById('add-auto-lotto4')?.addEventListener('click', addAutoLotto4);
    document.getElementById('return-to-types')?.addEventListener('click', () => {
        betForm.style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
    });
    document.getElementById('active-bets').style.display = 'block';
}

function loadBasketBalls() {
    const basket = [];
    activeBets.forEach(bet => {
        if (bet.type === 'borlette' || bet.type === 'boulpe') {
            if (bet.isGroup) bet.details.forEach(d => { if (/^\d{2}$/.test(d.number)) basket.push(d.number); });
            else if (/^\d{2}$/.test(bet.number)) basket.push(bet.number);
        }
    });
    selectedBalls = [...new Set(basket)];
    if (selectedBalls.length === 0) showNotification("Pa gen boul borlette nan panye a", "warning");
    else { updateSelectedBallsList(); updateAvailableBallsList(); showNotification(`${selectedBalls.length} boul chaje`, "success"); }
}

function processManualBalls() {
    const input = document.getElementById('manual-balls').value.trim();
    if (!input) { showNotification("Antre kèk boul", "warning"); return; }
    const balls = input.split(/\s+/);
    const valid = [], invalid = [];
    balls.forEach(b => { if (/^\d{2}$/.test(b)) valid.push(b); else invalid.push(b); });
    if (valid.length === 0) { showNotification("Pa gen boul valab. Boul yo dwe gen 2 chif.", "warning"); return; }
    selectedBalls = [...new Set(valid)];
    updateSelectedBallsList(); updateAvailableBallsList();
    let msg = `${selectedBalls.length} boul valab ajoute`;
    if (invalid.length) msg += `. ${invalid.length} boul envalid: ${invalid.join(', ')}`;
    showNotification(msg, "success");
    document.getElementById('manual-balls-input').style.display = 'none';
    document.getElementById('manual-balls').value = '';
}

function updateAvailableBallsList() {
    const container = document.getElementById('available-balls-list');
    if (!container) return;
    if (selectedBalls.length === 0) { container.innerHTML = '<p>Pa gen boul disponib.</p>'; return; }
    container.innerHTML = '';
    selectedBalls.forEach((ball, i) => {
        const tag = document.createElement('div');
        tag.className = 'ball-tag';
        tag.innerHTML = `${ball}<span class="remove-ball" onclick="removeBall(${i})"><i class="fas fa-times"></i></span>`;
        container.appendChild(tag);
    });
}

window.removeBall = function(i) { selectedBalls.splice(i,1); updateSelectedBallsList(); updateAvailableBallsList(); };
function updateSelectedBallsList() {
    const container = document.getElementById('selected-balls-list');
    if (!container) return;
    if (selectedBalls.length === 0) container.innerHTML = "Pa gen boul chwazi";
    else container.innerHTML = selectedBalls.join(', ');
}

function addAutoMarriages() {
    const amount = parseInt(document.getElementById('auto-game-amount').value);
    if (selectedBalls.length < 2) { showNotification("Fò gen omwen 2 boul", "warning"); return; }
    if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab", "warning"); return; }
    let added = 0;
    for (let i=0; i<selectedBalls.length; i++) {
        for (let j=i+1; j<selectedBalls.length; j++) {
            activeBets.push({ type: 'marriage', name: 'MARYAJ OTOMATIK', number: `${selectedBalls[i]}*${selectedBalls[j]}`, amount, multiplier: betTypes.marriage.multiplier, isAuto: true });
            added++;
        }
    }
    updateBetsList();
    showNotification(`${added} maryaj otomatik ajoute!`, "success");
    setTimeout(() => {
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
        selectedBalls = [];
    }, 500);
}

function addAutoLotto4() {
    const amount = parseInt(document.getElementById('auto-game-amount').value);
    const includeReverse = document.getElementById('include-reverse')?.checked || false;
    if (selectedBalls.length < 2) { showNotification("Fò gen omwen 2 boul", "warning"); return; }
    if (isNaN(amount) || amount <= 0) { showNotification("Kantite valab", "warning"); return; }
    let added = 0;
    for (let i=0; i<selectedBalls.length; i++) {
        for (let j=i+1; j<selectedBalls.length; j++) {
            const ball1 = selectedBalls[i], ball2 = selectedBalls[j];
            activeBets.push({ type: 'lotto4', name: 'LOTO 4 OTOMATIK', number: ball1+ball2, amount, multiplier: betTypes.lotto4.multiplier, isAuto: true, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
            added++;
            if (includeReverse) {
                activeBets.push({ type: 'lotto4', name: 'LOTO 4 OTOMATIK (RENVÈSE)', number: ball2+ball1, amount, multiplier: betTypes.lotto4.multiplier, isAuto: true, options: { option1: false, option2: false, option3: true }, perOptionAmount: amount });
                added++;
            }
        }
    }
    updateBetsList();
    showNotification(`${added} Lotto 4 otomatik ajoute!`, "success");
    setTimeout(() => {
        document.getElementById('bet-form').style.display = 'none';
        document.getElementById('games-interface').style.display = 'block';
        selectedBalls = [];
    }, 500);
}

function submitBets() {
    if (activeBets.length === 0) { showNotification("Pa gen okenn parye pou soumèt", "warning"); return; }
    let drawInfo = draws[currentDraw].name;
    if (currentDrawTime) drawInfo += ` (${currentDrawTime === 'morning' ? 'Maten' : 'Swè'})`;
    showNotification(`${activeBets.length} parye soumèt pou ${drawInfo}!`, "success");
    saveBetsToHistory();
    activeBets = [];
    updateBetsList();
    closeBettingScreen();
}

async function saveBetsToHistory() {
    try {
        const record = {
            action: 'Soumèt parye',
            details: `${activeBets.length} parye - Total ${activeBets.reduce((s,b)=>s+b.amount,0)} G`
        };
        await apiCall(APP_CONFIG.history, 'POST', record);
    } catch(e) { console.error(e); showNotification("Erreur sauvegarde historique", "error"); }
}