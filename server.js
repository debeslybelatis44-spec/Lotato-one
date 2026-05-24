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
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_super_securise';
const SALT_ROUNDS = 10;

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lotato';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer pour logos
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

// ==================== MODÈLES ====================

// Sous-système
const subsystemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  contact_email: String,
  contact_phone: String,
  max_users: { type: Number, default: 10 },
  subscription_type: { type: String, default: 'standard' },
  subscription_expires: Date,
  is_active: { type: Boolean, default: true },
  logo_url: String,
  created_at: { type: Date, default: Date.now }
});
const Subsystem = mongoose.model('Subsystem', subsystemSchema);

// Utilisateur (agent, superviseur1, superviseur2, propriétaire, master)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: String,
  email: String,
  phone: String,
  role: { type: String, enum: ['agent', 'supervisor', 'subsystem', 'master'], required: true },
  level: { type: Number, default: null }, // 1 ou 2 pour superviseur
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem' },
  supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // pour agent: son superviseur N1
  supervisor2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // pour agent: superviseur N2
  commission_rate: { type: Number, default: 10 },
  is_active: { type: Boolean, default: true },
  is_online: { type: Boolean, default: false },
  last_login: Date,
  created_at: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Ticket
const ticketSchema = new mongoose.Schema({
  ticket_number: { type: String, required: true, unique: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true },
  draw: { type: String, required: true },   // ex: 'miami'
  draw_time: { type: String, required: true }, // 'morning' ou 'evening'
  total_amount: { type: Number, required: true },
  status: { type: String, default: 'active' },
  is_synced: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});
const Ticket = mongoose.model('Ticket', ticketSchema);

// Paris (bets) d'un ticket
const betSchema = new mongoose.Schema({
  ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  bet_type: { type: String, required: true }, // borlette, boulpe, lotto3, marriage, grap, lotto4, lotto5, etc.
  numbers: { type: String, required: true },   // ex: '12', '123', '12*34'
  amount: { type: Number, required: true },
  multiplier: { type: Number, required: true },
  options: mongoose.Schema.Types.Mixed
});
const Bet = mongoose.model('Bet', betSchema);

// Résultat de tirage (commun à tous les sous-systèmes)
const resultSchema = new mongoose.Schema({
  draw: { type: String, required: true },
  draw_time: { type: String, required: true },
  draw_date: { type: Date, required: true }, // ex: 2025-03-15
  lot1: { type: String, required: true },    // numéro 3 chiffres
  lot2: String,
  lot3: String,
  verified: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});
resultSchema.index({ draw: 1, draw_time: 1, draw_date: 1 }, { unique: true });
const Result = mongoose.model('Result', resultSchema);

// Ticket gagnant
const winningTicketSchema = new mongoose.Schema({
  ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  winning_amount: { type: Number, required: true },
  paid: { type: Boolean, default: false },
  paid_at: Date
});
const WinningTicket = mongoose.model('WinningTicket', winningTicketSchema);

// Configuration propre à un sous-système (multiplicateurs, limites, blocages)
const subsystemConfigSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true, unique: true },
  // Multiplicateurs (valeurs par défaut)
  multipliers: {
    borlette_first: { type: Number, default: 60 },
    borlette_second: { type: Number, default: 20 },
    borlette_third: { type: Number, default: 10 },
    lotto3: { type: Number, default: 500 },
    lotto4: { type: Number, default: 5000 },
    lotto5: { type: Number, default: 25000 },
    grap: { type: Number, default: 500 },
    marriage: { type: Number, default: 1000 }
  },
  // Limites globales par numéro (tous tirages)
  global_limits: [{
    number: { type: String, required: true }, // "00" à "99"
    limit_amount: { type: Number, default: 0 } // 0 = illimité
  }],
  // Numéros bloqués globalement
  blocked_numbers: [{ type: String }], // "00" à "99"
  // Numéros bloqués par tirage
  draw_restrictions: [{
    draw_id: { type: String, required: true }, // 'miami', 'georgia', etc.
    blocked_numbers: [{ type: String }],
    number_limits: [{ number: String, limit_amount: Number }]
  }],
  // Blocage Lotto3 (3 chiffres)
  blocked_lotto3: [{ type: String }], // ex: "123"
  // Limites par jeu
  game_limits: {
    lotto3: { type: Number, default: 0 },
    lotto4: { type: Number, default: 0 },
    lotto5: { type: Number, default: 0 },
    marriage: { type: Number, default: 0 }
  },
  // Infos société
  company_name: { type: String, default: 'Lotato' },
  company_slogan: { type: String, default: 'Chwazi yon Jwet' },
  company_phone: { type: String, default: '+509 32 53 49 58' },
  company_address: { type: String, default: 'Cap Haïtien' },
  logo_url: { type: String, default: '' },
  footer_message: { type: String, default: 'Mèsi pou konfyans ou!' },
  default_commission: { type: Number, default: 10 }
});
const SubsystemConfig = mongoose.model('SubsystemConfig', subsystemConfigSchema);

