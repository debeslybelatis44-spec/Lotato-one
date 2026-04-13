const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise_a_changer_en_prod';
const SALT_ROUNDS = 10;

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/lotato?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Erreur de connexion MongoDB:', err);
    process.exit(1);
  });

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration multer pour les logos
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

// ==================== MODÈLES MONGOOSE ====================

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: String,
  email: String,
  phone: String,
  role: { type: String, enum: ['agent', 'supervisor', 'subsystem', 'master'], required: true },
  level: Number,
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem' },
  supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supervisor2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_active: { type: Boolean, default: true },
  is_online: { type: Boolean, default: false },
  last_login: Date,
  created_at: { type: Date, default: Date.now }
});

const subsystemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  contact_email: String,
  contact_phone: String,
  max_users: { type: Number, default: 10 },
  subscription_type: { type: String, default: 'standard' },
  subscription_expires: Date,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const ticketSchema = new mongoose.Schema({
  ticket_number: { type: String, required: true, unique: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true },
  draw: { type: String, required: true },
  draw_time: { type: String, required: true },
  total_amount: { type: Number, required: true },
  status: { type: String, default: 'active' },
  is_synced: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const betSchema = new mongoose.Schema({
  ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  bet_type: { type: String, required: true },
  numbers: { type: String, required: true },
  amount: { type: Number, required: true },
  multiplier: { type: Number, required: true },
  options: mongoose.Schema.Types.Mixed
});

const resultSchema = new mongoose.Schema({
  draw: { type: String, required: true },
  draw_time: { type: String, required: true },
  draw_date: { type: Date, required: true },
  lot1: { type: String, required: true },
  lot2: String,
  lot3: String,
  verified: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});
resultSchema.index({ draw: 1, draw_time: 1, draw_date: 1 }, { unique: true });

const winningTicketSchema = new mongoose.Schema({
  ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  winning_amount: { type: Number, required: true },
  paid: { type: Boolean, default: false },
  paid_at: Date
});

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});

const activityLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  details: String,
  ip_address: String,
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Subsystem = mongoose.model('Subsystem', subsystemSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Bet = mongoose.model('Bet', betSchema);
const Result = mongoose.model('Result', resultSchema);
const WinningTicket = mongoose.model('WinningTicket', winningTicketSchema);
const Setting = mongoose.model('Setting', settingSchema);
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ==================== INITIALISATION ====================
async function initializeData() {
  try {
    // Paramètres par défaut
    const defaultSettings = {
      'borlette_first': '60', 'borlette_second': '20', 'borlette_third': '10',
      'lotto3': '500', 'lotto4': '5000', 'lotto5': '25000',
      'grap': '500', 'marriage': '1000',
      'company_name': 'Lotato', 'company_phone': '+509 32 53 49 58', 'company_address': 'Cap Haïtien'
    };
    for (const [key, value] of Object.entries(defaultSettings)) {
      await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
    }

    // Vérifier si des utilisateurs existent
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('📦 Initialisation des données de démonstration...');

      // 1. Créer un sous-système par défaut
      const subsystem = await Subsystem.create({
        name: 'Sous-système Démo',
        subdomain: 'demo',
        contact_email: 'demo@lotato.local',
        max_users: 20
      });

      // 2. Master (master/master123)
      const masterHash = await bcrypt.hash('master123', SALT_ROUNDS);
      await User.create({
        username: 'master',
        password: masterHash,
        full_name: 'Administrateur Master',
        role: 'master',
        is_active: true
      });

      // 3. Propriétaire (proprietaire/123)
      const ownerHash = await bcrypt.hash('123', SALT_ROUNDS);
      await User.create({
        username: 'proprietaire',
        password: ownerHash,
        full_name: 'Propriétaire Démo',
        role: 'subsystem',
        subsystem_id: subsystem._id,
        is_active: true
      });

      // 4. Superviseur niveau 1 (superviseur1/123)
      const sup1Hash = await bcrypt.hash('123', SALT_ROUNDS);
      const sup1 = await User.create({
        username: 'superviseur1',
        password: sup1Hash,
        full_name: 'Superviseur Niveau 1',
        role: 'supervisor',
        level: 1,
        subsystem_id: subsystem._id,
        is_active: true
      });

      // 5. Superviseur niveau 2 (superviseur2/123)
      const sup2Hash = await bcrypt.hash('123', SALT_ROUNDS);
      const sup2 = await User.create({
        username: 'superviseur2',
        password: sup2Hash,
        full_name: 'Superviseur Niveau 2',
        role: 'supervisor',
        level: 2,
        subsystem_id: subsystem._id,
        is_active: true
      });

      // 6. Agent (agent1/123)
      const agentHash = await bcrypt.hash('123', SALT_ROUNDS);
      await User.create({
        username: 'agent1',
        password: agentHash,
        full_name: 'Agent Démo',
        role: 'agent',
        subsystem_id: subsystem._id,
        supervisor_id: sup1._id,
        supervisor2_id: sup2._id,
        is_active: true
      });

      console.log('✅ Données de démonstration créées.');
    }
  } catch (error) {
    console.error('Erreur initialisation:', error);
  }
}

