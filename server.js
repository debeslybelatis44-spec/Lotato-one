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

// Configuration
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise_a_changer_en_prod';
const SALT_ROUNDS = 10;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Désactivé pour permettre les scripts inline (à améliorer en prod)
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
// Servir tous les fichiers statiques depuis la racine
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration de multer pour l'upload de logos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Base de données SQLite
let db;
async function initializeDatabase() {
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // Création des tables
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
            options TEXT, -- JSON pour Lotto4/Lotto5
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

    // Insérer des données par défaut (master, multiplicateurs)
    const masterExists = await db.get("SELECT id FROM users WHERE role = 'master'");
    if (!masterExists) {
        const hashedPassword = await bcrypt.hash('master123', SALT_ROUNDS);
        await db.run(
            "INSERT INTO users (username, password, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)",
            ['master', hashedPassword, 'Administrateur Master', 'master', 1]
        );
        console.log('✅ Compte master créé (master / master123)');
    }

    // Paramètres par défaut
    const defaultSettings = {
        'borlette_first': '60',
        'borlette_second': '20',
        'borlette_third': '10',
        'lotto3': '500',
        'lotto4': '5000',
        'lotto5': '25000',
        'grap': '500',
        'marriage': '1000',
        'company_name': 'Lotato',
        'company_phone': '+509 32 53 49 58',
        'company_address': 'Cap Haïtien'
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
        await db.run(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            [key, value]
        );
    }
}

// Middleware d'authentification
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        // Essayer aussi x-auth-token pour compatibilité
        const altToken = req.headers['x-auth-token'];
        if (altToken) {
            jwt.verify(altToken, JWT_SECRET, (err, user) => {
                if (err) return res.status(403).json({ error: 'Token invalide' });
                req.user = user;
                next();
            });
            return;
        }
        return res.status(401).json({ error: 'Token manquant' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });
        req.user = user;
        next();
    });
}

// Middleware de vérification de rôle
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        next();
    };
}

// ==================== ROUTES API ====================