// Tirage (commun, liste fixe)
const drawSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // 'miami', 'georgia', etc.
  name: { type: String, required: true },
  times: {
    morning: { type: String, required: true }, // "1:30 PM"
    evening: { type: String, required: true }
  },
  active: { type: Boolean, default: true }
});
const Draw = mongoose.model('Draw', drawSchema);

// Journal d'activité
const activityLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem' },
  action: { type: String, required: true },
  details: String,
  ip_address: String,
  created_at: { type: Date, default: Date.now }
});
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ==================== INITIALISATION DONNÉES ====================
async function initializeData() {
  console.log('📦 Initialisation...');

  // 1. Créer les tirages par défaut
  const defaultDraws = [
    { id: 'miami', name: 'Miami (Florida)', times: { morning: '1:30 PM', evening: '9:50 PM' } },
    { id: 'georgia', name: 'Georgia', times: { morning: '12:30 PM', evening: '7:00 PM' } },
    { id: 'newyork', name: 'New York', times: { morning: '2:30 PM', evening: '8:00 PM' } },
    { id: 'texas', name: 'Texas', times: { morning: '12:00 PM', evening: '6:00 PM' } },
    { id: 'tunisia', name: 'Tunisie', times: { morning: '10:30 AM', evening: '2:00 PM' } }
  ];
  for (const d of defaultDraws) {
    await Draw.findOneAndUpdate({ id: d.id }, d, { upsert: true });
  }

  // 2. Sous-système démo
  let demoSub = await Subsystem.findOne({ subdomain: 'demo' });
  if (!demoSub) {
    demoSub = await Subsystem.create({
      name: 'Sous-système Démo',
      subdomain: 'demo',
      contact_email: 'demo@lotato.local',
      max_users: 20
    });
    // Créer sa configuration
    await SubsystemConfig.findOneAndUpdate(
      { subsystem_id: demoSub._id },
      { subsystem_id: demoSub._id, company_name: 'Lotato Demo' },
      { upsert: true }
    );
  }

  // 3. Utilisateurs de base
  const usersToEnsure = [
    { username: 'master', password: 'master123', full_name: 'Master Admin', role: 'master' },
    { username: 'proprietaire', password: '123', full_name: 'Propriétaire Demo', role: 'subsystem', subsystem_id: demoSub._id },
    { username: 'superviseur1', password: '123', full_name: 'Superviseur N1', role: 'supervisor', level: 1, subsystem_id: demoSub._id },
    { username: 'superviseur2', password: '123', full_name: 'Superviseur N2', role: 'supervisor', level: 2, subsystem_id: demoSub._id },
    { username: 'agent1', password: '123', full_name: 'Agent Demo', role: 'agent', subsystem_id: demoSub._id }
  ];

  let sup1, sup2;
  for (const u of usersToEnsure) {
    let user = await User.findOne({ username: u.username });
    if (!user) {
      const hashed = await bcrypt.hash(u.password, SALT_ROUNDS);
      user = await User.create({ ...u, password: hashed });
      console.log(`✅ Utilisateur ${u.username} créé`);
    } else {
      // mettre à jour les infos si nécessaire
      if (u.subsystem_id && !user.subsystem_id) user.subsystem_id = u.subsystem_id;
      if (u.role) user.role = u.role;
      if (u.level !== undefined) user.level = u.level;
      await user.save();
    }
    if (u.username === 'superviseur1') sup1 = user;
    if (u.username === 'superviseur2') sup2 = user;
  }

  // Lier agent1 aux superviseurs
  const agent = await User.findOne({ username: 'agent1' });
  if (agent && sup1 && sup2) {
    if (!agent.supervisor_id) agent.supervisor_id = sup1._id;
    if (!agent.supervisor2_id) agent.supervisor2_id = sup2._id;
    await agent.save();
  }

  console.log('🎉 Initialisation terminée.');
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
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}