// ==================== MIDDLEWARES ====================
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

// ==================== ROUTES API ====================

// --- Authentification ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });

    if (!user.is_active) return res.status(403).json({ success: false, error: 'Compte désactivé' });

    user.last_login = new Date();
    user.is_online = true;
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, level: user.level, subsystem_id: user.subsystem_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    let redirectUrl = '/lotato.html';
    if (user.role === 'supervisor') redirectUrl = user.level === 1 ? '/control-level1.html' : '/control-level2.html';
    else if (user.role === 'subsystem') redirectUrl = '/subsystem-admin.html';
    else if (user.role === 'master') redirectUrl = '/master-dashboard.html';

    await ActivityLog.create({
      user_id: user._id,
      action: 'login',
      details: `Connexion réussie (${user.role})`,
      ip_address: req.ip
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        level: user.level,
        subsystem_id: user.subsystem_id
      },
      redirectUrl
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { is_online: false });
  res.json({ success: true });
});

app.get('/api/auth/check', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ success: true, user });
});

// --- Utilisateurs du sous-système ---
app.get('/api/subsystem/users', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
  try {
    let subsystemId = req.user.subsystem_id;
    if (req.user.role === 'master' && req.query.subsystem_id) subsystemId = req.query.subsystem_id;

    const filter = { subsystem_id: subsystemId, role: { $ne: 'subsystem' } };
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      filter.$or = [
        { full_name: { $regex: req.query.search, $options: 'i' } },
        { username: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .populate('supervisor_id', 'full_name')
      .populate('supervisor2_id', 'full_name')
      .sort('-created_at');

    res.json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/subsystem/users/create', authenticateToken, requireRole('subsystem'), async (req, res) => {
  try {
    const { name, username, password, role, level, supervisorId } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà pris' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      full_name: name,
      username,
      password: hashed,
      role,
      level: level || null,
      subsystem_id: req.user.subsystem_id,
      supervisor_id: supervisorId || null
    });

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'create_user',
      details: `Création de ${username} (${role})`,
      ip_address: req.ip
    });

    res.json({ success: true, userId: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.put('/api/subsystem/users/:id', authenticateToken, requireRole('subsystem'), async (req, res) => {
  try {
    const { name, is_active, password } = req.body;
    const updateData = { full_name: name, is_active: is_active ? true : false };
    if (password) updateData.password = await bcrypt.hash(password, SALT_ROUNDS);

    await User.findOneAndUpdate(
      { _id: req.params.id, subsystem_id: req.user.subsystem_id },
      updateData
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.put('/api/subsystem/users/:id/status', authenticateToken, requireRole('subsystem'), async (req, res) => {
  await User.findOneAndUpdate(
    { _id: req.params.id, subsystem_id: req.user.subsystem_id },
    { is_active: req.body.is_active ? true : false }
  );
  res.json({ success: true });
});

// --- Tickets ---
app.post('/api/tickets', authenticateToken, requireRole('agent'), async (req, res) => {
  try {
    const { ticket } = req.body;
    const ticketNumber = 'T' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const newTicket = await Ticket.create({
      ticket_number: ticketNumber,
      agent_id: req.user.id,
      subsystem_id: req.user.subsystem_id,
      draw: ticket.draw,
      draw_time: ticket.draw_time,
      total_amount: ticket.total,
      status: 'active',
      is_synced: true
    });

    for (const bet of ticket.bets) {
      await Bet.create({
        ticket_id: newTicket._id,
        bet_type: bet.type,
        numbers: bet.number,
        amount: bet.amount,
        multiplier: bet.multiplier,
        options: bet.options || null
      });
    }

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'create_ticket',
      details: `Ticket ${ticketNumber} - ${ticket.total} HTG`,
      ip_address: req.ip
    });

    res.json({ success: true, ticketId: newTicket._id, ticketNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const filter = { subsystem_id: req.user.subsystem_id };
    if (req.user.role === 'agent') filter.agent_id = req.user.id;

    const tickets = await Ticket.find(filter)
      .populate('agent_id', 'full_name')
      .sort('-created_at')
      .limit(100);

    for (const t of tickets) {
      t._doc.bets = await Bet.find({ ticket_id: t._id });
    }

    res.json({ success: true, tickets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Résultats ---
app.get('/api/results', async (req, res) => {
  try {
    const results = await Result.find().sort('-draw_date').limit(50);
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
    await Result.findOneAndUpdate(
      { draw, draw_time, draw_date },
      { lot1, lot2, lot3, verified: verified ? true : false },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Tickets gagnants ---
app.get('/api/tickets/winning', authenticateToken, async (req, res) => {
  try {
    const tickets = await Ticket.find({ subsystem_id: req.user.subsystem_id });
    const ticketIds = tickets.map(t => t._id);
    const winners = await WinningTicket.find({ ticket_id: { $in: ticketIds } })
      .populate('ticket_id', 'ticket_number');
    res.json({ success: true, tickets: winners });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Paramètres ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Setting.find();
    const obj = {};
    settings.forEach(s => obj[s.key] = s.value);
    res.json({ success: true, settings: obj });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/settings', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body.settings)) {
      await Setting.findOneAndUpdate({ key: k }, { value: v }, { upsert: true });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Statistiques du sous-système ---
app.get('/api/subsystem/stats', authenticateToken, async (req, res) => {
  try {
    const subsystemId = req.user.subsystem_id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeUsers, todayTickets, todaySales, subsystem] = await Promise.all([
      User.countDocuments({ subsystem_id: subsystemId, is_active: true }),
      Ticket.countDocuments({ subsystem_id: subsystemId, created_at: { $gte: today } }),
      Ticket.aggregate([
        { $match: { subsystem_id: new mongoose.Types.ObjectId(subsystemId), created_at: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } }
      ]),
      Subsystem.findById(subsystemId).select('max_users')
    ]);

    const totalSales = todaySales.length > 0 ? todaySales[0].total : 0;
    const maxUsers = subsystem?.max_users || 10;

    res.json({
      success: true,
      stats: {
        active_users: activeUsers,
        today_tickets: todayTickets,
        today_sales: totalSales,
        max_users: maxUsers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Master: Sous-systèmes ---
app.get('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
  try {
    const subsystems = await Subsystem.aggregate([
      {
        $lookup: {
          from: 'users',
          let: { subId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$subsystem_id', '$$subId'] } } },
            { $group: { _id: null, active_users: { $sum: { $cond: ['$is_active', 1, 0] } }, agents_count: { $sum: { $cond: [{ $eq: ['$role', 'agent'] }, 1, 0] } } } }
          ],
          as: 'stats'
        }
      },
      { $addFields: { active_users: { $ifNull: [{ $arrayElemAt: ['$stats.active_users', 0] }, 0] }, agents_count: { $ifNull: [{ $arrayElemAt: ['$stats.agents_count', 0] }, 0] } } },
      { $project: { stats: 0 } },
      { $sort: { created_at: -1 } }
    ]);
    res.json({ success: true, subsystems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
  try {
    const { name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_months } = req.body;
    const expires = new Date();
    expires.setMonth(expires.getMonth() + (subscription_months || 1));

    const subsystem = await Subsystem.create({
      name,
      subdomain,
      contact_email,
      contact_phone,
      max_users,
      subscription_type,
      subscription_expires: expires
    });

    const adminUsername = `admin_${subdomain}`;
    const adminPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    await User.create({
      username: adminUsername,
      password: hashed,
      full_name: `Admin ${name}`,
      role: 'subsystem',
      subsystem_id: subsystem._id,
      is_active: true
    });

    res.json({
      success: true,
      subsystemId: subsystem._id,
      admin_credentials: { username: adminUsername, password: adminPassword, email: contact_email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.put('/api/master/subsystems/:id/deactivate', authenticateToken, requireRole('master'), async (req, res) => {
  await Subsystem.findByIdAndUpdate(req.params.id, { is_active: false });
  res.json({ success: true });
});

app.put('/api/master/subsystems/:id/activate', authenticateToken, requireRole('master'), async (req, res) => {
  await Subsystem.findByIdAndUpdate(req.params.id, { is_active: true });
  res.json({ success: true });
});

app.delete('/api/master/reset-users', authenticateToken, requireRole('master'), async (req, res) => {
  try {
    await User.deleteMany({ role: { $ne: 'master' } });
    await ActivityLog.deleteMany({});
    res.json({ success: true, message: 'Tous les utilisateurs (sauf master) ont été supprimés.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// --- Activités ---
app.get('/api/subsystem/activities', authenticateToken, requireRole('subsystem'), async (req, res) => {
  try {
    const activities = await ActivityLog.find()
      .populate('user_id', 'full_name role')
      .sort('-created_at')
      .limit(100);

    const filtered = activities.filter(a => {
      if (!a.user_id) return true;
      return a.user_id.subsystem_id?.toString() === req.user.subsystem_id?.toString();
    });

    const formatted = filtered.map(a => ({
      user: a.user_id?.full_name || 'Système',
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
    if (!req.file) return res.status(400).json({ success: false, error: 'Aucun fichier' });
    const logoUrl = '/uploads/' + req.file.filename;
    await Setting.findOneAndUpdate({ key: 'company_logo' }, { value: logoUrl }, { upsert: true });
    res.json({ success: true, logoUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Fallback SPA ---
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint non trouvé' });
  }
});

// ==================== DÉMARRAGE ====================
initializeData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur Lotato (MongoDB) sur le port ${PORT}`);
  });
});