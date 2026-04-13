const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise_a_changer_en_prod';
const SALT_ROUNDS = 10;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

let db;
async function initializeDatabase() {
    db = await open({ filename: './database.sqlite', driver: sqlite3.Database });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            email TEXT,
            phone TEXT,
            role TEXT NOT NULL CHECK(role IN ('agent', 'supervisor', 'subsystem', 'master')),
            level INTEGER DEFAULT NULL,
            subsystem_id INTEGER DEFAULT NULL,
            supervisor_id INTEGER DEFAULT NULL,
            supervisor2_id INTEGER DEFAULT NULL,
            is_active BOOLEAN DEFAULT 1,
            is_online BOOLEAN DEFAULT 0,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subsystem_id) REFERENCES subsystems(id),
            FOREIGN KEY (supervisor_id) REFERENCES users(id),
            FOREIGN KEY (supervisor2_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS subsystems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            subdomain TEXT UNIQUE NOT NULL,
            contact_email TEXT,
            contact_phone TEXT,
            max_users INTEGER DEFAULT 10,
            subscription_type TEXT DEFAULT 'standard',
            subscription_expires DATE,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_number TEXT UNIQUE NOT NULL,
            agent_id INTEGER NOT NULL,
            subsystem_id INTEGER NOT NULL,
            draw TEXT NOT NULL,
            draw_time TEXT NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'active',
            is_synced BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES users(id),
            FOREIGN KEY (subsystem_id) REFERENCES subsystems(id)
        );

        CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            bet_type TEXT NOT NULL,
            numbers TEXT NOT NULL,
            amount REAL NOT NULL,
            multiplier REAL NOT NULL,
            options TEXT,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            draw TEXT NOT NULL,
            draw_time TEXT NOT NULL,
            draw_date DATE NOT NULL,
            lot1 TEXT NOT NULL,
            lot2 TEXT,
            lot3 TEXT,
            verified BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(draw, draw_time, draw_date)
        );

        CREATE TABLE IF NOT EXISTS winning_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            winning_amount REAL NOT NULL,
            paid BOOLEAN DEFAULT 0,
            paid_at DATETIME,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Paramètres par défaut
    const defaultSettings = {
        'borlette_first': '60', 'borlette_second': '20', 'borlette_third': '10',
        'lotto3': '500', 'lotto4': '5000', 'lotto5': '25000',
        'grap': '500', 'marriage': '1000',
        'company_name': 'Lotato', 'company_phone': '+509 32 53 49 58', 'company_address': 'Cap Haïtien'
    };
    for (const [key, value] of Object.entries(defaultSettings)) {
        await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }

    // --- Création des utilisateurs de démonstration (si la base est vide) ---
    const userCount = await db.get("SELECT COUNT(*) as count FROM users");
    if (userCount.count === 0) {
        console.log('📦 Initialisation des données de démonstration...');

        // 1. Créer un sous-système par défaut
        const subResult = await db.run(
            "INSERT INTO subsystems (name, subdomain, contact_email, max_users) VALUES (?, ?, ?, ?)",
            ['Sous-système Démo', 'demo', 'demo@lotato.local', 20]
        );
        const subsystemId = subResult.lastID;

        // 2. Master (mot de passe: master123)
        const masterHash = await bcrypt.hash('master123', SALT_ROUNDS);
        await db.run(
            "INSERT INTO users (username, password, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)",
            ['master', masterHash, 'Administrateur Master', 'master', 1]
        );

        // 3. Propriétaire du sous-système (mot de passe: 123)
        const ownerHash = await bcrypt.hash('123', SALT_ROUNDS);
        await db.run(
            "INSERT INTO users (username, password, full_name, role, subsystem_id, is_active) VALUES (?, ?, ?, ?, ?, ?)",
            ['proprietaire', ownerHash, 'Propriétaire Démo', 'subsystem', subsystemId, 1]
        );

        // 4. Superviseur niveau 1 (mot de passe: 123)
        const sup1Hash = await bcrypt.hash('123', SALT_ROUNDS);
        const sup1Result = await db.run(
            "INSERT INTO users (username, password, full_name, role, level, subsystem_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ['superviseur1', sup1Hash, 'Superviseur Niveau 1', 'supervisor', 1, subsystemId, 1]
        );
        const sup1Id = sup1Result.lastID;

        // 5. Superviseur niveau 2 (mot de passe: 123)
        const sup2Hash = await bcrypt.hash('123', SALT_ROUNDS);
        const sup2Result = await db.run(
            "INSERT INTO users (username, password, full_name, role, level, subsystem_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ['superviseur2', sup2Hash, 'Superviseur Niveau 2', 'supervisor', 2, subsystemId, 1]
        );
        const sup2Id = sup2Result.lastID;

        // 6. Agent (mot de passe: 123), assigné aux deux superviseurs
        const agentHash = await bcrypt.hash('123', SALT_ROUNDS);
        await db.run(
            "INSERT INTO users (username, password, full_name, role, subsystem_id, supervisor_id, supervisor2_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ['agent1', agentHash, 'Agent Démo', 'agent', subsystemId, sup1Id, sup2Id, 1]
        );

        console.log('✅ Données de démonstration créées :');
        console.log('   - master / master123');
        console.log('   - proprietaire / 123');
        console.log('   - superviseur1 / 123');
        console.log('   - superviseur2 / 123');
        console.log('   - agent1 / 123');
    } else {
        // S'assurer que le master existe toujours (au cas où la base aurait été modifiée)
        const masterExists = await db.get("SELECT id FROM users WHERE role = 'master'");
        if (!masterExists) {
            const masterHash = await bcrypt.hash('master123', SALT_ROUNDS);
            await db.run(
                "INSERT INTO users (username, password, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)",
                ['master', masterHash, 'Administrateur Master', 'master', 1]
            );
            console.log('✅ Compte master créé (master / master123)');
        }
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const altToken = req.headers['x-auth-token'];
    const finalToken = token || altToken;
    if (!finalToken) return res.status(401).json({ error: 'Token manquant' });
    jwt.verify(finalToken, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });
        req.user = user;
        next();
    });
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
        next();
    };
}

