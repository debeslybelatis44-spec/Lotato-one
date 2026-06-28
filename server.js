'use strict';

// ============================================================
// LOTATO — Serveur principal (Node.js / Express / MongoDB)
// ============================================================

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const multer   = require('multer');
const fs       = require('fs');

// ── Configuration ─────────────────────────────────────────────
const PORT         = process.env.PORT        || 3000;
const MONGODB_URI  = process.env.MONGODB_URI || 'mongodb://localhost:27017/lotato';
const JWT_SECRET   = process.env.JWT_SECRET  || 'lotato_jwt_secret_change_in_production';
const SALT_ROUNDS  = 10;

// ── Application ────────────────────────────────────────────────
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Upload logos ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// ═══════════════════════════════════════════════════════════════
// MODÈLES MONGOOSE
// ═══════════════════════════════════════════════════════════════

// ── Sous-système ───────────────────────────────────────────────
const subsystemSchema = new mongoose.Schema({
  name:                 { type: String, required: true },
  subdomain:            { type: String, required: true, unique: true },
  contact_email:        String,
  contact_phone:        String,
  max_users:            { type: Number, default: 10 },
  subscription_type:    { type: String, default: 'standard' },
  subscription_expires: Date,
  is_active:            { type: Boolean, default: true },
  logo_url:             String,
  created_at:           { type: Date, default: Date.now }
});
const Subsystem = mongoose.model('Subsystem', subsystemSchema);

// ── Utilisateur ────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username:       { type: String, required: true, unique: true },
  password:       { type: String, required: true },
  full_name:      String,
  email:          String,
  phone:          String,
  role:           { type: String, enum: ['agent', 'supervisor', 'subsystem', 'master'], required: true },
  level:          { type: Number, default: null },          // 1 ou 2 pour superviseur
  subsystem_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem' },
  supervisor_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supervisor2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  commission_rate:{ type: Number, default: 10 },
  is_active:      { type: Boolean, default: true },
  is_online:      { type: Boolean, default: false },
  last_login:     Date,
  created_at:     { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// ── Ticket ─────────────────────────────────────────────────────
const ticketSchema = new mongoose.Schema({
  ticket_number: { type: String, required: true, unique: true },
  agent_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subsystem_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true },
  draw:          { type: String, required: true },
  draw_time:     { type: String, required: true, enum: ['morning', 'evening'] },
  total_amount:  { type: Number, required: true },
  status:        { type: String, default: 'active' },
  created_at:    { type: Date, default: Date.now }
});
const Ticket = mongoose.model('Ticket', ticketSchema);

// ── Pari (bet) ─────────────────────────────────────────────────
const betSchema = new mongoose.Schema({
  ticket_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  bet_type:   { type: String, required: true },
  numbers:    { type: String, required: true },
  amount:     { type: Number, required: true },
  multiplier: { type: Number, required: true },
  options:    mongoose.Schema.Types.Mixed
});
const Bet = mongoose.model('Bet', betSchema);

// ── Résultat ───────────────────────────────────────────────────
const resultSchema = new mongoose.Schema({
  draw:      { type: String, required: true },
  draw_time: { type: String, required: true, enum: ['morning', 'evening'] },
  draw_date: { type: Date, required: true },
  lot1:      { type: String, required: true },
  lot2:      String,
  lot3:      String,
  verified:  { type: Boolean, default: false },
  created_at:{ type: Date, default: Date.now }
});
resultSchema.index({ draw: 1, draw_time: 1, draw_date: 1 }, { unique: true });
const Result = mongoose.model('Result', resultSchema);

// ── Ticket gagnant ─────────────────────────────────────────────
const winningTicketSchema = new mongoose.Schema({
  ticket_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  winning_amount: { type: Number, required: true },
  paid:           { type: Boolean, default: false },
  paid_at:        Date,
  created_at:     { type: Date, default: Date.now }
});
const WinningTicket = mongoose.model('WinningTicket', winningTicketSchema);

