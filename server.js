require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// Connexion à la base de données PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());

// Route racine
app.get('/', (req, res) => {
  res.send('✅ API Lotato en ligne. Utilisez /api/...');
});

// ======================= MIDDLEWARE =======================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['x-auth-token'] || req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1] || authHeader;
  if (!token) return res.status(401).json({ success: false, error: 'Token manquant' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Token invalide' });
    req.user = user;
    next();
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Accès interdit' });
  }
  next();
};

// ======================= ROUTES PUBLIQUES =======================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Identifiant et mot de passe requis' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, s.name as subsystem_name, s.id as subsystem_id 
       FROM users u 
       LEFT JOIN subsystems s ON u.subsystem_id = s.id 
       WHERE u.username = $1 AND u.is_active = true`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    // Mise à jour dernière connexion
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, subsystem_id: user.subsystem_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.password_hash;
    res.json({ success: true, token, admin: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/auth/check', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, subsystem_id, is_active FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
    }
    res.json({ success: true, admin: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ======================= ROUTES MASTER =======================
// Créer un sous-système
app.post('/api/master/subsystems', authenticateToken, requireRole(['master']), async (req, res) => {
  const { name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_months } = req.body;
  if (!name || !subdomain || !contact_email) {
    return res.status(400).json({ success: false, error: 'Données manquantes' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM subsystems WHERE subdomain = $1', [subdomain]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Ce sous-domaine est déjà utilisé' });
    }

    const expiresAt = subscription_months ? new Date(Date.now() + subscription_months * 30 * 24 * 60 * 60 * 1000) : null;
    const subsystemResult = await client.query(
      `INSERT INTO subsystems (name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, subdomain, contact_email, contact_phone, max_users || 10, subscription_type || 'standard', expiresAt]
    );
    const subsystem = subsystemResult.rows[0];

    const plainPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const adminUsername = subdomain + '_admin';
    const adminResult = await client.query(
      `INSERT INTO users (username, password_hash, email, full_name, role, subsystem_id, is_active)
       VALUES ($1, $2, $3, $4, 'subsystem', $5, true) RETURNING id, username, email`,
      [adminUsername, hashedPassword, contact_email, `Admin ${name}`, subsystem.id]
    );
    const admin = adminResult.rows[0];

    await client.query('COMMIT');

    const accessUrl = `https://${subdomain}.${process.env.MAIN_DOMAIN || 'novalotto.com'}`;
    res.status(201).json({
      success: true,
      subsystem,
      admin_credentials: {
        username: admin.username,
        password: plainPassword,
        email: admin.email,
        access_url: accessUrl
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// Lister tous les sous-systèmes
app.get('/api/master/subsystems', authenticateToken, requireRole(['master']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const offset = (page - 1) * limit;
    let query = `
      SELECT s.*, 
        (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND role='agent' AND is_active=true) as active_users,
        (SELECT COALESCE(SUM(total),0) FROM tickets WHERE subsystem_id = s.id AND date >= CURRENT_DATE) as today_sales,
        (SELECT COUNT(*) FROM tickets WHERE subsystem_id = s.id AND date >= CURRENT_DATE) as today_tickets
      FROM subsystems s
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (s.name ILIKE $${paramIndex} OR s.subdomain ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (status === 'active') {
      query += ` AND s.is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND s.is_active = false`;
    } else if (status === 'expired') {
      query += ` AND s.subscription_expires < CURRENT_DATE`;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) as t`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex+1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const subsystems = result.rows.map(s => ({
      ...s,
      usage_percentage: s.max_users ? Math.round((s.active_users / s.max_users) * 100) : 0
    }));

    res.json({
      success: true,
      subsystems,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Obtenir un sous-système par ID
app.get('/api/master/subsystems/:id', authenticateToken, requireRole(['master']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND role='agent') as total_users,
        (SELECT COUNT(*) FROM users WHERE subsystem_id = s.id AND role='agent' AND is_active=true) as active_users,
        (SELECT COALESCE(SUM(total),0) FROM tickets WHERE subsystem_id = s.id AND date >= CURRENT_DATE) as today_sales,
        (SELECT COUNT(*) FROM tickets WHERE subsystem_id = s.id AND date >= CURRENT_DATE) as today_tickets
      FROM subsystems s
      WHERE s.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sous-système non trouvé' });
    }
    res.json({ success: true, subsystem: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Désactiver un sous-système
app.put('/api/master/subsystems/:id/deactivate', authenticateToken, requireRole(['master']), async (req, res) => {
  try {
    await pool.query('UPDATE subsystems SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Activer un sous-système
app.put('/api/master/subsystems/:id/activate', authenticateToken, requireRole(['master']), async (req, res) => {
  try {
    await pool.query('UPDATE subsystems SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Lister les agents d'un sous-système
app.get('/api/master/subsystems/:id/users', authenticateToken, requireRole(['master']), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(
      `SELECT id, username, email, full_name, is_active, last_login, created_at
       FROM users WHERE subsystem_id = $1 AND role = 'agent'
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM users WHERE subsystem_id = $1 AND role = $2',
      [req.params.id, 'agent']
    );
    const total = parseInt(countResult.rows[0].count);
    res.json({
      success: true,
      users: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ======================= ROUTES SOUS-SYSTÈME (ADMIN) =======================
app.get('/api/subsystems/mine', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subsystems WHERE id = $1', [req.user.subsystem_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sous-système non trouvé' });
    }
    res.json({ success: true, subsystems: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/subsystem/stats', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const subsystemId = req.user.subsystem_id;
  try {
    const usersResult = await pool.query(
      'SELECT COUNT(*) FILTER (WHERE is_active) as active_users, COUNT(*) as total_users FROM users WHERE subsystem_id = $1 AND role = $2',
      [subsystemId, 'agent']
    );
    const ticketsResult = await pool.query(
      'SELECT COUNT(*) as today_tickets, COALESCE(SUM(total),0) as today_sales FROM tickets WHERE subsystem_id = $1 AND date >= CURRENT_DATE',
      [subsystemId]
    );
    const maxUsersResult = await pool.query('SELECT max_users FROM subsystems WHERE id = $1', [subsystemId]);
    const onlineResult = await pool.query(
      'SELECT COUNT(*) as online_agents FROM users WHERE subsystem_id = $1 AND role = $2 AND is_online = true',
      [subsystemId, 'agent']
    );
    const payoutResult = await pool.query(
      'SELECT COALESCE(SUM(total_winnings),0) as pending_payout FROM winning_tickets WHERE subsystem_id = $1 AND paid = false',
      [subsystemId]
    );
    const issuesResult = await pool.query(
      'SELECT COUNT(*) as pending_issues FROM tickets WHERE subsystem_id = $1 AND is_synced = false',
      [subsystemId]
    );

    const stats = {
      active_users: parseInt(usersResult.rows[0].active_users),
      total_users: parseInt(usersResult.rows[0].total_users),
      max_users: maxUsersResult.rows[0].max_users,
      today_tickets: parseInt(ticketsResult.rows[0].today_tickets),
      today_sales: parseFloat(ticketsResult.rows[0].today_sales),
      online_agents: parseInt(onlineResult.rows[0].online_agents),
      pending_payout: parseFloat(payoutResult.rows[0].pending_payout),
      pending_issues: parseInt(issuesResult.rows[0].pending_issues)
    };
    res.json({ success: true, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/subsystem/users', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, is_active, is_online, last_login, created_at,
        (SELECT COALESCE(SUM(total),0) FROM tickets WHERE agent_id = users.id) as total_sales
       FROM users
       WHERE subsystem_id = $1 AND role = 'agent'
       ORDER BY created_at DESC`,
      [req.user.subsystem_id]
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.post('/api/subsystem/users/create', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ success: false, error: 'Données manquantes' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quotaCheck = await client.query(
      'SELECT max_users, (SELECT COUNT(*) FROM users WHERE subsystem_id = $1 AND role = $2) as current_count FROM subsystems WHERE id = $1',
      [req.user.subsystem_id, 'agent']
    );
    const { max_users, current_count } = quotaCheck.rows[0];
    if (current_count >= max_users) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Quota d\'agents atteint' });
    }

    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà pris' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (username, password_hash, email, full_name, role, subsystem_id, is_active)
       VALUES ($1, $2, $3, $4, 'agent', $5, true) RETURNING id, username, email`,
      [username, hashedPassword, email || null, name, req.user.subsystem_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

app.put('/api/subsystem/users/:userId', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const { name, email, is_active, password } = req.body;
  const userId = req.params.userId;
  try {
    const check = await pool.query('SELECT id FROM users WHERE id = $1 AND subsystem_id = $2', [userId, req.user.subsystem_id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent non trouvé' });
    }

    let query = 'UPDATE users SET full_name = COALESCE($1, full_name), email = COALESCE($2, email), is_active = COALESCE($3, is_active), updated_at = CURRENT_TIMESTAMP';
    const params = [name, email, is_active];
    let paramIndex = 4;
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query += `, password_hash = $${paramIndex}`;
      params.push(hashed);
      paramIndex++;
    }
    query += ` WHERE id = $${paramIndex}`;
    params.push(userId);

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.put('/api/subsystem/users/:userId/status', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const { is_active } = req.body;
  try {
    await pool.query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND subsystem_id = $3', [is_active, req.params.userId, req.user.subsystem_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.delete('/api/subsystem/users/:userId', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND subsystem_id = $2 AND role = $3', [req.params.userId, req.user.subsystem_id, 'agent']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/subsystem/tickets', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const { period = 'month', status, limit = 100 } = req.query;
  let dateCondition = '';
  if (period === 'today') {
    dateCondition = 'AND date >= CURRENT_DATE';
  } else if (period === 'week') {
    dateCondition = 'AND date >= CURRENT_DATE - INTERVAL \'7 days\'';
  } else if (period === 'month') {
    dateCondition = 'AND date >= CURRENT_DATE - INTERVAL \'30 days\'';
  }

  let statusCondition = '';
  if (status === 'pending') {
    statusCondition = 'AND is_synced = false';
  }

  try {
    const result = await pool.query(
      `SELECT t.*, u.full_name as agent_name 
       FROM tickets t 
       JOIN users u ON t.agent_id = u.id 
       WHERE t.subsystem_id = $1 ${dateCondition} ${statusCondition}
       ORDER BY t.date DESC LIMIT $2`,
      [req.user.subsystem_id, limit]
    );
    res.json({ success: true, tickets: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ======================= ROUTES AGENT =======================
app.post('/api/tickets', authenticateToken, requireRole(['agent']), async (req, res) => {
  const { number, date, draw, drawTime, bets, total } = req.body;
  if (!draw || !drawTime || !bets || !total) {
    return res.status(400).json({ success: false, error: 'Données incomplètes' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tickets (ticket_number, subsystem_id, agent_id, agent_name, draw, draw_time, date, bets, total, is_synced)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *`,
      [number, req.user.subsystem_id, req.user.id, req.user.full_name || req.user.username, draw, drawTime, date || new Date(), JSON.stringify(bets), total]
    );
    res.status(201).json({ success: true, ticket: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/tickets', authenticateToken, requireRole(['agent']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tickets WHERE agent_id = $1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json({ success: true, tickets: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/tickets/pending', authenticateToken, requireRole(['agent']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tickets WHERE agent_id = $1 AND is_synced = false ORDER BY date DESC',
      [req.user.id]
    );
    res.json({ success: true, tickets: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/tickets/winning', authenticateToken, requireRole(['agent']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, wt.total_winnings, wt.paid 
       FROM tickets t 
       JOIN winning_tickets wt ON t.id = wt.ticket_id 
       WHERE t.agent_id = $1 ORDER BY t.date DESC`,
      [req.user.id]
    );
    res.json({ success: true, tickets: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/results', authenticateToken, requireRole(['agent', 'subsystem']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM results WHERE subsystem_id = $1 ORDER BY result_date DESC, draw_time',
      [req.user.subsystem_id]
    );
    res.json({ success: true, results: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.post('/api/results', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const { draw, time, date, lot1, lot2, lot3, verified } = req.body;
  if (!draw || !time || !date || !lot1) {
    return res.status(400).json({ success: false, error: 'Données manquantes' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO results (subsystem_id, draw, draw_time, result_date, lot1, lot2, lot3, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (subsystem_id, draw, draw_time, result_date) 
       DO UPDATE SET lot1 = EXCLUDED.lot1, lot2 = EXCLUDED.lot2, lot3 = EXCLUDED.lot3, verified = EXCLUDED.verified, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.subsystem_id, draw, time, date, lot1, lot2 || null, lot3 || null, verified || false]
    );
    res.status(201).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/restrictions', authenticateToken, requireRole(['agent', 'subsystem']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM restrictions WHERE subsystem_id = $1 ORDER BY created_at DESC',
      [req.user.subsystem_id]
    );
    res.json({ success: true, restrictions: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.post('/api/restrictions', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const { number, type, limitAmount, draw, time } = req.body;
  if (!number || !type) return res.status(400).json({ success: false, error: 'Données manquantes' });

  try {
    const result = await pool.query(
      `INSERT INTO restrictions (subsystem_id, number, type, limit_amount, draw, draw_time)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.subsystem_id, number, type, limitAmount || null, draw || 'all', time || 'all']
    );
    res.status(201).json({ success: true, restriction: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.put('/api/restrictions/:id', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  const { number, type, limitAmount, draw, time } = req.body;
  try {
    await pool.query(
      `UPDATE restrictions SET number = COALESCE($1, number), type = COALESCE($2, type), limit_amount = $3, draw = COALESCE($4, draw), draw_time = COALESCE($5, draw_time), updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND subsystem_id = $7`,
      [number, type, limitAmount, draw, time, req.params.id, req.user.subsystem_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.delete('/api/restrictions/:id', authenticateToken, requireRole(['subsystem']), async (req, res) => {
  try {
    await pool.query('DELETE FROM restrictions WHERE id = $1 AND subsystem_id = $2', [req.params.id, req.user.subsystem_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/company-info', authenticateToken, async (req, res) => {
  res.json({
    name: "Nova Lotto",
    phone: "+509 32 53 49 58",
    address: "Cap Haïtien",
    reportTitle: "Nova Lotto",
    reportPhone: "40104585"
  });
});

app.get('/api/logo', authenticateToken, async (req, res) => {
  res.json({ logoUrl: "logo-borlette.jpg" });
});

// ======================= CRÉATION AUTO DU COMPTE MASTER =======================
async function ensureMasterExists() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT id FROM users WHERE role = 'master' LIMIT 1");
    if (result.rows.length === 0) {
      const username = process.env.MASTER_USERNAME || 'master';
      const password = process.env.MASTER_PASSWORD || 'master123';
      const email = process.env.MASTER_EMAIL || 'master@novalotto.com';
      const fullName = process.env.MASTER_FULLNAME || 'Master Administrator';
      const hashedPassword = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users (username, password_hash, email, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, 'master', true)`,
        [username, hashedPassword, email, fullName]
      );
      console.log(`✅ Compte master créé avec l'identifiant "${username}".`);
    } else {
      console.log('✅ Compte master existant.');
    }
  } catch (err) {
    console.error('❌ Erreur création master:', err);
  } finally {
    client.release();
  }
}

// ======================= DÉMARRAGE =======================
(async () => {
  await ensureMasterExists();
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
})();