// Vérifie que l'utilisateur appartient au sous-système (sauf master)
function requireSubsystemAccess(req, res, next) {
  if (req.user.role === 'master') return next();
  if (!req.user.subsystem_id) return res.status(403).json({ error: 'Sous-système non défini' });
  req.subsystemId = req.user.subsystem_id;
  next();
}

// ==================== ROUTES ====================

// --- Authentification ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).populate('subsystem_id');
    if (!user) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    if (!user.is_active) return res.status(403).json({ success: false, error: 'Compte désactivé' });

    user.last_login = new Date();
    user.is_online = true;
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        level: user.level,
        subsystem_id: user.subsystem_id?._id || null
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    let redirectUrl = '/lotato.html';
    if (user.role === 'supervisor') redirectUrl = user.level === 1 ? '/control-level1.html' : '/control-level2.html';
    else if (user.role === 'subsystem') redirectUrl = '/subsystem-admin.html';
    else if (user.role === 'master') redirectUrl = '/master-dashboard.html';

    await ActivityLog.create({
      user_id: user._id,
      subsystem_id: user.subsystem_id?._id,
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
        subsystem_id: user.subsystem_id?._id
      },
      redirectUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { is_online: false });
  res.json({ success: true });
});

app.get('/api/auth/check', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password').populate('subsystem_id');
  res.json({ success: true, user: { ...user.toObject(), subsystem: user.subsystem_id } });
});

// --- Gestion des sous-systèmes (Master uniquement) ---
app.get('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
  const subsystems = await Subsystem.find().lean();
  // Ajouter le nombre d'utilisateurs actifs
  for (const s of subsystems) {
    const activeUsers = await User.countDocuments({ subsystem_id: s._id, is_active: true });
    s.active_users = activeUsers;
  }
  res.json({ success: true, subsystems });
});

app.post('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
  const { name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_months } = req.body;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + (subscription_months || 1));
  const subsystem = await Subsystem.create({
    name, subdomain, contact_email, contact_phone, max_users, subscription_type,
    subscription_expires: expires
  });
  // Créer la configuration par défaut
  await SubsystemConfig.create({ subsystem_id: subsystem._id });

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
});

app.put('/api/master/subsystems/:id/deactivate', authenticateToken, requireRole('master'), async (req, res) => {
  await Subsystem.findByIdAndUpdate(req.params.id, { is_active: false });
  res.json({ success: true });
});

app.delete('/api/master/reset-users', authenticateToken, requireRole('master'), async (req, res) => {
  await User.deleteMany({ role: { $ne: 'master' } });
  await Ticket.deleteMany({});
  await Bet.deleteMany({});
  await WinningTicket.deleteMany({});
  res.json({ success: true, message: 'Tous les utilisateurs (sauf master) et tickets supprimés.' });
});

// --- Gestion des utilisateurs pour un sous-système (propriétaire) ---
app.get('/api/subsystem/users', authenticateToken, requireRole('subsystem', 'master', 'supervisor'), async (req, res) => {
  let subsystemId = req.user.subsystem_id;
  if (req.user.role === 'master' && req.query.subsystem_id) subsystemId = req.query.subsystem_id;
  if (!subsystemId) return res.status(400).json({ error: 'Sous-système non spécifié' });

  const filter = { subsystem_id: subsystemId };
  if (req.user.role === 'supervisor') {
    // Superviseur ne voit que ses agents (ceux dont supervisor_id = son id)
    filter.role = 'agent';
    filter.supervisor_id = req.user.id;
  }
  const users = await User.find(filter).populate('supervisor_id', 'full_name').populate('supervisor2_id', 'full_name').lean();
  res.json({ success: true, users });
});