// ── Configuration sous-système ─────────────────────────────────
const subsystemConfigSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true, unique: true },
  multipliers: {
    borlette_first:  { type: Number, default: 60 },
    borlette_second: { type: Number, default: 20 },
    borlette_third:  { type: Number, default: 10 },
    lotto3:          { type: Number, default: 500 },
    lotto4:          { type: Number, default: 5000 },
    lotto5:          { type: Number, default: 25000 },
    grap:            { type: Number, default: 500 },
    marriage:        { type: Number, default: 1000 }
  },
  global_limits:   [{ number: String, limit_amount: { type: Number, default: 0 } }],
  blocked_numbers: [{ type: String }],
  blocked_lotto3:  [{ type: String }],
  draw_restrictions: [{
    draw_id:        { type: String, required: true },
    blocked:        { type: Boolean, default: false },
    blocked_numbers:[{ type: String }],
    number_limits:  [{ number: String, limit_amount: Number }]
  }],
  game_limits: {
    lotto3:  { type: Number, default: 0 },
    lotto4:  { type: Number, default: 0 },
    lotto5:  { type: Number, default: 0 },
    marriage:{ type: Number, default: 0 }
  },
  company_name:     { type: String, default: 'Lotato' },
  company_slogan:   { type: String, default: 'Chwazi yon Jwet' },
  company_phone:    { type: String, default: '+509 32 53 49 58' },
  company_address:  { type: String, default: 'Cap Haïtien' },
  logo_url:         { type: String, default: '' },
  footer_message:   { type: String, default: 'Mèsi pou konfyans ou!' },
  default_commission:{ type: Number, default: 10 }
});
const SubsystemConfig = mongoose.model('SubsystemConfig', subsystemConfigSchema);

// ── Tirage ─────────────────────────────────────────────────────
const drawSchema = new mongoose.Schema({
  id:     { type: String, required: true, unique: true },
  name:   { type: String, required: true },
  times:  { morning: String, evening: String },
  active: { type: Boolean, default: true }
});
const Draw = mongoose.model('Draw', drawSchema);

// ── Journal d'activité ─────────────────────────────────────────
const activityLogSchema = new mongoose.Schema({
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem' },
  action:       { type: String, required: true },
  details:      String,
  ip_address:   String,
  created_at:   { type: Date, default: Date.now }
});
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARES D'AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.headers['x-auth-token'];

  if (!token) return res.status(401).json({ success: false, error: 'Token manquant' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ success: false, error: 'Token invalide ou expiré' });
    req.user = payload;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    next();
  };
}

function requireSubsystemAccess(req, res, next) {
  if (req.user.role === 'master') return next();
  if (!req.user.subsystem_id)
    return res.status(403).json({ success: false, error: 'Sous-système non défini' });
  req.subsystemId = req.user.subsystem_id;
  next();
}