// -------------------- ROUTES API --------------------

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
        if (!user) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
        if (!user.is_active) return res.status(403).json({ success: false, error: 'Compte désactivé' });

        await db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP, is_online = 1 WHERE id = ?", [user.id]);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, level: user.level, subsystem_id: user.subsystem_id },
            JWT_SECRET, { expiresIn: '24h' }
        );

        let redirectUrl = '/lotato.html';
        if (user.role === 'supervisor') redirectUrl = user.level === 1 ? '/control-level1.html' : '/control-level2.html';
        else if (user.role === 'subsystem') redirectUrl = '/subsystem-admin.html';
        else if (user.role === 'master') redirectUrl = '/master-dashboard.html';

        await db.run("INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [user.id, 'login', `Connexion réussie (${user.role})`, req.ip]);

        res.json({ success: true, token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, level: user.level, subsystem_id: user.subsystem_id }, redirectUrl });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    await db.run("UPDATE users SET is_online = 0 WHERE id = ?", [req.user.id]);
    res.json({ success: true });
});

app.get('/api/auth/check', authenticateToken, async (req, res) => {
    const user = await db.get("SELECT id, username, full_name, role, level, subsystem_id, email, is_active FROM users WHERE id = ?", [req.user.id]);
    res.json({ success: true, user });
});

// Utilisateurs du sous-système
app.get('/api/subsystem/users', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
    const { role, search } = req.query;
    let subsystemId = req.user.subsystem_id;
    if (req.user.role === 'master' && req.query.subsystem_id) subsystemId = req.query.subsystem_id;

    let query = `SELECT u.*, s1.full_name as supervisor1_name, s2.full_name as supervisor2_name FROM users u LEFT JOIN users s1 ON u.supervisor_id = s1.id LEFT JOIN users s2 ON u.supervisor2_id = s2.id WHERE u.subsystem_id = ? AND u.role != 'subsystem'`;
    const params = [subsystemId];
    if (role) { query += " AND u.role = ?"; params.push(role); }
    if (search) { query += " AND (u.full_name LIKE ? OR u.username LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
    query += " ORDER BY u.created_at DESC";

    const users = await db.all(query, params);
    res.json({ success: true, users });
});