app.post('/api/subsystem/users/create', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { name, username, password, role, level, supervisorId, commission_rate } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ success: false, error: 'Nom déjà pris' });
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    full_name: name,
    username,
    password: hashed,
    role,
    level: level || null,
    subsystem_id: req.user.subsystem_id,
    supervisor_id: supervisorId || null,
    commission_rate: commission_rate || 10
  });
  await ActivityLog.create({ user_id: req.user.id, subsystem_id: req.user.subsystem_id, action: 'create_user', details: `Création de ${username} (${role})` });
  res.json({ success: true, userId: user._id });
});

app.put('/api/subsystem/users/:id', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { name, is_active, password, role, level, supervisorId, commission_rate } = req.body;
  const update = { full_name: name, is_active: !!is_active };
  if (password) update.password = await bcrypt.hash(password, SALT_ROUNDS);
  if (role) update.role = role;
  if (level !== undefined) update.level = level;
  if (supervisorId !== undefined) update.supervisor_id = supervisorId || null;
  if (commission_rate !== undefined) update.commission_rate = commission_rate;
  await User.findOneAndUpdate({ _id: req.params.id, subsystem_id: req.user.subsystem_id }, update);
  res.json({ success: true });
});

app.put('/api/subsystem/users/:id/status', authenticateToken, requireRole('subsystem'), async (req, res) => {
  await User.findOneAndUpdate({ _id: req.params.id, subsystem_id: req.user.subsystem_id }, { is_active: req.body.is_active });
  res.json({ success: true });
});

app.delete('/api/subsystem/users/:id', authenticateToken, requireRole('subsystem'), async (req, res) => {
  await User.findOneAndDelete({ _id: req.params.id, subsystem_id: req.user.subsystem_id });
  res.json({ success: true });
});

// --- Gestion des tirages (communs) ---
app.get('/api/subsystem/draws', authenticateToken, async (req, res) => {
  const draws = await Draw.find();
  res.json({ success: true, draws });
});

app.put('/api/subsystem/draws/:id/block', authenticateToken, requireRole('subsystem'), async (req, res) => {
  // Bloquer/débloquer un tirage pour ce sous-système (stocké dans SubsystemConfig)
  const { block } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config) return res.status(404).json({ error: 'Config introuvable' });
  if (!config.draw_restrictions) config.draw_restrictions = [];
  let drawRes = config.draw_restrictions.find(d => d.draw_id === req.params.id);
  if (!drawRes) {
    drawRes = { draw_id: req.params.id, blocked_numbers: [], number_limits: [] };
    config.draw_restrictions.push(drawRes);
  }
  drawRes.blocked = block; // ajout d'un champ booléen "blocked"
  await config.save();
  res.json({ success: true });
});

// --- Configuration sous-système (limites, blocages) ---
app.get('/api/subsystem/config', authenticateToken, requireSubsystemAccess, async (req, res) => {
  let config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  if (!config) config = await SubsystemConfig.create({ subsystem_id: req.subsystemId });
  res.json({ success: true, config });
});

app.post('/api/subsystem/config', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const config = await SubsystemConfig.findOneAndUpdate(
    { subsystem_id: req.user.subsystem_id },
    { $set: req.body },
    { upsert: true, new: true }
  );
  res.json({ success: true, config });
});

// Routes simplifiées pour les blocages (utilisées par subsystem-admin.html)
app.get('/api/subsystem/blocked-numbers', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  res.json({ blockedNumbers: config?.blocked_numbers || [] });
});
app.post('/api/subsystem/block-number', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config.blocked_numbers.includes(number)) config.blocked_numbers.push(number);
  await config.save();
  res.json({ success: true });
});
app.post('/api/subsystem/unblock-number', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  config.blocked_numbers = config.blocked_numbers.filter(n => n !== number);
  await config.save();
  res.json({ success: true });
});

app.get('/api/subsystem/global-limits', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  res.json(config?.global_limits || []);
});
app.post('/api/subsystem/global-limits', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number, limitAmount } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  const existing = config.global_limits.find(l => l.number === number);
  if (existing) existing.limit_amount = limitAmount;
  else config.global_limits.push({ number, limit_amount: limitAmount });
  await config.save();
  res.json({ success: true });
});
app.delete('/api/subsystem/global-limits/:number', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  config.global_limits = config.global_limits.filter(l => l.number !== req.params.number);
  await config.save();
  res.json({ success: true });
});

