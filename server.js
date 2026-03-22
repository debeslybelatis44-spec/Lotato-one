require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// ==================== MODÈLES ====================

// Utilisateur
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: String,
  role: { type: String, enum: ['master', 'subsystem', 'agent'], required: true },
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem' },
  is_active: { type: Boolean, default: true },
  is_online: { type: Boolean, default: false },
  last_login: Date,
  created_at: { type: Date, default: Date.now }
});
userSchema.methods.comparePassword = async function(candidate) {
  return await bcrypt.compare(candidate, this.password);
};

// Sous-système (propriétaire)
const subsystemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  contact_email: { type: String, required: true },
  contact_phone: String,
  max_users: { type: Number, default: 10 },
  is_active: { type: Boolean, default: true },
  subscription_type: { type: String, default: 'basic' },
  subscription_expires: Date,
  created_at: { type: Date, default: Date.now },
  stats: {
    active_users: { type: Number, default: 0 },
    today_sales: { type: Number, default: 0 },
    today_tickets: { type: Number, default: 0 },
    total_sales: { type: Number, default: 0 }
  }
});

// Paramètres par sous-système (nom, logo, slogan, multiplicateurs, limites)
const subsystemSettingsSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true, unique: true },
  name: { type: String, default: 'Mon Borlette' },
  slogan: { type: String, default: 'Votre chance, notre jeu' },
  logoUrl: { type: String, default: '' },
  multipliers: {
    lot1: { type: Number, default: 60 },
    lot2: { type: Number, default: 20 },
    lot3: { type: Number, default: 10 },
    lotto3: { type: Number, default: 500 },
    lotto4: { type: Number, default: 5000 },
    lotto5: { type: Number, default: 25000 },
    mariage: { type: Number, default: 500 }
  },
  limits: {
    lotto3: { type: Number, default: 0 },
    lotto4: { type: Number, default: 0 },
    lotto5: { type: Number, default: 0 },
    mariage: { type: Number, default: 0 }
  },
  updated_at: { type: Date, default: Date.now }
});

// Tirage global (partagé)
const drawSchema = new mongoose.Schema({
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  times: {
    morning: { type: String, default: '12:00' },
    evening: { type: String, default: '18:00' }
  },
  is_active: { type: Boolean, default: true }
});

// Résultat d'un tirage pour un sous-système
const resultSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true },
  draw_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Draw', required: true },
  draw_time: { type: String, enum: ['morning', 'evening'], required: true },
  date: { type: Date, required: true },
  lot1: { type: String, required: true },   // 3 chiffres
  lot2: { type: String, required: true },   // 2 chiffres
  lot3: { type: String, required: true },   // 2 chiffres
  verified: { type: Boolean, default: false }
});
resultSchema.index({ subsystem_id: 1, draw_id: 1, draw_time: 1, date: 1 }, { unique: true });

// Schéma de pari (betSchema) – doit être défini avant ticketSchema
const betSchema = new mongoose.Schema({
  type: String, name: String, number: String, amount: Number, multiplier: Number,
  isGroup: Boolean, details: Array, options: Object, perOptionAmount: Number,
  isLotto4: Boolean, isLotto5: Boolean, isAuto: Boolean
}, { _id: false });

// Ticket (modifié pour utiliser draw (string) au lieu de draw_id)
const ticketSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agent_name: String,
  number: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  draw: String,          // nom du tirage (ex: "miami")
  draw_time: String,     // "morning" ou "evening"
  bets: [betSchema],
  total: Number,
  status: { type: String, default: 'active' },
  syncStatus: { type: String, default: 'synced' },
  is_synced: { type: Boolean, default: true },
  synced_at: Date
});
ticketSchema.index({ subsystem_id: 1, date: -1 });
ticketSchema.index({ agent_id: 1, date: -1 });

// Multi‑tirage ticket
const multiDrawTicketSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agent_name: String,
  number: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  bets: [{
    gameType: String,
    name: String,
    number: String,
    amount: Number,
    multiplier: Number,
    draws: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Draw' }]
  }],
  draws: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Draw' }],
  total: Number,
  status: { type: String, default: 'active' }
});

// Historique
const historySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: String,
  action: String,
  details: String,
  timestamp: { type: Date, default: Date.now }
});

// Restriction
const restrictionSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', required: true },
  number: { type: String, required: true },
  type: { type: String, enum: ['block', 'limit'], required: true },
  limitAmount: Number,
  draw_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Draw', default: null },
  time: { type: String, default: 'all' },
  created_at: { type: Date, default: Date.now }
});

// CompanyInfo (pour compatibilité)
const companyInfoSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsystem', unique: true },
  name: String,
  phone: String,
  address: String,
  reportTitle: String,
  reportPhone: String,
  logoUrl: String
});

// Settings global
const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});