// --- Authentification ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        const user = await db.get(
            "SELECT * FROM users WHERE username = ? AND role = ?",
            [username, role]
        );

        if (!user) {
            return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
        }

        if (!user.is_active) {
            return res.status(403).json({ success: false, error: 'Compte désactivé' });
        }

        // Mise à jour last_login et is_online
        await db.run(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP, is_online = 1 WHERE id = ?",
            [user.id]
        );

        // Générer le token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, level: user.level, subsystem_id: user.subsystem_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Déterminer l'URL de redirection selon le rôle
        let redirectUrl = '/lotato.html';
        if (user.role === 'supervisor') {
            redirectUrl = user.level === 1 ? '/control-level1.html' : '/control-level2.html';
        } else if (user.role === 'subsystem') {
            redirectUrl = '/subsystem-admin.html';
        } else if (user.role === 'master') {
            redirectUrl = '/master-dashboard.html';
        }

        // Logger l'activité
        await db.run(
            "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [user.id, 'login', `Connexion réussie (${user.role})`, req.ip]
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                level: user.level,
                subsystem_id: user.subsystem_id,
                email: user.email
            },
            redirectUrl
        });
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        await db.run("UPDATE users SET is_online = 0 WHERE id = ?", [req.user.id]);
        await db.run(
            "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [req.user.id, 'logout', 'Déconnexion', req.ip]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/auth/check', authenticateToken, async (req, res) => {
    try {
        const user = await db.get(
            "SELECT id, username, full_name, role, level, subsystem_id, email, is_active FROM users WHERE id = ?",
            [req.user.id]
        );
        if (!user) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// --- Utilisateurs (pour admin sous-système) ---
app.get('/api/subsystem/users', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
    try {
        const { role, search } = req.query;
        let subsystemId = req.user.subsystem_id;
        if (req.user.role === 'master' && req.query.subsystem_id) {
            subsystemId = req.query.subsystem_id;
        }

        let query = `
            SELECT u.*, 
                   s1.full_name as supervisor1_name,
                   s2.full_name as supervisor2_name
            FROM users u
            LEFT JOIN users s1 ON u.supervisor_id = s1.id
            LEFT JOIN users s2 ON u.supervisor2_id = s2.id
            WHERE u.subsystem_id = ? AND u.role != 'subsystem'
        `;
        const params = [subsystemId];

        if (role) {
            query += " AND u.role = ?";
            params.push(role);
        }
        if (search) {
            query += " AND (u.full_name LIKE ? OR u.username LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        query += " ORDER BY u.created_at DESC";

        const users = await db.all(query, params);
        res.json({ success: true, users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/subsystem/users/create', authenticateToken, requireRole('subsystem'), async (req, res) => {
    try {
        const { name, username, password, role, level, supervisorId } = req.body;

        // Vérifier si l'username existe déjà
        const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
        if (existing) {
            return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà pris' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await db.run(
            `INSERT INTO users (full_name, username, password, role, level, subsystem_id, supervisor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, username, hashedPassword, role, level || null, req.user.subsystem_id, supervisorId || null]
        );

        await db.run(
            "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [req.user.id, 'create_user', `Création de l'utilisateur ${username} (${role})`, req.ip]
        );

        res.json({ success: true, userId: result.lastID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.put('/api/subsystem/users/:id', authenticateToken, requireRole('subsystem'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, is_active, password } = req.body;

        let query = "UPDATE users SET full_name = ?, is_active = ?";
        const params = [name, is_active ? 1 : 0];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            query += ", password = ?";
            params.push(hashedPassword);
        }

        query += " WHERE id = ? AND subsystem_id = ?";
        params.push(id, req.user.subsystem_id);

        await db.run(query, params);

        await db.run(
            "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [req.user.id, 'update_user', `Modification de l'utilisateur ID ${id}`, req.ip]
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.put('/api/subsystem/users/:id/status', authenticateToken, requireRole('subsystem'), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        await db.run(
            "UPDATE users SET is_active = ? WHERE id = ? AND subsystem_id = ?",
            [is_active ? 1 : 0, id, req.user.subsystem_id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// --- Tickets ---
app.post('/api/tickets', authenticateToken, requireRole('agent'), async (req, res) => {
    try {
        const { ticket } = req.body;
        const agentId = req.user.id;
        const subsystemId = req.user.subsystem_id;

        // Générer un numéro de ticket unique
        const ticketNumber = 'T' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        // Insérer le ticket
        const result = await db.run(
            `INSERT INTO tickets (ticket_number, agent_id, subsystem_id, draw, draw_time, total_amount, status, is_synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ticketNumber, agentId, subsystemId, ticket.draw, ticket.draw_time, ticket.total, 'active', 1]
        );

        const ticketId = result.lastID;

        // Insérer les paris
        for (const bet of ticket.bets) {
            await db.run(
                `INSERT INTO bets (ticket_id, bet_type, numbers, amount, multiplier, options)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [ticketId, bet.type, bet.number, bet.amount, bet.multiplier, JSON.stringify(bet.options || null)]
            );
        }

        await db.run(
            "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [agentId, 'create_ticket', `Ticket ${ticketNumber} - ${ticket.total} HTG`, req.ip]
        );

        res.json({ success: true, ticketId, ticketNumber });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.get('/api/tickets', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT t.*, u.full_name as agent_name,
                   (SELECT COUNT(*) FROM bets WHERE ticket_id = t.id) as bet_count
            FROM tickets t
            JOIN users u ON t.agent_id = u.id
            WHERE t.subsystem_id = ?
        `;
        const params = [req.user.subsystem_id];

        if (req.user.role === 'agent') {
            query += " AND t.agent_id = ?";
            params.push(req.user.id);
        }

        // Filtrer par date si fourni
        if (req.query.date) {
            query += " AND DATE(t.created_at) = DATE(?)";
            params.push(req.query.date);
        }

        if (req.query.start && req.query.end) {
            query += " AND t.created_at BETWEEN ? AND ?";
            params.push(req.query.start, req.query.end);
        }

        query += " ORDER BY t.created_at DESC LIMIT 100";

        const tickets = await db.all(query, params);

        // Récupérer les paris pour chaque ticket
        for (const ticket of tickets) {
            ticket.bets = await db.all("SELECT * FROM bets WHERE ticket_id = ?", [ticket.id]);
        }

        res.json({ success: true, tickets });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/tickets/recent', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT t.*, u.full_name as agent_name
            FROM tickets t
            JOIN users u ON t.agent_id = u.id
            WHERE t.subsystem_id = ?
        `;
        const params = [req.user.subsystem_id];

        if (req.user.role === 'agent') {
            query += " AND t.agent_id = ?";
            params.push(req.user.id);
        }

        query += " ORDER BY t.created_at DESC LIMIT 10";

        const tickets = await db.all(query, params);
        res.json({ success: true, tickets });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Résultats ---
app.get('/api/results', async (req, res) => {
    try {
        const results = await db.all(
            "SELECT * FROM results ORDER BY draw_date DESC, draw_time DESC LIMIT 50"
        );
        // Formater comme attendu par le frontend
        const formatted = {};
        for (const r of results) {
            if (!formatted[r.draw]) formatted[r.draw] = {};
            if (!formatted[r.draw][r.draw_time]) formatted[r.draw][r.draw_time] = {};
            formatted[r.draw][r.draw_time] = {
                date: r.draw_date,
                lot1: r.lot1,
                lot2: r.lot2,
                lot3: r.lot3,
                verified: r.verified
            };
        }
        res.json({ success: true, results: formatted });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/results', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
    try {
        const { draw, draw_time, draw_date, lot1, lot2, lot3, verified } = req.body;

        await db.run(
            `INSERT OR REPLACE INTO results (draw, draw_time, draw_date, lot1, lot2, lot3, verified)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [draw, draw_time, draw_date, lot1, lot2, lot3, verified ? 1 : 0]
        );

        // TODO: Déclencher la vérification des tickets gagnants

        await db.run(
            "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [req.user.id, 'enter_result', `Résultat ${draw} ${draw_time} - ${lot1}`, req.ip]
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Gagnants ---
app.get('/api/tickets/winning', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT w.*, t.ticket_number, t.draw, t.draw_time, t.created_at as date,
                   u.full_name as agent_name
            FROM winning_tickets w
            JOIN tickets t ON w.ticket_id = t.id
            JOIN users u ON t.agent_id = u.id
            WHERE t.subsystem_id = ?
        `;
        const params = [req.user.subsystem_id];

        if (req.user.role === 'agent') {
            query += " AND t.agent_id = ?";
            params.push(req.user.id);
        }

        const winners = await db.all(query, params);
        res.json({ success: true, tickets: winners });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Settings ---
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await db.all("SELECT key, value FROM settings");
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json({ success: true, settings: obj });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/settings', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
    try {
        const { settings } = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await db.run(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                [key, value]
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Statistiques ---
app.get('/api/subsystem/stats', authenticateToken, async (req, res) => {
    try {
        const subsystemId = req.user.subsystem_id;

        const [activeUsers, todayTickets, todaySales, maxUsers] = await Promise.all([
            db.get("SELECT COUNT(*) as count FROM users WHERE subsystem_id = ? AND is_active = 1", [subsystemId]),
            db.get(`SELECT COUNT(*) as count FROM tickets WHERE subsystem_id = ? AND DATE(created_at) = DATE('now')`, [subsystemId]),
            db.get(`SELECT COALESCE(SUM(total_amount), 0) as total FROM tickets WHERE subsystem_id = ? AND DATE(created_at) = DATE('now')`, [subsystemId]),
            db.get("SELECT max_users FROM subsystems WHERE id = ?", [subsystemId])
        ]);

        res.json({
            success: true,
            stats: {
                active_users: activeUsers.count,
                today_tickets: todayTickets.count,
                today_sales: todaySales.total,
                max_users: maxUsers?.max_users || 10
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Master endpoints ---
app.get('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
    try {
        const subsystems = await db.all(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND role = 'agent') as agents_count,
                   (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND is_active = 1) as active_users
            FROM subsystems s
            ORDER BY s.created_at DESC
        `);

        res.json({ success: true, subsystems });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
    try {
        const { name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_months } = req.body;

        // Calculer la date d'expiration
        const expires = new Date();
        expires.setMonth(expires.getMonth() + (subscription_months || 1));

        const result = await db.run(
            `INSERT INTO subsystems (name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_expires)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, subdomain, contact_email, contact_phone, max_users, subscription_type, expires.toISOString().split('T')[0]]
        );

        const subsystemId = result.lastID;

        // Créer un compte admin pour le sous-système
        const adminUsername = `admin_${subdomain}`;
        const adminPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

        await db.run(
            `INSERT INTO users (username, password, full_name, role, subsystem_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminUsername, hashedPassword, `Admin ${name}`, 'subsystem', subsystemId, 1]
        );

        await db.run(
            "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            [req.user.id, 'create_subsystem', `Création du sous-système ${name}`, req.ip]
        );

        res.json({
            success: true,
            subsystemId,
            access_url: `https://${subdomain}.lotato.com`,
            admin_credentials: {
                username: adminUsername,
                password: adminPassword,
                email: contact_email
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.get('/api/master/subsystems/:id', authenticateToken, requireRole('master'), async (req, res) => {
    try {
        const subsystem = await db.get(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id) as total_users,
                   (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND is_active = 1) as active_users
            FROM subsystems s
            WHERE s.id = ?
        `, [req.params.id]);

        if (!subsystem) {
            return res.status(404).json({ success: false, error: 'Sous-système non trouvé' });
        }

        res.json({ success: true, subsystem });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/api/master/subsystems/:id/deactivate', authenticateToken, requireRole('master'), async (req, res) => {
    try {
        await db.run("UPDATE subsystems SET is_active = 0 WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/api/master/subsystems/:id/activate', authenticateToken, requireRole('master'), async (req, res) => {
    try {
        await db.run("UPDATE subsystems SET is_active = 1 WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Activités ---
app.get('/api/subsystem/activities', authenticateToken, requireRole('subsystem'), async (req, res) => {
    try {
        const activities = await db.all(`
            SELECT a.*, u.full_name as user_name, u.role as user_role
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE u.subsystem_id = ? OR a.user_id IS NULL
            ORDER BY a.created_at DESC
            LIMIT 100
        `, [req.user.subsystem_id]);

        const formatted = activities.map(a => ({
            user: a.user_name || 'Système',
            action: a.action,
            details: a.details,
            timestamp: a.created_at
        }));

        res.json({ success: true, activities: formatted });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Upload logo ---
app.post('/api/upload-logo', authenticateToken, requireRole('subsystem', 'master'), upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Aucun fichier' });
        }
        const logoUrl = '/uploads/' + req.file.filename;
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['company_logo', logoUrl]);
        res.json({ success: true, logoUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Route de fallback pour le frontend (SPA) ---
app.get('*', (req, res) => {
    // Si la requête est pour un fichier statique inexistant, renvoyer index.html
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint non trouvé' });
    }
});

// Démarrage du serveur
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur Lotato démarré sur le port ${PORT}`);
        console.log(`📁 Fichiers statiques servis depuis : ${__dirname}`);
    });
}).catch(err => {
    console.error('❌ Erreur d\'initialisation de la base de données:', err);
    process.exit(1);
});