app.post('/api/subsystem/users/create', authenticateToken, requireRole('subsystem'), async (req, res) => {
    const { name, username, password, role, level, supervisorId } = req.body;
    const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà pris' });
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.run(
        "INSERT INTO users (full_name, username, password, role, level, subsystem_id, supervisor_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name, username, hashed, role, level || null, req.user.subsystem_id, supervisorId || null]
    );
    await db.run("INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
        [req.user.id, 'create_user', `Création de ${username} (${role})`, req.ip]);
    res.json({ success: true, userId: result.lastID });
});

app.put('/api/subsystem/users/:id', authenticateToken, requireRole('subsystem'), async (req, res) => {
    const { name, is_active, password } = req.body;
    let query = "UPDATE users SET full_name = ?, is_active = ?";
    const params = [name, is_active ? 1 : 0];
    if (password) { query += ", password = ?"; params.push(await bcrypt.hash(password, SALT_ROUNDS)); }
    query += " WHERE id = ? AND subsystem_id = ?";
    params.push(req.params.id, req.user.subsystem_id);
    await db.run(query, params);
    res.json({ success: true });
});

app.put('/api/subsystem/users/:id/status', authenticateToken, requireRole('subsystem'), async (req, res) => {
    await db.run("UPDATE users SET is_active = ? WHERE id = ? AND subsystem_id = ?", [req.body.is_active ? 1 : 0, req.params.id, req.user.subsystem_id]);
    res.json({ success: true });
});

// Tickets
app.post('/api/tickets', authenticateToken, requireRole('agent'), async (req, res) => {
    const { ticket } = req.body;
    const agentId = req.user.id;
    const subsystemId = req.user.subsystem_id;
    const ticketNumber = 'T' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const result = await db.run(
        "INSERT INTO tickets (ticket_number, agent_id, subsystem_id, draw, draw_time, total_amount, status, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [ticketNumber, agentId, subsystemId, ticket.draw, ticket.draw_time, ticket.total, 'active', 1]
    );
    const ticketId = result.lastID;
    for (const bet of ticket.bets) {
        await db.run("INSERT INTO bets (ticket_id, bet_type, numbers, amount, multiplier, options) VALUES (?, ?, ?, ?, ?, ?)",
            [ticketId, bet.type, bet.number, bet.amount, bet.multiplier, JSON.stringify(bet.options || null)]);
    }
    await db.run("INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
        [agentId, 'create_ticket', `Ticket ${ticketNumber} - ${ticket.total} HTG`, req.ip]);
    res.json({ success: true, ticketId, ticketNumber });
});

app.get('/api/tickets', authenticateToken, async (req, res) => {
    let query = `SELECT t.*, u.full_name as agent_name FROM tickets t JOIN users u ON t.agent_id = u.id WHERE t.subsystem_id = ?`;
    const params = [req.user.subsystem_id];
    if (req.user.role === 'agent') { query += " AND t.agent_id = ?"; params.push(req.user.id); }
    if (req.query.date) { query += " AND DATE(t.created_at) = DATE(?)"; params.push(req.query.date); }
    query += " ORDER BY t.created_at DESC LIMIT 100";
    const tickets = await db.all(query, params);
    for (const t of tickets) t.bets = await db.all("SELECT * FROM bets WHERE ticket_id = ?", [t.id]);
    res.json({ success: true, tickets });
});

app.get('/api/results', async (req, res) => {
    const results = await db.all("SELECT * FROM results ORDER BY draw_date DESC, draw_time DESC LIMIT 50");
    const formatted = {};
    for (const r of results) {
        if (!formatted[r.draw]) formatted[r.draw] = {};
        if (!formatted[r.draw][r.draw_time]) formatted[r.draw][r.draw_time] = {};
        formatted[r.draw][r.draw_time] = { date: r.draw_date, lot1: r.lot1, lot2: r.lot2, lot3: r.lot3, verified: r.verified };
    }
    res.json({ success: true, results: formatted });
});

app.post('/api/results', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
    const { draw, draw_time, draw_date, lot1, lot2, lot3, verified } = req.body;
    await db.run("INSERT OR REPLACE INTO results (draw, draw_time, draw_date, lot1, lot2, lot3, verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [draw, draw_time, draw_date, lot1, lot2, lot3, verified ? 1 : 0]);
    res.json({ success: true });
});