// ── Helper : log d'activité ────────────────────────────────────
function logActivity(userId, subsystemId, action, details, ip) {
  ActivityLog.create({ user_id: userId, subsystem_id: subsystemId, action, details, ip_address: ip }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
// ROUTES — AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, error: 'Identifiant et mot de passe requis' });

    const user = await User.findOne({ username }).populate('subsystem_id').lean();
    if (!user) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    if (!user.is_active) return res.status(403).json({ success: false, error: 'Compte désactivé' });

    // Mise à jour online / last_login
    await User.findByIdAndUpdate(user._id, { is_online: true, last_login: new Date() });

    const payload = {
      id:           user._id.toString(),
      username:     user.username,
      full_name:    user.full_name,
      role:         user.role,
      level:        user.level,
      subsystem_id: user.subsystem_id?._id?.toString() || null
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    // URL de redirection selon le rôle
    const redirectMap = {
      agent:     '/lotato.html',
      supervisor: user.level === 1 ? '/control-level1.html' : '/control-level2.html',
      subsystem: '/subsystem-admin.html',
      master:    '/master-dashboard.html'
    };

    logActivity(user._id, user.subsystem_id?._id, 'login', `Connexion (${user.role})`, req.ip);

    res.json({
      success: true,
      token,
      user:    { ...payload },
      redirectUrl: redirectMap[user.role] || '/index.html'
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { is_online: false });
  logActivity(req.user.id, req.user.subsystem_id, 'logout', 'Déconnexion', req.ip);
  res.json({ success: true });
});

app.get('/api/auth/check', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password').populate('subsystem_id').lean();
  if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
  res.json({ success: true, user });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — MASTER
// ═══════════════════════════════════════════════════════════════

app.get('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
  const subsystems = await Subsystem.find().sort('-created_at').lean();
  for (const s of subsystems) {
    s.active_users = await User.countDocuments({ subsystem_id: s._id, is_active: true });
  }
  res.json({ success: true, subsystems });
});

app.post('/api/master/subsystems', authenticateToken, requireRole('master'), async (req, res) => {
  try {
    const { name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_months } = req.body;
    if (!name || !subdomain) return res.status(400).json({ success: false, error: 'Nom et sous-domaine requis' });

    const expires = new Date();
    expires.setMonth(expires.getMonth() + (parseInt(subscription_months) || 1));

    const subsystem = await Subsystem.create({ name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_expires: expires });
    await SubsystemConfig.create({ subsystem_id: subsystem._id });

    const adminUsername = `admin_${subdomain}`;
    const adminPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await User.create({ username: adminUsername, password: hashed, full_name: `Admin ${name}`, role: 'subsystem', subsystem_id: subsystem._id });

    logActivity(req.user.id, null, 'create_subsystem', `Nouveau sous-système : ${name}`, req.ip);
    res.json({ success: true, subsystemId: subsystem._id, admin_credentials: { username: adminUsername, password: adminPassword, email: contact_email } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Ce sous-domaine existe déjà' });
    console.error(err);
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
  await User.deleteMany({ role: { $ne: 'master' } });
  await Ticket.deleteMany({});
  await Bet.deleteMany({});
  await WinningTicket.deleteMany({});
  res.json({ success: true, message: 'Réinitialisation effectuée (master conservé)' });
});

app.get('/api/master/stats', authenticateToken, requireRole('master'), async (req, res) => {
  const totalSubsystems  = await Subsystem.countDocuments();
  const activeSubsystems = await Subsystem.countDocuments({ is_active: true });
  const totalUsers       = await User.countDocuments({ role: { $ne: 'master' } });
  const totalTickets     = await Ticket.countDocuments();
  res.json({ success: true, stats: { totalSubsystems, activeSubsystems, totalUsers, totalTickets } });
});

app.get('/api/master/activity', authenticateToken, requireRole('master'), async (req, res) => {
  const logs = await ActivityLog.find().sort('-created_at').limit(100).populate('user_id', 'username full_name').lean();
  res.json({ success: true, logs });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — UTILISATEURS (propriétaire / master)
// ═══════════════════════════════════════════════════════════════

app.get('/api/subsystem/users', authenticateToken, requireRole('subsystem', 'master', 'supervisor'), async (req, res) => {
  let subsystemId = req.user.subsystem_id;
  if (req.user.role === 'master' && req.query.subsystem_id) subsystemId = req.query.subsystem_id;
  if (!subsystemId) return res.status(400).json({ success: false, error: 'Sous-système non spécifié' });

  const filter = { subsystem_id: subsystemId };
  if (req.user.role === 'supervisor') {
    // Un superviseur ne voit que ses agents directs
    filter.role = 'agent';
    filter.supervisor_id = req.user.id;
  }

  const users = await User.find(filter)
    .select('-password')
    .populate('supervisor_id', 'full_name username')
    .populate('supervisor2_id', 'full_name username')
    .lean();
  res.json({ success: true, users });
});

app.post('/api/subsystem/users/create', authenticateToken, requireRole('subsystem'), async (req, res) => {
  try {
    const { name, username, password, role, level, supervisorId, supervisor2Id, commission_rate } = req.body;
    if (!name || !username || !password || !role)
      return res.status(400).json({ success: false, error: 'Champs obligatoires manquants' });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ success: false, error: 'Identifiant déjà utilisé' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      full_name:       name,
      username,
      password:        hashed,
      role,
      level:           level || null,
      subsystem_id:    req.user.subsystem_id,
      supervisor_id:   supervisorId  || null,
      supervisor2_id:  supervisor2Id || null,
      commission_rate: commission_rate || 10
    });
    logActivity(req.user.id, req.user.subsystem_id, 'create_user', `Création de ${username} (${role})`, req.ip);
    res.json({ success: true, userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.put('/api/subsystem/users/:id', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { name, is_active, password, role, level, supervisorId, supervisor2Id, commission_rate } = req.body;
  const update = {};
  if (name !== undefined)            update.full_name       = name;
  if (is_active !== undefined)       update.is_active       = is_active;
  if (role !== undefined)            update.role            = role;
  if (level !== undefined)           update.level           = level;
  if (supervisorId !== undefined)    update.supervisor_id   = supervisorId  || null;
  if (supervisor2Id !== undefined)   update.supervisor2_id  = supervisor2Id || null;
  if (commission_rate !== undefined) update.commission_rate = commission_rate;
  if (password)                      update.password        = await bcrypt.hash(password, SALT_ROUNDS);

  await User.findOneAndUpdate({ _id: req.params.id, subsystem_id: req.user.subsystem_id }, update);
  res.json({ success: true });
});

app.put('/api/subsystem/users/:id/status', authenticateToken, requireRole('subsystem'), async (req, res) => {
  await User.findOneAndUpdate(
    { _id: req.params.id, subsystem_id: req.user.subsystem_id },
    { is_active: req.body.is_active }
  );
  res.json({ success: true });
});

app.delete('/api/subsystem/users/:id', authenticateToken, requireRole('subsystem'), async (req, res) => {
  await User.findOneAndDelete({ _id: req.params.id, subsystem_id: req.user.subsystem_id });
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — TIRAGES
// ═══════════════════════════════════════════════════════════════

app.get('/api/subsystem/draws', authenticateToken, async (req, res) => {
  const draws = await Draw.find({ active: true }).lean();
  res.json({ success: true, draws });
});

app.put('/api/subsystem/draws/:id/block', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { block } = req.body;
  let config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config) return res.status(404).json({ success: false, error: 'Configuration introuvable' });

  let drawRes = config.draw_restrictions.find(d => d.draw_id === req.params.id);
  if (!drawRes) {
    config.draw_restrictions.push({ draw_id: req.params.id, blocked: !!block, blocked_numbers: [], number_limits: [] });
  } else {
    drawRes.blocked = !!block;
  }
  await config.save();
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — CONFIGURATION SOUS-SYSTÈME
// ═══════════════════════════════════════════════════════════════

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

// ── Paramètres (multiplicateurs, infos société) ────────────────
app.get('/api/settings', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  if (!config) return res.json({ success: true, settings: {} });
  res.json({
    success: true,
    settings: {
      company_name:    config.company_name,
      company_slogan:  config.company_slogan,
      company_phone:   config.company_phone,
      company_address: config.company_address,
      logo_url:        config.logo_url,
      footer_message:  config.footer_message,
      default_commission: config.default_commission,
      borlette_first:  config.multipliers.borlette_first,
      borlette_second: config.multipliers.borlette_second,
      borlette_third:  config.multipliers.borlette_third,
      lotto3:          config.multipliers.lotto3,
      lotto4:          config.multipliers.lotto4,
      lotto5:          config.multipliers.lotto5,
      marriage:        config.multipliers.marriage,
      grap:            config.multipliers.grap,
      limit_lotto3:    config.game_limits.lotto3,
      limit_lotto4:    config.game_limits.lotto4,
      limit_lotto5:    config.game_limits.lotto5,
      limit_marriage:  config.game_limits.marriage
    }
  });
});

app.post('/api/settings', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const s = req.body.settings || req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config) return res.status(404).json({ success: false, error: 'Configuration introuvable' });

  if (s.company_name    !== undefined) config.company_name    = s.company_name;
  if (s.company_slogan  !== undefined) config.company_slogan  = s.company_slogan;
  if (s.company_phone   !== undefined) config.company_phone   = s.company_phone;
  if (s.company_address !== undefined) config.company_address = s.company_address;
  if (s.footer_message  !== undefined) config.footer_message  = s.footer_message;
  if (s.default_commission !== undefined) config.default_commission = parseFloat(s.default_commission);
  if (s.borlette_first  !== undefined) config.multipliers.borlette_first  = parseInt(s.borlette_first);
  if (s.borlette_second !== undefined) config.multipliers.borlette_second = parseInt(s.borlette_second);
  if (s.borlette_third  !== undefined) config.multipliers.borlette_third  = parseInt(s.borlette_third);
  if (s.lotto3          !== undefined) config.multipliers.lotto3           = parseInt(s.lotto3);
  if (s.lotto4          !== undefined) config.multipliers.lotto4           = parseInt(s.lotto4);
  if (s.lotto5          !== undefined) config.multipliers.lotto5           = parseInt(s.lotto5);
  if (s.marriage        !== undefined) config.multipliers.marriage         = parseInt(s.marriage);
  if (s.grap            !== undefined) config.multipliers.grap             = parseInt(s.grap);
  if (s.limit_lotto3    !== undefined) config.game_limits.lotto3           = parseInt(s.limit_lotto3);
  if (s.limit_lotto4    !== undefined) config.game_limits.lotto4           = parseInt(s.limit_lotto4);
  if (s.limit_lotto5    !== undefined) config.game_limits.lotto5           = parseInt(s.limit_lotto5);
  if (s.limit_marriage  !== undefined) config.game_limits.marriage         = parseInt(s.limit_marriage);

  config.markModified('multipliers');
  config.markModified('game_limits');
  await config.save();
  res.json({ success: true });
});

// ── Upload logo ────────────────────────────────────────────────
app.post('/api/settings/logo', authenticateToken, requireRole('subsystem'), upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Aucun fichier reçu' });
  const logoUrl = `/uploads/${req.file.filename}`;
  await SubsystemConfig.findOneAndUpdate(
    { subsystem_id: req.user.subsystem_id },
    { logo_url: logoUrl },
    { upsert: true }
  );
  res.json({ success: true, logoUrl });
});

// ── Boules bloquées ────────────────────────────────────────────
app.get('/api/subsystem/blocked-numbers', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  res.json({ success: true, blockedNumbers: config?.blocked_numbers || [] });
});

app.post('/api/subsystem/block-number', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config.blocked_numbers.includes(number)) { config.blocked_numbers.push(number); await config.save(); }
  res.json({ success: true });
});

app.post('/api/subsystem/unblock-number', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  config.blocked_numbers = config.blocked_numbers.filter(n => n !== number);
  await config.save();
  res.json({ success: true });
});

// ── Limites globales ───────────────────────────────────────────
app.get('/api/subsystem/global-limits', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  res.json({ success: true, limits: config?.global_limits || [] });
});

app.post('/api/subsystem/global-limits', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number, limitAmount } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  const existing = config.global_limits.find(l => l.number === number);
  if (existing) existing.limit_amount = limitAmount;
  else config.global_limits.push({ number, limit_amount: limitAmount });
  config.markModified('global_limits');
  await config.save();
  res.json({ success: true });
});