app.get('/api/subsystem/blocked-lotto3', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  res.json({ blockedNumbers: config?.blocked_lotto3 || [] });
});
app.post('/api/subsystem/block-lotto3', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config.blocked_lotto3.includes(number)) config.blocked_lotto3.push(number);
  await config.save();
  res.json({ success: true });
});
app.post('/api/subsystem/unblock-lotto3', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  config.blocked_lotto3 = config.blocked_lotto3.filter(n => n !== number);
  await config.save();
  res.json({ success: true });
});

app.post('/api/subsystem/block-number-draw', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { drawId, number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  let drawRes = config.draw_restrictions.find(d => d.draw_id === drawId);
  if (!drawRes) {
    drawRes = { draw_id: drawId, blocked_numbers: [], number_limits: [] };
    config.draw_restrictions.push(drawRes);
  }
  if (!drawRes.blocked_numbers.includes(number)) drawRes.blocked_numbers.push(number);
  await config.save();
  res.json({ success: true });
});
app.post('/api/subsystem/unblock-number-draw', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { drawId, number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  const drawRes = config.draw_restrictions.find(d => d.draw_id === drawId);
  if (drawRes) drawRes.blocked_numbers = drawRes.blocked_numbers.filter(n => n !== number);
  await config.save();
  res.json({ success: true });
});
app.post('/api/subsystem/number-limit', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { drawId, number, limitAmount } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  let drawRes = config.draw_restrictions.find(d => d.draw_id === drawId);
  if (!drawRes) {
    drawRes = { draw_id: drawId, blocked_numbers: [], number_limits: [] };
    config.draw_restrictions.push(drawRes);
  }
  const existing = drawRes.number_limits.find(l => l.number === number);
  if (existing) existing.limit_amount = limitAmount;
  else drawRes.number_limits.push({ number, limit_amount: limitAmount });
  await config.save();
  res.json({ success: true });
});

// --- Tickets (pour agent) ---
app.get('/api/tickets', authenticateToken, async (req, res) => {
  let filter = {};
  if (req.user.role === 'agent') filter.agent_id = req.user.id;
  else if (req.user.role === 'supervisor') {
    // Superviseur voit les tickets de ses agents
    const agents = await User.find({ supervisor_id: req.user.id, role: 'agent' }).select('_id');
    filter.agent_id = { $in: agents.map(a => a._id) };
  } else if (req.user.role === 'subsystem') filter.subsystem_id = req.user.subsystem_id;
  else if (req.user.role === 'master') {} // tout

  if (req.query.agent_id) filter.agent_id = req.query.agent_id;
  if (req.query.start && req.query.end) filter.created_at = { $gte: new Date(req.query.start), $lte: new Date(req.query.end) };

  const tickets = await Ticket.find(filter).populate('agent_id', 'full_name').sort('-created_at').limit(500).lean();
  for (const t of tickets) {
    t.bets = await Bet.find({ ticket_id: t._id }).lean();
    t.agent_name = t.agent_id?.full_name || 'Inconnu';
  }
  res.json({ success: true, tickets });
});