// Modèles
const User = mongoose.model('User', userSchema);
const Subsystem = mongoose.model('Subsystem', subsystemSchema);
const SubsystemSettings = mongoose.model('SubsystemSettings', subsystemSettingsSchema);
const Draw = mongoose.model('Draw', drawSchema);
const Result = mongoose.model('Result', resultSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const MultiDrawTicket = mongoose.model('MultiDrawTicket', multiDrawTicketSchema);
const History = mongoose.model('History', historySchema);
const Restriction = mongoose.model('Restriction', restrictionSchema);
const CompanyInfo = mongoose.model('CompanyInfo', companyInfoSchema);
const Setting = mongoose.model('Setting', settingsSchema);

// ==================== MIDDLEWARE AUTH ====================
const auth = async (req, res, next) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ error: 'Accès refusé. Token manquant.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.is_active) return res.status(401).json({ error: 'Utilisateur invalide.' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès interdit.' });
  next();
};

// ==================== EXPRESS APP ====================
const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ==================== ROUTES ====================

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Champs requis.' });
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ success: false, error: 'Identifiants incorrects.' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ success: false, error: 'Identifiants incorrects.' });
    if (!user.is_active) return res.status(403).json({ success: false, error: 'Compte désactivé.' });

    user.last_login = new Date();
    user.is_online = true;
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userData = {
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      subsystem_id: user.subsystem_id
    };
    res.json({ success: true, admin: userData, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/auth/check', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, admin: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// --- MASTER ROUTES (gestion des sous-systèmes, statistiques globales) ---

// Créer un sous-système
app.post('/api/master/subsystems', auth, authorize('master'), async (req, res) => {
  try {
    const { name, subdomain, contact_email, contact_phone, max_users = 10, subscription_type = 'basic', subscription_months = 1 } = req.body;
    if (!name || !subdomain || !contact_email) return res.status(400).json({ success: false, error: 'Champs manquants.' });
    const existing = await Subsystem.findOne({ subdomain });
    if (existing) return res.status(400).json({ success: false, error: 'Sous-domaine déjà utilisé.' });

    const subscription_expires = new Date();
    subscription_expires.setMonth(subscription_expires.getMonth() + subscription_months);

    const subsystem = new Subsystem({ name, subdomain, contact_email, contact_phone, max_users, subscription_type, subscription_expires });
    await subsystem.save();

    const adminUsername = `admin_${subdomain.replace(/[^a-z0-9]/g, '')}`;
    const adminPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUser = new User({
      username: adminUsername,
      password: hashedPassword,
      name: `Admin ${name}`,
      email: contact_email,
      role: 'subsystem',
      subsystem_id: subsystem._id
    });
    await adminUser.save();

    const defaultSettings = new SubsystemSettings({
      subsystem_id: subsystem._id,
      name: name,
      slogan: 'Votre chance, notre jeu',
      logoUrl: '',
      multipliers: { lot1:60, lot2:20, lot3:10, lotto3:500, lotto4:5000, lotto5:25000, mariage:500 },
      limits: { lotto3:0, lotto4:0, lotto5:0, mariage:0 }
    });
    await defaultSettings.save();

    res.json({
      success: true,
      subsystem,
      admin_credentials: { username: adminUsername, password: adminPassword, email: contact_email },
      access_url: `https://${subdomain}.${req.get('host')}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Récupérer tous les sous-systèmes (avec pagination)
app.get('/api/master/subsystems', auth, authorize('master'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all', search } = req.query;
    const query = {};
    if (status !== 'all') query.is_active = status === 'active';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subdomain: { $regex: search, $options: 'i' } },
        { contact_email: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Subsystem.countDocuments(query);
    const subsystems = await Subsystem.find(query).skip(skip).limit(parseInt(limit)).sort({ created_at: -1 });
    for (let sub of subsystems) {
      const activeUsers = await User.countDocuments({ subsystem_id: sub._id, role: 'agent', is_active: true });
      sub.stats = sub.stats || {};
      sub.stats.active_users = activeUsers;
      sub.stats.usage_percentage = sub.max_users ? Math.round((activeUsers / sub.max_users) * 100) : 0;
    }
    res.json({
      success: true,
      subsystems,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, total_pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Détails d'un sous-système
app.get('/api/master/subsystems/:id', auth, authorize('master'), async (req, res) => {
  try {
    const subsystem = await Subsystem.findById(req.params.id);
    if (!subsystem) return res.status(404).json({ success: false, error: 'Sous-système non trouvé.' });
    const activeUsers = await User.countDocuments({ subsystem_id: subsystem._id, role: 'agent', is_active: true });
    subsystem.stats = subsystem.stats || {};
    subsystem.stats.active_users = activeUsers;
    subsystem.stats.usage_percentage = subsystem.max_users ? Math.round((activeUsers / subsystem.max_users) * 100) : 0;
    res.json({ success: true, subsystem });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Désactiver un sous-système
app.put('/api/master/subsystems/:id/deactivate', auth, authorize('master'), async (req, res) => {
  try {
    const subsystem = await Subsystem.findByIdAndUpdate(req.params.id, { is_active: false }, { new: true });
    if (!subsystem) return res.status(404).json({ success: false, error: 'Non trouvé.' });
    await User.updateMany({ subsystem_id: subsystem._id }, { is_active: false });
    res.json({ success: true, subsystem });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Activer un sous-système
app.put('/api/master/subsystems/:id/activate', auth, authorize('master'), async (req, res) => {
  try {
    const subsystem = await Subsystem.findByIdAndUpdate(req.params.id, { is_active: true }, { new: true });
    if (!subsystem) return res.status(404).json({ success: false, error: 'Non trouvé.' });
    await User.updateMany({ subsystem_id: subsystem._id }, { is_active: true });
    res.json({ success: true, subsystem });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Liste des agents d'un sous-système
app.get('/api/master/subsystems/:id/users', auth, authorize('master'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = { subsystem_id: req.params.id, role: 'agent' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query).skip(skip).limit(parseInt(limit)).sort({ created_at: -1 });
    res.json({
      success: true,
      users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, total_pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Revenu mensuel global (tous sous-systèmes)
app.get('/api/master/revenue/month', auth, authorize('master'), async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const result = await Ticket.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const revenue = result.length > 0 ? result[0].total : 0;
    res.json({ success: true, revenue });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Tendances (statiques pour l'instant)
app.get('/api/master/trends', auth, authorize('master'), async (req, res) => {
  try {
    res.json({
      success: true,
      subsystems: { direction: 'up', percent: 5 },
      users: { direction: 'up', percent: 8 },
      revenue: { direction: 'up', percent: 12 },
      activity: { direction: 'up', percent: 3 }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Quick stats
app.get('/api/master/quick-stats', auth, authorize('master'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayTickets = await Ticket.countDocuments({ date: { $gte: today } });
    const onlineUsers = await User.countDocuments({ role: 'agent', is_online: true });
    const expiringSoon = await Subsystem.countDocuments({
      subscription_expires: { $lte: new Date(Date.now() + 7*24*60*60*1000), $gt: new Date() }
    });
    res.json({
      success: true,
      today_tickets: todayTickets,
      online_users: onlineUsers,
      expiring_soon: expiringSoon,
      system_alerts: 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Revenu quotidien sur N jours
app.get('/api/master/revenue/daily', auth, authorize('master'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const pipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$total' }
      } },
      { $sort: { _id: 1 } }
    ];
    const results = await Ticket.aggregate(pipeline);
    const labels = [];
    const values = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label = d.toISOString().split('T')[0];
      labels.push(label);
      const found = results.find(r => r._id === label);
      values.push(found ? found.total : 0);
    }
    res.json({ success: true, labels, values });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Statistiques détaillées par sous-système (pour l'onglet statistiques du master)
app.get('/api/master/subsystems/stats', auth, authorize('master'), async (req, res) => {
  try {
    const subsystems = await Subsystem.find();
    const result = [];
    for (let sub of subsystems) {
      const activeAgents = await User.countDocuments({ subsystem_id: sub._id, role: 'agent', is_active: true });
      const totalSalesAgg = await Ticket.aggregate([
        { $match: { subsystem_id: sub._id } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      const totalSales = totalSalesAgg.length ? totalSalesAgg[0].total : 0;
      result.push({
        id: sub._id,
        name: sub.name,
        subdomain: sub.subdomain,
        active_agents: activeAgents,
        total_sales: totalSales,
        total_payout: 0,
        profit: totalSales
      });
    }
    res.json({ success: true, subsystems: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Statistiques globales (agents actifs, ventes totales, profit)
app.get('/api/statistics', auth, authorize('master'), async (req, res) => {
  try {
    const activeAgents = await User.countDocuments({ role: 'agent', is_active: true });
    const totalSalesAgg = await Ticket.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]);
    const totalSales = totalSalesAgg.length ? totalSalesAgg[0].total : 0;
    res.json({
      success: true,
      statistics: {
        active_agents: activeAgents,
        total_sales: totalSales,
        total_profit: totalSales
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Profit global quotidien (pour graphique)
app.get('/api/master/global/profit/daily', auth, authorize('master'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const pipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$total' }
      } },
      { $sort: { _id: 1 } }
    ];
    const results = await Ticket.aggregate(pipeline);
    const labels = [];
    const values = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label = d.toISOString().split('T')[0];
      labels.push(label);
      const found = results.find(r => r._id === label);
      values.push(found ? found.total : 0);
    }
    res.json({ success: true, labels, values });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Répartition des jeux (statique)
app.get('/api/games/distribution', auth, authorize('master'), async (req, res) => {
  try {
    const games = ['Borlette', 'Lotto 3', 'Lotto 4', 'Lotto 5', 'Grap', 'Marriage'];
    const sales = [45000, 12000, 8000, 5000, 3000, 2000];
    res.json({ success: true, games, sales });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Rapport consolidé master
app.get('/api/master/consolidated-report', auth, authorize('master'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = new Date(start_date);
    const end = new Date(end_date);
    end.setHours(23,59,59,999);

    const totalTickets = await Ticket.countDocuments({ date: { $gte: start, $lte: end } });
    const totalSalesAgg = await Ticket.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalSales = totalSalesAgg.length ? totalSalesAgg[0].total : 0;

    const subsystems = await Subsystem.find();
    const subsystems_detail = [];
    for (let sub of subsystems) {
      const ticketsCount = await Ticket.countDocuments({ subsystem_id: sub._id, date: { $gte: start, $lte: end } });
      const salesAgg = await Ticket.aggregate([
        { $match: { subsystem_id: sub._id, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      const sales = salesAgg.length ? salesAgg[0].total : 0;
      subsystems_detail.push({
        subsystem_name: sub.name,
        tickets_count: ticketsCount,
        total_sales: sales,
        total_payout: 0,
        profit: sales
      });
    }

    const dailyPipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          ticket_count: { $sum: 1 },
          total_amount: { $sum: '$total' }
      } },
      { $sort: { _id: 1 } }
    ];
    const daily = await Ticket.aggregate(dailyPipeline);

    res.json({
      success: true,
      report: {
        period: { start_date, end_date },
        total_subsystems: subsystems.length,
        summary: {
          total_tickets: totalTickets,
          total_sales: totalSales,
          total_payout: 0,
          total_profit: totalSales
        },
        subsystems_detail,
        daily_breakdown: daily
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// --- SUBSYSTEM ROUTES (propriétaire) ---

// Récupérer les informations du sous-système connecté
app.get('/api/subsystem/mine', auth, authorize('subsystem'), async (req, res) => {
  const subsystem = await Subsystem.findById(req.user.subsystem_id);
  res.json({ success: true, subsystems: [subsystem] });
});

// Récupérer les paramètres du sous-système (nom, logo, slogan, multiplicateurs, limites)
app.get('/api/subsystem/settings', auth, authorize('subsystem'), async (req, res) => {
  try {
    let settings = await SubsystemSettings.findOne({ subsystem_id: req.user.subsystem_id });
    if (!settings) {
      const subsystem = await Subsystem.findById(req.user.subsystem_id);
      settings = new SubsystemSettings({
        subsystem_id: req.user.subsystem_id,
        name: subsystem ? subsystem.name : 'Mon Borlette',
        slogan: 'Votre chance, notre jeu',
        logoUrl: '',
        multipliers: { lot1:60, lot2:20, lot3:10, lotto3:500, lotto4:5000, lotto5:25000, mariage:500 },
        limits: { lotto3:0, lotto4:0, lotto5:0, mariage:0 }
      });
      await settings.save();
    }
    res.json({ success: true, settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Mettre à jour les paramètres du sous-système
app.post('/api/subsystem/settings', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { name, slogan, logoUrl, multipliers, limits } = req.body;
    const update = {
      name, slogan, logoUrl,
      multipliers: multipliers || {},
      limits: limits || {},
      updated_at: new Date()
    };
    const settings = await SubsystemSettings.findOneAndUpdate(
      { subsystem_id: req.user.subsystem_id },
      update,
      { new: true, upsert: true }
    );
    res.json({ success: true, settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Récupérer la liste des agents du sous-système
app.get('/api/subsystem/users', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const users = await User.find({ subsystem_id: req.user.subsystem_id, role: 'agent' }).limit(parseInt(limit)).sort({ created_at: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Créer un agent
app.post('/api/subsystem/users/create', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !password) return res.status(400).json({ success: false, error: 'Champs manquants.' });
    if (!req.user.subsystem_id) return res.status(403).json({ success: false, error: 'Accès interdit.' });

    const subsystem = await Subsystem.findById(req.user.subsystem_id);
    if (!subsystem) return res.status(404).json({ success: false, error: 'Sous-système non trouvé.' });

    const activeCount = await User.countDocuments({ subsystem_id: subsystem._id, role: 'agent', is_active: true });
    if (activeCount >= subsystem.max_users) {
      return res.status(400).json({ success: false, error: `Quota d'agents atteint (maximum: ${subsystem.max_users}).` });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ success: false, error: `Le nom d'utilisateur "${username}" est déjà pris.` });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashedPassword,
      name,
      email: email || '',
      role: 'agent',
      subsystem_id: subsystem._id,
      is_active: true,
      created_at: new Date()
    });
    await newUser.save();

    subsystem.stats.active_users = activeCount + 1;
    await subsystem.save();

    res.json({
      success: true,
      user: { id: newUser._id, username, name, email, created_at: newUser.created_at },
      message: 'Agent créé avec succès'
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà utilisé.' });
    res.status(500).json({ success: false, error: 'Erreur serveur interne.' });
  }
});

// Modifier un agent
app.put('/api/subsystem/users/:id', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { name, email, is_active, password } = req.body;
    const update = { name, email, is_active };
    if (password) update.password = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, subsystem_id: req.user.subsystem_id, role: 'agent' },
      update,
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, error: 'Agent non trouvé.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Modifier statut agent (activer/désactiver)
app.put('/api/subsystem/users/:id/status', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { is_active } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, subsystem_id: req.user.subsystem_id, role: 'agent' },
      { is_active },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, error: 'Agent non trouvé.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Supprimer un agent
app.delete('/api/subsystem/users/:id', auth, authorize('subsystem'), async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, subsystem_id: req.user.subsystem_id, role: 'agent' });
    if (!user) return res.status(404).json({ success: false, error: 'Agent non trouvé.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// --- ROUTES POUR LES TIRAGES (partagés) ---
app.get('/api/subsystem/draws', auth, authorize('subsystem', 'agent'), async (req, res) => {
  try {
    const draws = await Draw.find({ is_active: true }).sort({ key: 1 });
    res.json({ success: true, draws });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Récupérer les résultats d'un tirage pour le sous-système connecté
app.get('/api/subsystem/results', auth, authorize('subsystem', 'agent'), async (req, res) => {
  try {
    const { draw_id, draw_time, date } = req.query;
    const query = { subsystem_id: req.user.subsystem_id };
    if (draw_id) query.draw_id = draw_id;
    if (draw_time) query.draw_time = draw_time;
    if (date) {
      const start = new Date(date);
      start.setHours(0,0,0,0);
      const end = new Date(date);
      end.setHours(23,59,59,999);
      query.date = { $gte: start, $lte: end };
    }
    const results = await Result.find(query).populate('draw_id', 'name key');
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Publier un résultat (sous-système)
app.post('/api/subsystem/publish-results', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { drawId, numbers, lotto3 } = req.body;
    if (!drawId || !numbers || numbers.length !== 3) return res.status(400).json({ success: false, error: 'Données incomplètes.' });
    const draw = await Draw.findById(drawId);
    if (!draw) return res.status(404).json({ success: false, error: 'Tirage non trouvé.' });

    const today = new Date();
    today.setHours(0,0,0,0);
    const time = 'morning';

    const existing = await Result.findOne({
      subsystem_id: req.user.subsystem_id,
      draw_id: drawId,
      draw_time: time,
      date: { $gte: today, $lt: new Date(today.getTime() + 24*60*60*1000) }
    });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Un résultat pour ce tirage aujourd\'hui existe déjà.' });
    }

    const result = new Result({
      subsystem_id: req.user.subsystem_id,
      draw_id: drawId,
      draw_time: time,
      date: today,
      lot1: lotto3,
      lot2: numbers[1],
      lot3: numbers[2],
      verified: false
    });
    await result.save();

    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Récupérer les superviseurs et agents pour les rapports (pour le front-end subsystem)
app.get('/api/subsystem/supervisors', auth, authorize('subsystem'), async (req, res) => {
  res.json([]);
});

app.get('/api/subsystem/agents', auth, authorize('subsystem'), async (req, res) => {
  try {
    const agents = await User.find({ subsystem_id: req.user.subsystem_id, role: 'agent', is_active: true }).select('_id name username email');
    res.json(agents);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// --- ROUTES POUR LES RESTRICTIONS (blocage, limites) ---
app.get('/api/subsystem/blocked-numbers', auth, authorize('subsystem'), async (req, res) => {
  try {
    const restrictions = await Restriction.find({
      subsystem_id: req.user.subsystem_id,
      type: 'block',
      draw_id: null
    });
    const blockedNumbers = restrictions.map(r => r.number);
    res.json({ success: true, blockedNumbers });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/subsystem/block-number', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ success: false, error: 'Numéro requis.' });
    const existing = await Restriction.findOne({ subsystem_id: req.user.subsystem_id, type: 'block', draw_id: null, number });
    if (!existing) {
      await Restriction.create({ subsystem_id: req.user.subsystem_id, number, type: 'block' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/subsystem/unblock-number', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { number } = req.body;
    await Restriction.deleteMany({ subsystem_id: req.user.subsystem_id, type: 'block', draw_id: null, number });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/subsystem/blocked-numbers-per-draw', auth, authorize('subsystem'), async (req, res) => {
  try {
    const restrictions = await Restriction.find({
      subsystem_id: req.user.subsystem_id,
      type: 'block',
      draw_id: { $ne: null }
    }).populate('draw_id', 'name key');
    const result = restrictions.map(r => ({
      draw_id: r.draw_id._id,
      draw_name: r.draw_id.name,
      number: r.number
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/subsystem/block-number-draw', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { drawId, number } = req.body;
    if (!drawId || !number) return res.status(400).json({ success: false, error: 'Données manquantes.' });
    const existing = await Restriction.findOne({ subsystem_id: req.user.subsystem_id, type: 'block', draw_id: drawId, number });
    if (!existing) {
      await Restriction.create({ subsystem_id: req.user.subsystem_id, number, type: 'block', draw_id: drawId });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/subsystem/unblock-number-draw', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { drawId, number } = req.body;
    await Restriction.deleteMany({ subsystem_id: req.user.subsystem_id, type: 'block', draw_id: drawId, number });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/subsystem/number-limits', auth, authorize('subsystem'), async (req, res) => {
  try {
    const restrictions = await Restriction.find({
      subsystem_id: req.user.subsystem_id,
      type: 'limit'
    }).populate('draw_id', 'name key');
    const result = restrictions.map(r => ({
      draw_id: r.draw_id._id,
      draw_name: r.draw_id.name,
      number: r.number,
      limit_amount: r.limitAmount
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/subsystem/number-limit', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { drawId, number, limitAmount } = req.body;
    if (!drawId || !number || limitAmount === undefined) return res.status(400).json({ success: false, error: 'Données manquantes.' });
    await Restriction.findOneAndUpdate(
      { subsystem_id: req.user.subsystem_id, type: 'limit', draw_id: drawId, number },
      { limitAmount },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/subsystem/remove-number-limit', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { drawId, number } = req.body;
    await Restriction.deleteMany({ subsystem_id: req.user.subsystem_id, type: 'limit', draw_id: drawId, number });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/subsystem/blocked-draws', auth, authorize('subsystem'), async (req, res) => {
  try {
    const restrictions = await Restriction.find({
      subsystem_id: req.user.subsystem_id,
      type: 'block',
      draw_id: { $ne: null }
    }).populate('draw_id', 'name key');
    const blockedDraws = restrictions.map(r => ({ drawId: r.draw_id._id, drawName: r.draw_id.name }));
    const unique = {};
    blockedDraws.forEach(b => { unique[b.drawId] = b; });
    res.json(Object.values(unique));
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/subsystem/block-draw', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { drawId, block } = req.body;
    if (!drawId) return res.status(400).json({ success: false, error: 'Tirage manquant.' });
    if (block) {
      await Restriction.create({
        subsystem_id: req.user.subsystem_id,
        number: 'ALL',
        type: 'block',
        draw_id: drawId
      });
    } else {
      await Restriction.deleteMany({ subsystem_id: req.user.subsystem_id, type: 'block', draw_id: drawId });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// --- DASHBOARD POUR SOUS-SYSTÈME ---
app.get('/api/subsystem/dashboard', auth, authorize('subsystem'), async (req, res) => {
  try {
    const subsystemId = req.user.subsystem_id;
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const agents = await User.find({ subsystem_id: subsystemId, role: 'agent' }).select('name is_online');
    const onlineAgents = agents.filter(a => a.is_online);
    const onlineAgentsList = onlineAgents.map(a => ({ name: a.name }));
    const supervisors = [];
    const onlineSupervisors = [];

    const ticketsToday = await Ticket.find({
      subsystem_id: subsystemId,
      date: { $gte: today, $lt: tomorrow }
    });
    const totalBets = ticketsToday.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalTickets = ticketsToday.length;
    const totalWins = 0;
    const netResult = totalBets - totalWins;

    const limitsProgress = [];

    const agentStats = {};
    for (let ticket of ticketsToday) {
      if (!agentStats[ticket.agent_id]) agentStats[ticket.agent_id] = { name: ticket.agent_name, total_bets: 0, total_wins: 0 };
      agentStats[ticket.agent_id].total_bets += ticket.total;
    }
    const agentsGainLoss = Object.values(agentStats).map(a => ({
      name: a.name,
      total_bets: a.total_bets,
      total_wins: 0,
      net_result: a.total_bets
    }));

    res.json({
      success: true,
      connected: {
        supervisors: onlineSupervisors,
        agents: onlineAgentsList,
        supervisors_count: onlineSupervisors.length,
        agents_count: onlineAgents.length
      },
      limits_progress: limitsProgress,
      agents_gain_loss: agentsGainLoss,
      total_bets: totalBets,
      total_tickets: totalTickets,
      total_wins: totalWins,
      net_result: netResult
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// --- RAPPORTS POUR SOUS-SYSTÈME ---
app.get('/api/subsystem/reports', auth, authorize('subsystem'), async (req, res) => {
  try {
    const { period, fromDate, toDate, agentId, drawId, gainLoss } = req.query;
    let start, end;
    if (period === 'today') {
      start = new Date(); start.setHours(0,0,0,0);
      end = new Date(); end.setHours(23,59,59,999);
    } else if (period === 'yesterday') {
      start = new Date(); start.setDate(start.getDate() - 1); start.setHours(0,0,0,0);
      end = new Date(start); end.setDate(start.getDate() + 1); end.setHours(23,59,59,999);
    } else if (period === 'week') {
      start = new Date(); start.setDate(start.getDate() - start.getDay()); start.setHours(0,0,0,0);
      end = new Date(); end.setHours(23,59,59,999);
    } else if (period === 'month') {
      start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
      end = new Date(); end.setHours(23,59,59,999);
    } else if (period === 'custom' && fromDate && toDate) {
      start = new Date(fromDate); start.setHours(0,0,0,0);
      end = new Date(toDate); end.setHours(23,59,59,999);
    } else {
      start = new Date(0);
      end = new Date();
    }

    const query = { subsystem_id: req.user.subsystem_id, date: { $gte: start, $lte: end } };
    if (agentId && agentId !== 'all') query.agent_id = agentId;
    if (drawId && drawId !== 'all') query.draw = drawId; // utilisera le champ draw (string)

    const tickets = await Ticket.find(query);
    const total_tickets = tickets.length;
    const total_bets = tickets.reduce((sum, t) => sum + (t.total || 0), 0);
    const total_wins = 0;
    const net_result = total_bets - total_wins;

    const detailMap = new Map();
    for (let ticket of tickets) {
      const key = ticket.agent_id ? ticket.agent_id.toString() : 'unknown';
      if (!detailMap.has(key)) {
        detailMap.set(key, {
          agent_name: ticket.agent_name,
          tickets: 0,
          bets: 0,
          wins: 0
        });
      }
      const d = detailMap.get(key);
      d.tickets += 1;
      d.bets += ticket.total;
    }
    const detail = Array.from(detailMap.values());

    let filteredDetail = detail;
    if (gainLoss === 'gain') {
      filteredDetail = detail.filter(d => (d.bets - d.wins) > 0);
    } else if (gainLoss === 'loss') {
      filteredDetail = detail.filter(d => (d.bets - d.wins) < 0);
    }

    res.json({
      success: true,
      summary: { total_tickets, total_bets, total_wins, net_result },
      detail: filteredDetail
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// --- TICKETS (agents et sous-systèmes) ---
app.post('/api/tickets', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    const { subsystem_id, agent_id, agent_name, number, draw, draw_time, bets, total } = req.body;
    if (req.user.role === 'agent' && req.user._id.toString() !== agent_id) {
      return res.status(403).json({ success: false, error: 'Accès interdit.' });
    }
    const finalSubsystemId = subsystem_id || req.user.subsystem_id;
    if (!finalSubsystemId) {
      return res.status(400).json({ success: false, error: 'subsystem_id manquant.' });
    }
    const ticket = new Ticket({
      subsystem_id: finalSubsystemId,
      agent_id,
      agent_name,
      number,
      draw,
      draw_time,
      bets,
      total,
      status: 'active',
      syncStatus: 'synced'
    });
    await ticket.save();
    res.json({ success: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/tickets', auth, authorize('agent', 'subsystem', 'master'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'agent') {
      query.agent_id = req.user._id;
    } else if (req.user.role === 'subsystem') {
      query.subsystem_id = req.user.subsystem_id;
    } else if (req.user.role === 'master' && req.query.subsystem_id) {
      query.subsystem_id = req.query.subsystem_id;
    }
    const tickets = await Ticket.find(query).sort({ date: -1 }).limit(parseInt(req.query.limit || 100));
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/tickets/:id', auth, authorize('agent', 'subsystem', 'master'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket non trouvé.' });
    if (req.user.role === 'agent' && ticket.agent_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès interdit.' });
    }
    if (req.user.role === 'subsystem' && ticket.subsystem_id.toString() !== req.user.subsystem_id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès interdit.' });
    }
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.delete('/api/tickets/:id', auth, authorize('subsystem'), async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({ _id: req.params.id, subsystem_id: req.user.subsystem_id });
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket non trouvé.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/tickets/pending', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    let query = { syncStatus: 'pending' };
    if (req.user.role === 'agent') query.agent_id = req.user._id;
    else if (req.user.role === 'subsystem') query.subsystem_id = req.user.subsystem_id;
    const tickets = await Ticket.find(query).sort({ date: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/tickets/pending', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    const { ticket } = req.body;
    if (!ticket) return res.status(400).json({ success: false, error: 'Ticket manquant.' });
    const newTicket = new Ticket({
      ...ticket,
      syncStatus: 'pending',
      is_synced: false
    });
    await newTicket.save();
    res.json({ success: true, ticket: newTicket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/tickets/winning', auth, authorize('agent', 'subsystem'), async (req, res) => {
  res.json({ success: true, tickets: [] });
});

app.get('/api/tickets/multi-draw', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'agent') query.agent_id = req.user._id;
    else if (req.user.role === 'subsystem') query.subsystem_id = req.user.subsystem_id;
    const tickets = await MultiDrawTicket.find(query).sort({ date: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/tickets/multi-draw', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    const ticketData = req.body;
    const newTicket = new MultiDrawTicket({
      ...ticketData,
      subsystem_id: req.user.subsystem_id,
      agent_id: req.user._id,
      agent_name: req.user.name,
      number: ticketData.number || 1,
      date: new Date()
    });
    await newTicket.save();
    res.json({ success: true, ticket: newTicket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Historique
app.get('/api/history', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'agent') query.user_id = req.user._id;
    else if (req.user.role === 'subsystem') {
      const agents = await User.find({ subsystem_id: req.user.subsystem_id, role: 'agent' }).select('_id');
      query.user_id = { $in: agents.map(a => a._id) };
    }
    const history = await History.find(query).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.post('/api/history', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    const { action, details } = req.body;
    const historyEntry = new History({
      user_id: req.user._id,
      username: req.user.username,
      action,
      details,
      timestamp: new Date()
    });
    await historyEntry.save();
    res.json({ success: true, history: historyEntry });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Résultats (pour agent, via l'API)
app.get('/api/results', auth, authorize('subsystem', 'master', 'agent'), async (req, res) => {
  try {
    const { draw, time, date, limit = 10 } = req.query;
    let query = {};
    if (req.user.role === 'subsystem' || req.user.role === 'agent') {
      query.subsystem_id = req.user.subsystem_id;
    }
    if (draw) query.draw_id = draw; // on attend l'ID du tirage
    if (time) query.draw_time = time;
    if (date) {
      const start = new Date(date);
      start.setHours(0,0,0,0);
      const end = new Date(date);
      end.setHours(23,59,59,999);
      query.date = { $gte: start, $lte: end };
    }
    const results = await Result.find(query).sort({ date: -1 }).limit(parseInt(limit)).populate('draw_id', 'name key');
    // Pour compatibilité avec lotato.js, on retourne un objet structuré par draw
    const structured = {};
    for (let r of results) {
      const drawKey = r.draw_id ? r.draw_id.key : 'unknown';
      if (!structured[drawKey]) structured[drawKey] = {};
      structured[drawKey][r.draw_time] = {
        lot1: r.lot1,
        lot2: r.lot2,
        lot3: r.lot3,
        date: r.date
      };
    }
    res.json({ success: true, results: structured });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// Company info (pour agent)
app.get('/api/company-info', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    const settings = await SubsystemSettings.findOne({ subsystem_id: req.user.subsystem_id });
    if (settings) {
      res.json({
        name: settings.name,
        phone: '',
        address: '',
        reportTitle: settings.name,
        reportPhone: '',
        logoUrl: settings.logoUrl
      });
    } else {
      res.json({ name: 'Mon Borlette', phone: '', address: '', reportTitle: 'Mon Borlette', reportPhone: '', logoUrl: '' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

app.get('/api/logo', auth, authorize('agent', 'subsystem'), async (req, res) => {
  try {
    const settings = await SubsystemSettings.findOne({ subsystem_id: req.user.subsystem_id });
    const logoUrl = settings && settings.logoUrl ? settings.logoUrl : '/logo-borlette.jpg';
    res.json({ logoUrl });
  } catch (err) {
    res.json({ logoUrl: '/logo-borlette.jpg' });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// --- MASTER DASHBOARD (routes supplémentaires) ---
app.get('/api/agents', auth, authorize('master'), async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' }).populate('subsystem_id', 'name');
    const result = await Promise.all(agents.map(async agent => {
      const tickets = await Ticket.find({ agent_id: agent._id });
      const total_sales = tickets.reduce((sum, t) => sum + (t.total || 0), 0);
      const total_payout = 0;
      const winning_tickets = 0;
      const total_tickets = tickets.length;
      const last_active = agent.last_login;
      return {
        id: agent._id,
        username: agent.username,
        full_name: agent.name,
        email: agent.email,
        is_online: agent.is_online,
        subsystem_name: agent.subsystem_id ? agent.subsystem_id.name : 'N/A',
        total_sales,
        total_payout,
        winning_tickets,
        total_tickets,
        last_active
      };
    }));
    res.json({ success: true, agents: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// ==================== SERVEUR STATIQUE ET FALLBACK ====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== DÉMARRAGE ====================
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connecté');
    const masterExists = await User.findOne({ role: 'master' });
    if (!masterExists) {
      let masterUsername, masterPassword;
      if (process.env.DEFAULT_MASTER_USERNAME && process.env.DEFAULT_MASTER_PASSWORD) {
        masterUsername = process.env.DEFAULT_MASTER_USERNAME;
        masterPassword = process.env.DEFAULT_MASTER_PASSWORD;
        console.log('Création du master avec les variables d\'environnement');
      } else {
        masterUsername = 'admin';
        masterPassword = 'admin123';
        console.warn('⚠️  ATTENTION: Utilisation des identifiants par défaut pour le master (admin/admin123). Changez-les dès que possible.');
      }
      const hashedPassword = await bcrypt.hash(masterPassword, 10);
      await User.create({
        username: masterUsername,
        password: hashedPassword,
        name: 'Master Admin',
        role: 'master',
        is_active: true
      });
      console.log('✅ Master par défaut créé');
    }

    const defaultDraws = [
      { name: 'Miami (Florida)', key: 'miami', times: { morning: '1:30 PM', evening: '9:50 PM' } },
      { name: 'Georgia', key: 'georgia', times: { morning: '12:30 PM', evening: '7:00 PM' } },
      { name: 'New York', key: 'newyork', times: { morning: '2:30 PM', evening: '8:00 PM' } },
      { name: 'Texas', key: 'texas', times: { morning: '12:00 PM', evening: '6:00 PM' } },
      { name: 'Tunisie', key: 'tunisia', times: { morning: '10:30 AM', evening: '2:00 PM' } }
    ];
    for (const drawData of defaultDraws) {
      const exists = await Draw.findOne({ key: drawData.key });
      if (!exists) {
        await Draw.create(drawData);
        console.log(`✅ Tirage ${drawData.key} créé`);
      }
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Serveur sur le port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err);
    process.exit(1);
  });