app.get('/api/tickets/winning', authenticateToken, async (req, res) => {
    const winners = await db.all(`SELECT w.*, t.ticket_number FROM winning_tickets w JOIN tickets t ON w.ticket_id = t.id WHERE t.subsystem_id = ?`, [req.user.subsystem_id]);
    res.json({ success: true, tickets: winners });
});

app.get('/api/settings', async (req, res) => {
    const settings = await db.all("SELECT key, value FROM settings");
    const obj = {};
    settings.forEach(s => obj[s.key] = s.value);
    res.json({ success: true, settings: obj });
});

app.post('/api/settings', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
    for (const [k, v] of Object.entries(req.body.settings)) {
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, v]);
    }
    res.json({ success: true });
});

app.get('/api/subsystem/stats', authenticateToken, async (req, res) => {
    const [activeUsers, todayTickets, todaySales, maxUsers] = await Promise.all([
        db.get("SELECT COUNT(*) as count FROM users WHERE subsystem_id = ? AND is_active = 1", [req.user.subsystem_id]),
        db.get("SELECT COUNT(*) as count FROM tickets WHERE subsystem_id = ? AND DATE(created_at) = DATE('now')", [req.user.subsystem_id]),
        db.get("SELECT COALESCE(SUM(total_amount),0) as total FROM tickets WHERE subsystem_id = ? AND DATE(created_at) = DATE('now')", [req.user.subsystem_id]),
        db.get("SELECT max_users FROM subsystems WHERE id = ?", [req.user.subsystem_id])
    ]);
    res.json({ success: true, stats: { active_users: activeUsers.count, today_tickets: todayTickets.count, today_sales: todaySales.total, max_users: maxUsers?.max_users || 10 } });
});

// Master
app.get('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
    const subs = await db.all(`SELECT s.*, (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND role = 'agent') as agents_count, (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND is_active = 1) as active_users FROM subsystems s ORDER BY s.created_at DESC`);
    res.json({ success: true, subsystems: subs });
});

app.post('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
    const { name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_months } = req.body;
    const expires = new Date(); expires.setMonth(expires.getMonth() + (subscription_months || 1));
    const result = await db.run(
        "INSERT INTO subsystems (name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_expires) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name, subdomain, contact_email, contact_phone, max_users, subscription_type, expires.toISOString().split('T')[0]]
    );
    const subsystemId = result.lastID;
    const adminUsername = `admin_${subdomain}`;
    const adminPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await db.run("INSERT INTO users (username, password, full_name, role, subsystem_id, is_active) VALUES (?, ?, ?, ?, ?, ?)",
        [adminUsername, hashed, `Admin ${name}`, 'subsystem', subsystemId, 1]);
    res.json({ success: true, subsystemId, admin_credentials: { username: adminUsername, password: adminPassword, email: contact_email } });
});

app.put('/api/master/subsystems/:id/deactivate', authenticateToken, requireRole('master'), async (req, res) => {
    await db.run("UPDATE subsystems SET is_active = 0 WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

app.put('/api/master/subsystems/:id/activate', authenticateToken, requireRole('master'), async (req, res) => {
    await db.run("UPDATE subsystems SET is_active = 1 WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

app.delete('/api/master/reset-users', authenticateToken, requireRole('master'), async (req, res) => {
    try {
        await db.run("DELETE FROM users WHERE role != 'master'");
        await db.run("DELETE FROM activity_log");
        res.json({ success: true, message: 'Tous les utilisateurs (sauf master) ont été supprimés.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

app.get('/api/subsystem/activities', authenticateToken, requireRole('subsystem'), async (req, res) => {
    const activities = await db.all(`SELECT a.*, u.full_name as user_name FROM activity_log a LEFT JOIN users u ON a.user_id = u.id WHERE u.subsystem_id = ? ORDER BY a.created_at DESC LIMIT 100`, [req.user.subsystem_id]);
    res.json({ success: true, activities: activities.map(a => ({ user: a.user_name, action: a.action, details: a.details, timestamp: a.created_at })) });
});

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'index.html'));
    else res.status(404).json({ error: 'Endpoint non trouvé' });
});

initializeDatabase().then(() => {
    app.listen(PORT, () => console.log(`🚀 Serveur Lotato sur le port ${PORT}`));
}).catch(err => { console.error(err); process.exit(1); });