app.post('/api/tickets', authenticateToken, requireRole('agent'), async (req, res) => {
  try {
    const { draw, drawTime, bets, total } = req.body; // format de lotato.js
    const ticketNumber = 'T' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    const newTicket = await Ticket.create({
      ticket_number: ticketNumber,
      agent_id: req.user.id,
      subsystem_id: req.user.subsystem_id,
      draw,
      draw_time: drawTime,
      total_amount: total,
      status: 'active',
      is_synced: true
    });
    for (const bet of bets) {
      await Bet.create({
        ticket_id: newTicket._id,
        bet_type: bet.type,
        numbers: bet.number,
        amount: bet.amount,
        multiplier: bet.multiplier,
        options: bet.options || null
      });
    }
    await ActivityLog.create({ user_id: req.user.id, subsystem_id: req.user.subsystem_id, action: 'create_ticket', details: `Ticket ${ticketNumber} - ${total} HTG` });
    res.json({ success: true, ticketId: newTicket._id, ticketNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Pour lotato.js : tickets/pending (simulé)
app.get('/api/tickets/pending', authenticateToken, (req, res) => {
  res.json({ tickets: [] }); // pas de synchro offline ici
});

// --- Résultats (communs) ---
app.get('/api/results', async (req, res) => {
  const results = await Result.find().sort('-draw_date').limit(100).lean();
  const formatted = {};
  for (const r of results) {
    if (!formatted[r.draw]) formatted[r.draw] = {};
    formatted[r.draw][r.draw_time] = {
      date: r.draw_date.toISOString().split('T')[0],
      lot1: r.lot1,
      lot2: r.lot2,
      lot3: r.lot3,
      verified: r.verified
    };
  }
  res.json({ success: true, results: formatted });
});

app.post('/api/results', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
  const { draw, draw_time, draw_date, lot1, lot2, lot3, verified } = req.body;
  await Result.findOneAndUpdate(
    { draw, draw_time, draw_date },
    { lot1, lot2, lot3, verified: !!verified },
    { upsert: true }
  );
  // Déclencher vérification des tickets gagnants (optionnel)
  res.json({ success: true });
});

// --- Vérification des gagnants ---
app.get('/api/check-winners', authenticateToken, async (req, res) => {
  // Calculer les tickets gagnants pour le sous-système de l'utilisateur
  // (implémentation simplifiée, on renvoie les WinningTicket déjà en base)
  const tickets = await Ticket.find({ subsystem_id: req.user.subsystem_id }).lean();
  const results = await Result.find().lean();
  // ... logique de calcul (on ne la refait pas ici, car lotato.js le fait côté client)
  // On renvoie juste une liste vide pour l'instant, le front calcule.
  res.json({ success: true, winners: [] });
});

// --- Historique (pour lotato.js) ---
app.get('/api/history', authenticateToken, async (req, res) => {
  const tickets = await Ticket.find({ agent_id: req.user.id }).sort('-created_at').lean();
  res.json({ success: true, tickets });
});

// --- Infos société (par sous-système) ---
app.get('/api/company-info', authenticateToken, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config) return res.json({ name: 'Lotato', phone: '', address: '', slogan: '', agentCommission: 10, logo: '' });
  res.json({
    name: config.company_name,
    phone: config.company_phone,
    address: config.company_address,
    slogan: config.company_slogan,
    agentCommission: config.default_commission,
    logo: config.logo_url
  });
});

app.get('/api/logo', authenticateToken, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  res.json({ logoUrl: config?.logo_url || '' });
});

// --- Tickets multi-tirages (stockage simple) ---
app.get('/api/tickets/multi-draw', authenticateToken, async (req, res) => {
  // Pour l'instant, pas de persistance multi-draw
  res.json({ tickets: [] });
});
app.post('/api/tickets/multi-draw', authenticateToken, async (req, res) => {
  res.json({ success: true });
});

// --- Rapports pour superviseur / propriétaire ---
app.get('/api/subsystem/reports', authenticateToken, async (req, res) => {
  const { supervisorId, agentId, drawId, period } = req.query;
  let start = new Date();
  if (period === 'today') start.setHours(0,0,0,0);
  else if (period === 'week') start.setDate(start.getDate() - 7);
  else if (period === 'month') start.setMonth(start.getMonth() - 1);
  else start = new Date(0);

  let filter = { created_at: { $gte: start } };
  if (req.user.role === 'subsystem') filter.subsystem_id = req.user.subsystem_id;
  if (supervisorId && supervisorId !== 'all') {
    const agents = await User.find({ supervisor_id: supervisorId, role: 'agent' }).select('_id');
    filter.agent_id = { $in: agents.map(a => a._id) };
  }
  if (agentId && agentId !== 'all') filter.agent_id = agentId;
  if (drawId && drawId !== 'all') filter.draw = drawId;

  const tickets = await Ticket.find(filter).populate('agent_id');
  const totalTickets = tickets.length;
  const totalBets = tickets.reduce((s, t) => s + t.total_amount, 0);
  // Gains (à calculer selon résultats, simplifié)
  const totalWins = 0;
  res.json({ success: true, summary: { total_tickets: totalTickets, total_bets: totalBets, total_wins: totalWins } });
});

// --- Stats pour propriétaire ---
app.get('/api/subsystem/stats', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const ticketsToday = await Ticket.countDocuments({ subsystem_id: req.user.subsystem_id, created_at: { $gte: today } });
  const salesToday = await Ticket.aggregate([
    { $match: { subsystem_id: req.user.subsystem_id, created_at: { $gte: today } } },
    { $group: { _id: null, total: { $sum: '$total_amount' } } }
  ]);
  res.json({
    success: true,
    stats: {
      today_tickets: ticketsToday,
      today_sales: salesToday[0]?.total || 0,
      active_users: await User.countDocuments({ subsystem_id: req.user.subsystem_id, is_active: true })
    }
  });
});