app.delete('/api/subsystem/global-limits/:number', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  config.global_limits = config.global_limits.filter(l => l.number !== req.params.number);
  await config.save();
  res.json({ success: true });
});

// ── Lotto3 bloqués ─────────────────────────────────────────────
app.get('/api/subsystem/blocked-lotto3', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  res.json({ success: true, blockedNumbers: config?.blocked_lotto3 || [] });
});

app.post('/api/subsystem/block-lotto3', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config.blocked_lotto3.includes(number)) { config.blocked_lotto3.push(number); await config.save(); }
  res.json({ success: true });
});

app.post('/api/subsystem/unblock-lotto3', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  config.blocked_lotto3 = config.blocked_lotto3.filter(n => n !== number);
  await config.save();
  res.json({ success: true });
});

// ── Restrictions par tirage ────────────────────────────────────
app.get('/api/subsystem/restrictions', authenticateToken, requireSubsystemAccess, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.subsystemId });
  res.json({ success: true, restrictions: config?.draw_restrictions || [] });
});

app.post('/api/subsystem/block-number-draw', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { drawId, number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  let dr = config.draw_restrictions.find(d => d.draw_id === drawId);
  if (!dr) { dr = { draw_id: drawId, blocked: false, blocked_numbers: [], number_limits: [] }; config.draw_restrictions.push(dr); }
  if (!dr.blocked_numbers.includes(number)) dr.blocked_numbers.push(number);
  config.markModified('draw_restrictions');
  await config.save();
  res.json({ success: true });
});

