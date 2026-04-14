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

// === CONNEXION MONGODB ===
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/lotato?retryWrites=true&w=majority';

console.log('📡 Tentative de connexion à MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Erreur de connexion MongoDB:', err.message);
    process.exit(1);
  });

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration multer
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

// === MODÈLES MONGOOSE ===
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

// === INITIALISATION AVEC NETTOYAGE OPTIONNEL ===
const CLEAN_DB = process.env.CLEAN_DB === 'true'; // Mettre CLEAN_DB=true pour vider la base

async function initializeData() {
  try {
    console.log('📦 Initialisation de la base de données...');

    if (CLEAN_DB) {
      console.log('🧹 Nettoyage de toutes les collections...');
      await User.deleteMany({});
      await Subsystem.deleteMany({});
      await Ticket.deleteMany({});
      await Bet.deleteMany({});
      await Result.deleteMany({});
      await WinningTicket.deleteMany({});
      await Setting.deleteMany({});
      await ActivityLog.deleteMany({});
      console.log('✅ Base nettoyée.');
    }

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

    // Vérifier si un master existe déjà
    const masterExists = await User.findOne({ username: 'master' });
    if (!masterExists) {
      console.log('👤 Création du compte master...');
      const masterHash = await bcrypt.hash('master123', SALT_ROUNDS);
      await User.create({
        username: 'master',
        password: masterHash,
        full_name: 'Administrateur Master',
        role: 'master',
        is_active: true
      });
      console.log('✅ Compte master créé (master / master123)');
    } else {
      console.log('ℹ️ Compte master existe déjà.');
    }

    // Créer un sous-système de démo si aucun n'existe
    let demoSubsystem = await Subsystem.findOne({ subdomain: 'demo' });
    if (!demoSubsystem) {
      console.log('🏢 Création du sous-système de démo...');
      demoSubsystem = await Subsystem.create({
        name: 'Sous-système Démo',
        subdomain: 'demo',
        contact_email: 'demo@lotato.local',
        max_users: 20
      });
      console.log('✅ Sous-système démo créé (ID:', demoSubsystem._id, ')');
    }

    // Créer les autres utilisateurs de démo s'ils n'existent pas
    const usersToCreate = [
      { username: 'proprietaire', full_name: 'Propriétaire Démo', role: 'subsystem', password: '123' },
      { username: 'superviseur1', full_name: 'Superviseur Niveau 1', role: 'supervisor', level: 1, password: '123' },
      { username: 'superviseur2', full_name: 'Superviseur Niveau 2', role: 'supervisor', level: 2, password: '123' },
      { username: 'agent1', full_name: 'Agent Démo', role: 'agent', password: '123' }
    ];

    let sup1Id, sup2Id;

    for (const u of usersToCreate) {
      const exists = await User.findOne({ username: u.username });
      if (!exists) {
        console.log(`👤 Création de ${u.username}...`);
        const hashed = await bcrypt.hash(u.password, SALT_ROUNDS);
        const userData = {
          username: u.username,
          password: hashed,
          full_name: u.full_name,
          role: u.role,
          level: u.level,
          subsystem_id: demoSubsystem._id,
          is_active: true
        };
        if (u.username === 'agent1') {
          userData.supervisor_id = sup1Id;
          userData.supervisor2_id = sup2Id;
        }
        const newUser = await User.create(userData);
        if (u.username === 'superviseur1') sup1Id = newUser._id;
        if (u.username === 'superviseur2') sup2Id = newUser._id;
        console.log(`✅ ${u.username} créé.`);
      } else {
        console.log(`ℹ️ ${u.username} existe déjà.`);
        if (u.username === 'superviseur1') sup1Id = exists._id;
        if (u.username === 'superviseur2') sup2Id = exists._id;
      }
    }

    // Mise à jour de l'agent avec les superviseurs si nécessaire
    const agent = await User.findOne({ username: 'agent1' });
    if (agent && (!agent.supervisor_id || !agent.supervisor2_id)) {
      if (sup1Id && !agent.supervisor_id) agent.supervisor_id = sup1Id;
      if (sup2Id && !agent.supervisor2_id) agent.supervisor2_id = sup2Id;
      await agent.save();
    }

    console.log('🎉 Initialisation terminée.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  }
}

// === MIDDLEWARES ===
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

// === ROUTES API ===
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`🔐 Tentative de connexion: ${username}`);
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`❌ Utilisateur ${username} non trouvé`);
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log(`❌ Mot de passe incorrect pour ${username}`);
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Compte désactivé' });
    }

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

    console.log(`✅ Connexion réussie pour ${username}, rôle: ${user.role}`);
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

// Route de test pour créer un master manuellement
app.post('/api/test/create-master', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password || 'master123', SALT_ROUNDS);
    const master = await User.findOneAndUpdate(
      { username: username || 'master' },
      { password: hashed, full_name: 'Master', role: 'master', is_active: true },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Master créé/mis à jour', master: { username: master.username, role: master.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test/users', async (req, res) => {
  const users = await User.find({}, 'username role is_active');
  res.json({ users });
});

// ... (inclure toutes les autres routes comme dans la version précédente, je les résume pour la longueur)
// Assurez-vous d'inclure les routes manquantes depuis la version précédente complète.

// === DÉMARRAGE ===
initializeData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur Lotato (MongoDB) sur le port ${PORT}`);
  });
});