// --- Paramètres globaux (pour subsystem-admin, on utilise SubsystemConfig) ---
app.get('/api/settings', authenticateToken, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config) return res.json({ success: true, settings: {} });
  const settings = {
    company_name: config.company_name,
    company_slogan: config.company_slogan,
    company_phone: config.company_phone,
    borlette_first: config.multipliers.borlette_first,
    borlette_second: config.multipliers.borlette_second,
    borlette_third: config.multipliers.borlette_third,
    lotto3: config.multipliers.lotto3,
    lotto4: config.multipliers.lotto4,
    lotto5: config.multipliers.lotto5,
    marriage: config.multipliers.marriage,
    grap: config.multipliers.grap,
    limit_lotto3: config.game_limits.lotto3,
    limit_lotto4: config.game_limits.lotto4,
    limit_lotto5: config.game_limits.lotto5,
    limit_mariage: config.game_limits.marriage
  };
  res.json({ success: true, settings });
});

app.post('/api/settings', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { settings } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config) return res.status(404).json({ error: 'Config introuvable' });
  if (settings.company_name) config.company_name = settings.company_name;
  if (settings.company_slogan) config.company_slogan = settings.company_slogan;
  if (settings.company_phone) config.company_phone = settings.company_phone;
  if (settings.borlette_first) config.multipliers.borlette_first = parseInt(settings.borlette_first);
  if (settings.borlette_second) config.multipliers.borlette_second = parseInt(settings.borlette_second);
  if (settings.borlette_third) config.multipliers.borlette_third = parseInt(settings.borlette_third);
  if (settings.lotto3) config.multipliers.lotto3 = parseInt(settings.lotto3);
  if (settings.lotto4) config.multipliers.lotto4 = parseInt(settings.lotto4);
  if (settings.lotto5) config.multipliers.lotto5 = parseInt(settings.lotto5);
  if (settings.marriage) config.multipliers.marriage = parseInt(settings.marriage);
  if (settings.grap) config.multipliers.grap = parseInt(settings.grap);
  if (settings.limit_lotto3 !== undefined) config.game_limits.lotto3 = parseInt(settings.limit_lotto3);
  if (settings.limit_lotto4 !== undefined) config.game_limits.lotto4 = parseInt(settings.limit_lotto4);
  if (settings.limit_lotto5 !== undefined) config.game_limits.lotto5 = parseInt(settings.limit_lotto5);
  if (settings.limit_mariage !== undefined) config.game_limits.marriage = parseInt(settings.limit_mariage);
  await config.save();
  res.json({ success: true });
});

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Fallback SPA ---
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint non trouvé' });
  }
});
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connecté à MongoDB');
    
    // Supprimer l'ancien index "key_1" de la collection draws s'il existe
    try {
      const drawsCollection = mongoose.connection.collection('draws');
      await drawsCollection.dropIndex('key_1');
      console.log('✅ Ancien index key_1 supprimé avec succès');
    } catch (err) {
      // Le code 27 signifie "index introuvable" - on ignore
      if (err.code !== 27) {
        console.warn('⚠️ Erreur lors de la suppression de l\'index:', err.message);
      } else {
        console.log('ℹ️ Index key_1 non trouvé, pas de suppression nécessaire');
      }
    }
    
    await initializeData();
    // ... le reste (démarrage du serveur)
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

// ==================== DÉMARRAGE ====================
initializeData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur Lotato démarré sur http://localhost:${PORT}`);
  });
});