app.post('/api/subsystem/unblock-number-draw', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { drawId, number } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  const dr = config.draw_restrictions.find(d => d.draw_id === drawId);
  if (dr) { dr.blocked_numbers = dr.blocked_numbers.filter(n => n !== number); config.markModified('draw_restrictions'); await config.save(); }
  res.json({ success: true });
});

app.post('/api/subsystem/number-limit', authenticateToken, requireRole('subsystem'), async (req, res) => {
  const { drawId, number, limitAmount } = req.body;
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  let dr = config.draw_restrictions.find(d => d.draw_id === drawId);
  if (!dr) { dr = { draw_id: drawId, blocked: false, blocked_numbers: [], number_limits: [] }; config.draw_restrictions.push(dr); }
  const existing = dr.number_limits.find(l => l.number === number);
  if (existing) existing.limit_amount = limitAmount;
  else dr.number_limits.push({ number, limit_amount: limitAmount });
  config.markModified('draw_restrictions');
  await config.save();
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — TICKETS
// ═══════════════════════════════════════════════════════════════

app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'agent') {
      filter.agent_id = req.user.id;
    } else if (req.user.role === 'supervisor') {
      const agents = await User.find({ supervisor_id: req.user.id, role: 'agent' }).select('_id');
      filter.agent_id = { $in: agents.map(a => a._id) };
    } else if (req.user.role === 'subsystem') {
      filter.subsystem_id = req.user.subsystem_id;
    }
    // master : tout

    if (req.query.agent_id) filter.agent_id = req.query.agent_id;
    if (req.query.draw)     filter.draw      = req.query.draw;
    if (req.query.start && req.query.end)
      filter.created_at = { $gte: new Date(req.query.start), $lte: new Date(req.query.end) };

    const tickets = await Ticket.find(filter)
      .populate('agent_id', 'full_name username')
      .sort('-created_at')
      .limit(500)
      .lean();

    // Charger les paris en une seule requête
    const ticketIds = tickets.map(t => t._id);
    const bets = await Bet.find({ ticket_id: { $in: ticketIds } }).lean();
    const betsMap = {};
    bets.forEach(b => {
      const key = b.ticket_id.toString();
      if (!betsMap[key]) betsMap[key] = [];
      betsMap[key].push(b);
    });

    const result = tickets.map(t => ({
      ...t,
      bets:       betsMap[t._id.toString()] || [],
      agent_name: t.agent_id?.full_name || t.agent_id?.username || 'Inconnu'
    }));

    res.json({ success: true, tickets: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.post('/api/tickets', authenticateToken, requireRole('agent'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { draw, drawTime, bets, total } = req.body;
    if (!draw || !drawTime || !bets || !Array.isArray(bets) || bets.length === 0)
      return res.status(400).json({ success: false, error: 'Données de ticket invalides' });

    const ticketNumber = `T${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const [newTicket] = await Ticket.create([{
      ticket_number: ticketNumber,
      agent_id:      req.user.id,
      subsystem_id:  req.user.subsystem_id,
      draw,
      draw_time:     drawTime,
      total_amount:  total
    }], { session });

    const betDocs = bets.map(b => ({
      ticket_id:  newTicket._id,
      bet_type:   b.type,
      numbers:    b.number,
      amount:     b.amount,
      multiplier: b.multiplier,
      options:    b.options || null
    }));
    await Bet.insertMany(betDocs, { session });

    await session.commitTransaction();
    session.endSession();

    logActivity(req.user.id, req.user.subsystem_id, 'create_ticket', `Ticket ${ticketNumber} - ${total} HTG`, req.ip);
    res.json({ success: true, ticketId: newTicket._id, ticketNumber });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du ticket' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — RÉSULTATS
// ═══════════════════════════════════════════════════════════════

app.get('/api/results', async (req, res) => {
  const results = await Result.find().sort('-draw_date').limit(200).lean();
  const formatted = {};
  for (const r of results) {
    if (!formatted[r.draw]) formatted[r.draw] = {};
    formatted[r.draw][r.draw_time] = {
      date:     r.draw_date.toISOString().split('T')[0],
      lot1:     r.lot1,
      lot2:     r.lot2,
      lot3:     r.lot3,
      verified: r.verified
    };
  }
  res.json({ success: true, results: formatted });
});

app.post('/api/results', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
  try {
    const { draw, draw_time, draw_date, lot1, lot2, lot3, verified } = req.body;
    if (!draw || !draw_time || !draw_date || !lot1)
      return res.status(400).json({ success: false, error: 'Champs requis manquants' });

    await Result.findOneAndUpdate(
      { draw, draw_time, draw_date: new Date(draw_date) },
      { lot1, lot2, lot3, verified: !!verified },
      { upsert: true }
    );
    logActivity(req.user.id, req.user.subsystem_id, 'publish_result', `Résultat ${draw} ${draw_time}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — RAPPORTS
// ═══════════════════════════════════════════════════════════════

app.get('/api/subsystem/stats', authenticateToken, requireRole('subsystem', 'master'), async (req, res) => {
  const subsystemId = req.user.role === 'master' && req.query.subsystem_id
    ? req.query.subsystem_id
    : req.user.subsystem_id;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [todayTickets, salesAgg, activeUsers] = await Promise.all([
    Ticket.countDocuments({ subsystem_id: subsystemId, created_at: { $gte: today } }),
    Ticket.aggregate([
      { $match: { subsystem_id: new mongoose.Types.ObjectId(subsystemId), created_at: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]),
    User.countDocuments({ subsystem_id: subsystemId, is_active: true })
  ]);
  res.json({ success: true, stats: { today_tickets: todayTickets, today_sales: salesAgg[0]?.total || 0, active_users: activeUsers } });
});

app.get('/api/subsystem/reports', authenticateToken, async (req, res) => {
  const { supervisorId, agentId, drawId, period, start, end } = req.query;

  let startDate = new Date(0);
  let endDate   = new Date();

  if (period === 'today')   { startDate = new Date(); startDate.setHours(0, 0, 0, 0); }
  else if (period === 'week')  { startDate = new Date(); startDate.setDate(startDate.getDate() - 7); }
  else if (period === 'month') { startDate = new Date(); startDate.setMonth(startDate.getMonth() - 1); }
  else if (start && end)    { startDate = new Date(start); endDate = new Date(end); }

  const filter = { created_at: { $gte: startDate, $lte: endDate } };

  if (req.user.role === 'subsystem') filter.subsystem_id = req.user.subsystem_id;
  if (supervisorId && supervisorId !== 'all') {
    const agents = await User.find({ supervisor_id: supervisorId, role: 'agent' }).select('_id');
    filter.agent_id = { $in: agents.map(a => a._id) };
  }
  if (agentId && agentId !== 'all') filter.agent_id = agentId;
  if (drawId  && drawId  !== 'all') filter.draw = drawId;

  const tickets   = await Ticket.find(filter).lean();
  const totalBets = tickets.reduce((s, t) => s + t.total_amount, 0);

  res.json({ success: true, summary: { total_tickets: tickets.length, total_bets: totalBets, total_wins: 0 } });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — INFOS SOCIÉTÉ / LOGO (pour l'interface agent)
// ═══════════════════════════════════════════════════════════════

app.get('/api/company-info', authenticateToken, async (req, res) => {
  const config = await SubsystemConfig.findOne({ subsystem_id: req.user.subsystem_id });
  if (!config) return res.json({ name: 'Lotato', phone: '', address: '', slogan: '', agentCommission: 10, logo: '' });
  res.json({
    name:            config.company_name,
    phone:           config.company_phone,
    address:         config.company_address,
    slogan:          config.company_slogan,
    footer:          config.footer_message,
    agentCommission: config.default_commission,
    logo:            config.logo_url,
    multipliers: {
      borlette_first:  config.multipliers.borlette_first,
      borlette_second: config.multipliers.borlette_second,
      borlette_third:  config.multipliers.borlette_third,
      lotto3:          config.multipliers.lotto3,
      lotto4:          config.multipliers.lotto4,
      lotto5:          config.multipliers.lotto5,
      grap:            config.multipliers.grap,
      marriage:        config.multipliers.marriage
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — HISTORIQUE AGENT
// ═══════════════════════════════════════════════════════════════

app.get('/api/history', authenticateToken, async (req, res) => {
  const tickets = await Ticket.find({ agent_id: req.user.id }).sort('-created_at').limit(200).lean();
  const ticketIds = tickets.map(t => t._id);
  const bets = await Bet.find({ ticket_id: { $in: ticketIds } }).lean();
  const betsMap = {};
  bets.forEach(b => { const k = b.ticket_id.toString(); if (!betsMap[k]) betsMap[k] = []; betsMap[k].push(b); });
  const result = tickets.map(t => ({ ...t, bets: betsMap[t._id.toString()] || [] }));
  res.json({ success: true, tickets: result });
});

// ── Multi-tirages (stub persistant) ───────────────────────────
app.get('/api/tickets/multi-draw',  authenticateToken, (_req, res) => res.json({ success: true, tickets: [] }));
app.post('/api/tickets/multi-draw', authenticateToken, (_req, res) => res.json({ success: true }));

// ═══════════════════════════════════════════════════════════════
// ROUTE — HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Fallback SPA ───────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ success: false, error: 'Endpoint introuvable' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════════════════════════════════════════════════
// INITIALISATION DES DONNÉES
// ═══════════════════════════════════════════════════════════════

async function initializeData() {
  console.log('📦 Initialisation des données de base...');

  // Tirages par défaut
  const defaultDraws = [
    { id: 'miami',   name: 'Miami (Florida)', times: { morning: '1:30 PM',  evening: '9:50 PM' } },
    { id: 'georgia', name: 'Georgia',          times: { morning: '12:30 PM', evening: '7:00 PM' } },
    { id: 'newyork', name: 'New York',          times: { morning: '2:30 PM',  evening: '8:00 PM' } },
    { id: 'texas',   name: 'Texas',             times: { morning: '12:00 PM', evening: '6:00 PM' } },
    { id: 'tunisia', name: 'Tunisie',           times: { morning: '10:30 AM', evening: '2:00 PM' } }
  ];
  for (const d of defaultDraws) {
    await Draw.findOneAndUpdate({ id: d.id }, d, { upsert: true });
  }

  // Sous-système démo
  let demoSub = await Subsystem.findOne({ subdomain: 'demo' });
  if (!demoSub) {
    demoSub = await Subsystem.create({ name: 'Sous-système Démo', subdomain: 'demo', contact_email: 'demo@lotato.local', max_users: 20 });
    await SubsystemConfig.create({ subsystem_id: demoSub._id, company_name: 'Lotato Demo' });
  }

  // Utilisateurs de base
  const usersToEnsure = [
    { username: 'master',       password: 'master123', full_name: 'Master Admin',     role: 'master' },
    { username: 'proprietaire', password: 'prop123',   full_name: 'Propriétaire Demo', role: 'subsystem',  subsystem_id: demoSub._id },
    { username: 'superviseur1', password: 'sup1123',   full_name: 'Superviseur N1',    role: 'supervisor', level: 1, subsystem_id: demoSub._id },
    { username: 'superviseur2', password: 'sup2123',   full_name: 'Superviseur N2',    role: 'supervisor', level: 2, subsystem_id: demoSub._id },
    { username: 'agent1',       password: 'agent123',  full_name: 'Agent Demo',        role: 'agent',      subsystem_id: demoSub._id }
  ];

  const created = {};
  for (const u of usersToEnsure) {
    let user = await User.findOne({ username: u.username });
    if (!user) {
      const hashed = await bcrypt.hash(u.password, SALT_ROUNDS);
      user = await User.create({ ...u, password: hashed });
      console.log(`  ✅ Utilisateur créé : ${u.username}`);
    }
    created[u.username] = user;
  }

  // Lier agent1 aux superviseurs
  const agent = created['agent1'];
  if (agent && !agent.supervisor_id) {
    await User.findByIdAndUpdate(agent._id, {
      supervisor_id:  created['superviseur1']._id,
      supervisor2_id: created['superviseur2']._id
    });
  }

  console.log('🎉 Initialisation terminée.');
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connecté à MongoDB');

    // Suppression des vieux index conflictuels (migration)
    try {
      await mongoose.connection.collection('draws').dropIndex('key_1');
    } catch (_) { /* ignoré */ }

    await initializeData();

    app.listen(PORT, () => {
      console.log(`🚀 Serveur Lotato démarré → http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Connexion MongoDB échouée :', err.message);
    process.exit(1);
  });
