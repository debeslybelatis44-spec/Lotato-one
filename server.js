require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

// ==================== MODÈLES ====================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: String,
  role: { type: String, enum: ["master", "subsystem", "agent"], required: true },
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subsystem" },
  is_active: { type: Boolean, default: true },
  is_online: { type: Boolean, default: false },
  last_login: Date,
  created_at: { type: Date, default: Date.now },
});
userSchema.methods.comparePassword = async function (candidate) {
  return await bcrypt.compare(candidate, this.password);
};

const subsystemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  contact_email: { type: String, required: true },
  contact_phone: String,
  max_users: { type: Number, default: 10 },
  is_active: { type: Boolean, default: true },
  subscription_type: { type: String, default: "basic" },
  subscription_expires: Date,
  created_at: { type: Date, default: Date.now },
  stats: {
    active_users: { type: Number, default: 0 },
    today_sales: { type: Number, default: 0 },
    today_tickets: { type: Number, default: 0 },
    total_sales: { type: Number, default: 0 },
  },
});

const betSchema = new mongoose.Schema(
  {
    type: String,
    name: String,
    number: String,
    amount: Number,
    multiplier: Number,
    isGroup: Boolean,
    details: Array,
    options: Object,
    perOptionAmount: Number,
    isLotto4: Boolean,
    isLotto5: Boolean,
    isAuto: Boolean,
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema({
  subsystem_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subsystem",
    required: true,
  },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  agent_name: String,
  number: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  draw: String,
  draw_time: String,
  bets: [betSchema],
  total: Number,
  status: { type: String, default: "active" },
  syncStatus: { type: String, default: "synced" },
  is_synced: { type: Boolean, default: true },
  synced_at: Date,
});
ticketSchema.index({ subsystem_id: 1, date: -1 });
ticketSchema.index({ agent_id: 1, date: -1 });

const multiDrawTicketSchema = new mongoose.Schema({
  subsystem_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subsystem",
    required: true,
  },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  agent_name: String,
  number: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  bets: [
    {
      gameType: String,
      name: String,
      number: String,
      amount: Number,
      multiplier: Number,
      draws: [String],
    },
  ],
  draws: [String],
  total: Number,
  status: { type: String, default: "active" },
});

const historySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: String,
  action: String,
  details: String,
  timestamp: { type: Date, default: Date.now },
});

const resultSchema = new mongoose.Schema({
  draw: { type: String, required: true },
  time: { type: String, enum: ["morning", "evening"], required: true },
  date: { type: Date, required: true },
  lot1: { type: String, required: true },
  lot2: String,
  lot3: String,
  verified: { type: Boolean, default: false },
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subsystem" },
});
resultSchema.index({ draw: 1, time: 1, date: 1, subsystem_id: 1 }, { unique: true });

const restrictionSchema = new mongoose.Schema({
  subsystem_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subsystem",
    required: true,
  },
  number: { type: String, required: true },
  type: { type: String, enum: ["block", "limit"], required: true },
  limitAmount: Number,
  draw: { type: String, default: "all" },
  time: { type: String, default: "all" },
  created_at: { type: Date, default: Date.now },
});

const companyInfoSchema = new mongoose.Schema({
  subsystem_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subsystem", unique: true },
  name: String,
  phone: String,
  address: String,
  reportTitle: String,
  reportPhone: String,
  logoUrl: String,
});

// Nouveau modèle pour les multiplicateurs (paramètres système)
const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed,
});

const User = mongoose.model("User", userSchema);
const Subsystem = mongoose.model("Subsystem", subsystemSchema);
const Ticket = mongoose.model("Ticket", ticketSchema);
const MultiDrawTicket = mongoose.model("MultiDrawTicket", multiDrawTicketSchema);
const History = mongoose.model("History", historySchema);
const Result = mongoose.model("Result", resultSchema);
const Restriction = mongoose.model("Restriction", restrictionSchema);
const CompanyInfo = mongoose.model("CompanyInfo", companyInfoSchema);
const Setting = mongoose.model("Setting", settingsSchema);

// ==================== MIDDLEWARE AUTH ====================
const auth = async (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    if (!token)
      return res.status(401).json({ error: "Accès refusé. Token manquant." });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.is_active)
      return res.status(401).json({ error: "Utilisateur invalide." });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token invalide." });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: "Accès interdit." });
  next();
};

// ==================== EXPRESS APP ====================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname))); // sert les fichiers statiques

// ==================== ROUTES ====================

// --- AUTH ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, error: "Champs requis." });
    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ success: false, error: "Identifiants incorrects." });
    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, error: "Identifiants incorrects." });
    if (!user.is_active)
      return res.status(403).json({ success: false, error: "Compte désactivé." });

    user.last_login = new Date();
    user.is_online = true;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const userData = {
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      subsystem_id: user.subsystem_id,
    };
    res.json({ success: true, admin: userData, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/auth/check", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success: true, admin: user });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- MASTER ---
app.get("/api/master/subsystems", auth, authorize("master"), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = "all", search } = req.query;
    const query = {};
    if (status !== "all") query.is_active = status === "active";
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subdomain: { $regex: search, $options: "i" } },
        { contact_email: { $regex: search, $options: "i" } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Subsystem.countDocuments(query);
    const subsystems = await Subsystem.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ created_at: -1 });
    for (let sub of subsystems) {
      const activeUsers = await User.countDocuments({
        subsystem_id: sub._id,
        role: "agent",
        is_active: true,
      });
      sub.stats = sub.stats || { active_users: 0, today_sales: 0, today_tickets: 0, total_sales: 0 }; // Correction ici
      sub.stats.active_users = activeUsers;
      sub.stats.usage_percentage = sub.max_users
        ? Math.round((activeUsers / sub.max_users) * 100)
        : 0;
    }
    res.json({
      success: true,
      subsystems,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.post("/api/master/subsystems", auth, authorize("master"), async (req, res) => {
  try {
    const {
      name,
      subdomain,
      contact_email,
      contact_phone,
      max_users = 10,
      subscription_type = "basic",
      subscription_months = 1,
    } = req.body;
    if (!name || !subdomain || !contact_email)
      return res.status(400).json({ success: false, error: "Champs manquants." });
    const existing = await Subsystem.findOne({ subdomain });
    if (existing)
      return res.status(400).json({ success: false, error: "Sous-domaine déjà utilisé." });

    const subscription_expires = new Date();
    subscription_expires.setMonth(subscription_expires.getMonth() + subscription_months);

    const subsystem = new Subsystem({
      name,
      subdomain,
      contact_email,
      contact_phone,
      max_users,
      subscription_type,
      subscription_expires,
      stats: { active_users: 0, today_sales: 0, today_tickets: 0, total_sales: 0 }, // Correction ici
    });
    await subsystem.save();

    // Créer l'admin du sous-système
    const adminUsername = `admin_${subdomain.replace(/[^a-z0-9]/g, "")}`;
    const adminPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUser = new User({
      username: adminUsername,
      password: hashedPassword,
      name: `Admin ${name}`,
      email: contact_email,
      role: "subsystem",
      subsystem_id: subsystem._id,
      is_active: true,
    });
    await adminUser.save();

    res.json({ success: true, subsystem, admin: { username: adminUsername, password: adminPassword } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/subsystems/:id", auth, authorize("master"), async (req, res) => {
  try {
    const subsystem = await Subsystem.findById(req.params.id);
    if (!subsystem)
      return res.status(404).json({ success: false, error: "Sous-système non trouvé." });
    res.json({ success: true, subsystem });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.put("/api/master/subsystems/:id", auth, authorize("master"), async (req, res) => {
  try {
    const {
      name,
      contact_email,
      contact_phone,
      max_users,
      is_active,
      subscription_type,
      subscription_expires,
    } = req.body;
    const subsystem = await Subsystem.findByIdAndUpdate(
      req.params.id,
      {
        name,
        contact_email,
        contact_phone,
        max_users,
        is_active,
        subscription_type,
        subscription_expires,
      },
      { new: true }
    );
    if (!subsystem)
      return res.status(404).json({ success: false, error: "Sous-système non trouvé." });
    res.json({ success: true, subsystem });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.delete("/api/master/subsystems/:id", auth, authorize("master"), async (req, res) => {
  try {
    const subsystem = await Subsystem.findByIdAndDelete(req.params.id);
    if (!subsystem)
      return res.status(404).json({ success: false, error: "Sous-système non trouvé." });
    await User.deleteMany({ subsystem_id: req.params.id }); // Supprimer les utilisateurs associés
    res.json({ success: true, message: "Sous-système supprimé." });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/revenue/month", auth, authorize("master"), async (req, res) => {
  try {
    const monthlyRevenue = [
      { month: "Jan", revenue: 120000 },
      { month: "Feb", revenue: 150000 },
      { month: "Mar", revenue: 130000 },
      { month: "Apr", revenue: 160000 },
      { month: "May", revenue: 140000 },
      { month: "Jun", revenue: 170000 },
    ];
    res.json({ success: true, monthlyRevenue });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/trends", auth, authorize("master"), async (req, res) => {
  try {
    const trends = [
      { label: "Jan", value: 100 },
      { label: "Feb", value: 120 },
      { label: "Mar", value: 90 },
      { label: "Apr", value: 130 },
      { label: "May", value: 110 },
      { label: "Jun", value: 140 },
    ];
    res.json({ success: true, trends });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/quick-stats", auth, authorize("master"), async (req, res) => {
  try {
    const totalSubsystems = await Subsystem.countDocuments();
    const totalActiveUsers = await User.countDocuments({ is_active: true, role: "agent" });
    const totalSalesAgg = await Ticket.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalSales = totalSalesAgg.length ? totalSalesAgg[0].total : 0;

    res.json({
      success: true,
      stats: {
        total_subsystems: totalSubsystems,
        total_active_users: totalActiveUsers,
        total_sales: totalSales,
        total_payout: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/revenue/daily", auth, authorize("master"), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const pipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ];
    const results = await Ticket.aggregate(pipeline);
    const labels = [];
    const values = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label = d.toISOString().split("T")[0];
      labels.push(label);
      const found = results.find((r) => r._id === label);
      values.push(found ? found.total : 0);
    }
    res.json({ success: true, labels, values });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/agents", auth, authorize("master"), async (req, res) => {
  try {
    const agents = await User.find({ role: "agent" }).select("-password");
    res.json({ success: true, agents });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/subsystems/stats", auth, authorize("master"), async (req, res) => {
  try {
    const subsystems = await Subsystem.find();
    const stats = [];
    for (const sub of subsystems) {
      const activeUsers = await User.countDocuments({
        subsystem_id: sub._id,
        role: "agent",
        is_active: true,
      });
      stats.push({
        subsystem_id: sub._id,
        name: sub.name,
        active_users: activeUsers,
        max_users: sub.max_users,
        usage_percentage: sub.max_users
          ? Math.round((activeUsers / sub.max_users) * 100)
          : 0,
      });
    }
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/statistics", auth, authorize("master"), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSubsystems = await Subsystem.countDocuments();
    const totalTickets = await Ticket.countDocuments();
    res.json({
      success: true,
      statistics: { totalUsers, totalSubsystems, totalTickets },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/global/profit/daily", auth, authorize("master"), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const pipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ];
    const results = await Ticket.aggregate(pipeline);
    const labels = [];
    const values = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label = d.toISOString().split("T")[0];
      labels.push(label);
      const found = results.find((r) => r._id === label);
      values.push(found ? found.total : 0);
    }
    res.json({ success: true, labels, values });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/games/distribution", auth, authorize("master"), async (req, res) => {
  try {
    const games = ["Borlette", "Lotto 3", "Lotto 4", "Lotto 5", "Grap", "Marriage"];
    const sales = [45000, 12000, 8000, 5000, 3000, 2000];
    res.json({ success: true, games, sales });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/master/consolidated-report", auth, authorize("master"), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = new Date(start_date);
    const end = new Date(end_date);
    end.setHours(23, 59, 59, 999);

    const totalTickets = await Ticket.countDocuments({ date: { $gte: start, $lte: end } });
    const totalSalesAgg = await Ticket.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalSales = totalSalesAgg.length ? totalSalesAgg[0].total : 0;

    const subsystems = await Subsystem.find();
    const subsystems_detail = [];
    for (let sub of subsystems) {
      const ticketsCount = await Ticket.countDocuments({
        subsystem_id: sub._id,
        date: { $gte: start, $lte: end },
      });
      const salesAgg = await Ticket.aggregate([
        { $match: { subsystem_id: sub._id, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]);
      const sales = salesAgg.length ? salesAgg[0].total : 0;
      subsystems_detail.push({
        subsystem_name: sub.name,
        tickets_count: ticketsCount,
        total_sales: sales,
        total_payout: 0,
        profit: sales,
      });
    }

    const dailyPipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          ticket_count: { $sum: 1 },
          total_amount: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
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
          total_profit: totalSales,
        },
        subsystems_detail,
        daily_breakdown: daily,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- SUBSYSTEM ---
app.get("/api/subsystem/mine", auth, authorize("subsystem"), async (req, res) => {
  const subsystem = await Subsystem.findById(req.user.subsystem_id);
  res.json({ success: true, subsystems: [subsystem] });
});

app.get("/api/subsystem/users", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const users = await User.find({ subsystem_id: req.user.subsystem_id, role: "agent" })
      .limit(parseInt(limit))
      .sort({ created_at: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// ==================== SUBSYSTEM - CRÉATION D'AGENT ====================
app.post("/api/subsystem/users/create", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    console.log("=== Création agent ===");
    console.log("Données reçues:", { name, username, email, password: password ? "***" : undefined });

    // Validation des champs obligatoires
    if (!name || !username || !password) {
      console.log("Champs manquants");
      return res.status(400).json({ success: false, error: "Champs manquants (nom, identifiant, mot de passe)." });
    }

    // Vérifier que l'utilisateur connecté a un subsystem_id
    if (!req.user.subsystem_id) {
      console.error("Utilisateur connecté sans subsystem_id:", req.user._id);
      return res.status(403).json({ success: false, error: "Accès interdit : vous n'êtes pas associé à un sous-système." });
    }

    // Récupérer le sous-système
    const subsystem = await Subsystem.findById(req.user.subsystem_id);
    if (!subsystem) {
      console.error("Sous-système non trouvé pour id:", req.user.subsystem_id);
      return res.status(404).json({ success: false, error: "Sous-système non trouvé." });
    }
    console.log("Sous-système trouvé:", subsystem.name, "| max_users =", subsystem.max_users);

    // Compter les agents actifs
    const activeCount = await User.countDocuments({ subsystem_id: subsystem._id, role: "agent", is_active: true });
    console.log("Agents actifs actuels:", activeCount);

    // Vérifier le quota
    if (activeCount >= subsystem.max_users) {
      console.log("Quota atteint");
      return res.status(400).json({ success: false, error: `Quota d'agents atteint (maximum: ${subsystem.max_users}).` });
    }

    // Vérifier l'unicité du username (global)
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log("Username déjà utilisé:", username);
      return res.status(400).json({ success: false, error: `Le nom d'utilisateur "${username}" est déjà pris.` });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'agent
    const newUser = new User({
      username,
      password: hashedPassword,
      name,
      email: email || "",
      role: "agent",
      subsystem_id: subsystem._id,
      is_active: true,
      created_at: new Date(),
    });
    await newUser.save();
    console.log("Agent créé avec succès, ID:", newUser._id);

    // Mettre à jour les stats du sous-système (optionnel)
    if (!subsystem.stats) subsystem.stats = { active_users: 0, today_sales: 0, today_tickets: 0, total_sales: 0 }; // Correction ici
    subsystem.stats.active_users = activeCount + 1;
    await subsystem.save();

    // Répondre avec les informations (sans mot de passe)
    res.json({
      success: true,
      user: {
        id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        created_at: newUser.created_at,
      },
      message: "Agent créé avec succès",
    });
  } catch (err) {
    console.error("ERREUR dans création agent:", err);
    // Gestion des erreurs MongoDB (duplication, validation)
    if (err.code === 11000) {
      // Erreur de duplication (peut-être sur username ou email si unique)
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ success: false, error: `Le champ ${field} est déjà utilisé.` });
    }
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }
    res.status(500).json({ success: false, error: "Erreur serveur interne." });
  }
});

app.put("/api/subsystem/users/:id", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { name, email, is_active, password } = req.body;
    const update = { name, email, is_active };
    if (password) {
      update.password = await bcrypt.hash(password, 10);
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, subsystem_id: req.user.subsystem_id },
      update,
      { new: true }
    );
    if (!user)
      return res.status(404).json({ success: false, error: "Utilisateur non trouvé." });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.put("/api/subsystem/users/:id/status", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { is_active } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, subsystem_id: req.user.subsystem_id },
      { is_active },
      { new: true }
    );
    if (!user)
      return res.status(404).json({ success: false, error: "Utilisateur non trouvé." });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.delete("/api/subsystem/users/:id", auth, authorize("subsystem"), async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, subsystem_id: req.user.subsystem_id });
    if (!user)
      return res.status(404).json({ success: false, error: "Utilisateur non trouvé." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/subsystem/tickets", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { period = "today", limit = 10, status } = req.query;
    let startDate;
    if (period === "today") {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }
    const query = { subsystem_id: req.user.subsystem_id };
    if (startDate) query.date = { $gte: startDate };
    if (status === "pending") query.syncStatus = "pending";
    const tickets = await Ticket.find(query).sort({ date: -1 }).limit(parseInt(limit));
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/subsystem/stats", auth, authorize("subsystem"), async (req, res) => {
  try {
    const subsystem = await Subsystem.findById(req.user.subsystem_id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTickets = await Ticket.countDocuments({ subsystem_id: subsystem._id, date: { $gte: today } });
    const todaySalesAgg = await Ticket.aggregate([
      { $match: { subsystem_id: subsystem._id, date: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const todaySales = todaySalesAgg[0]?.total || 0;
    const activeUsers = await User.countDocuments({ subsystem_id: subsystem._id, role: "agent", is_active: true });
    const onlineUsers = await User.countDocuments({ subsystem_id: subsystem._id, role: "agent", is_online: true });

    res.json({
      success: true,
      stats: {
        active_users: activeUsers,
        max_users: subsystem.max_users,
        today_tickets: todayTickets,
        today_sales: todaySales,
        online_agents: onlineUsers,
        pending_payout: 0,
        pending_issues: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/subsystem/activities", auth, authorize("subsystem"), async (req, res) => {
  try {
    // Récupérer les activités des agents du sous-système
    const agents = await User.find({ subsystem_id: req.user.subsystem_id, role: "agent" }).select("_id");
    const activities = await History.find({ user_id: { $in: agents.map((a) => a._id) } })
      .sort({ timestamp: -1 })
      .limit(100);
    res.json({ success: true, activities });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- TICKETS (général) ---
app.post("/api/tickets", auth, authorize("agent", "subsystem"), async (req, res) => {
  try {
    const { subsystem_id, agent_id, agent_name, number, draw, draw_time, bets, total } = req.body;
    if (req.user.role === "agent" && req.user._id.toString() !== agent_id) {
      return res.status(403).json({ success: false, error: "Accès interdit." });
    }
    const ticket = new Ticket({
      subsystem_id: subsystem_id || req.user.subsystem_id,
      agent_id,
      agent_name,
      number,
      draw,
      draw_time,
      bets,
      total,
      status: "active",
      syncStatus: "synced",
    });
    await ticket.save();
    res.json({ success: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/tickets", auth, authorize("agent", "subsystem", "master"), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "agent") {
      query.agent_id = req.user._id;
    } else if (req.user.role === "subsystem") {
      query.subsystem_id = req.user.subsystem_id;
    } else if (req.user.role === "master") {
      if (req.query.subsystem_id) query.subsystem_id = req.query.subsystem_id;
    }
    const tickets = await Ticket.find(query).sort({ date: -1 }).limit(parseInt(req.query.limit || 100));
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/tickets/:id", auth, authorize("agent", "subsystem", "master"), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket)
      return res.status(404).json({ success: false, error: "Ticket non trouvé." });
    if (req.user.role === "agent" && ticket.agent_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Accès interdit." });
    }
    if (
      req.user.role === "subsystem" &&
      ticket.subsystem_id.toString() !== req.user.subsystem_id.toString()
    ) {
      return res.status(403).json({ success: false, error: "Accès interdit." });
    }
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.put("/api/tickets/:id/sync", auth, authorize("subsystem"), async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, subsystem_id: req.user.subsystem_id },
      { syncStatus: "synced", is_synced: true, synced_at: new Date() },
      { new: true }
    );
    if (!ticket)
      return res.status(404).json({ success: false, error: "Ticket non trouvé." });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.delete("/api/tickets/:id", auth, authorize("subsystem"), async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({ _id: req.params.id, subsystem_id: req.user.subsystem_id });
    if (!ticket)
      return res.status(404).json({ success: false, error: "Ticket non trouvé." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/tickets/pending", auth, authorize("agent", "subsystem"), async (req, res) => {
  try {
    let query = { syncStatus: "pending" };
    if (req.user.role === "agent") {
      query.agent_id = req.user._id;
    } else if (req.user.role === "subsystem") {
      query.subsystem_id = req.user.subsystem_id;
    }
    const tickets = await Ticket.find(query).sort({ date: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.post("/api/tickets/pending", auth, authorize("agent", "subsystem"), async (req, res) => {
  try {
    const { ticket } = req.body;
    if (!ticket)
      return res.status(400).json({ success: false, error: "Ticket manquant." });
    const newTicket = new Ticket({
      ...ticket,
      syncStatus: "pending",
      is_synced: false,
    });
    await newTicket.save();
    res.json({ success: true, ticket: newTicket });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/tickets/winning", auth, authorize("agent", "subsystem"), async (req, res) => {
  // À implémenter si besoin
  res.json({ success: true, tickets: [] });
});

// --- HISTORIQUE ---
app.get("/api/history", auth, authorize("agent", "subsystem"), async (req, res) => {
  try {
    const query = {};
    if (req.user.role === "agent") {
      query.user_id = req.user._id;
    } else if (req.user.role === "subsystem") {
      const agents = await User.find({ subsystem_id: req.user.subsystem_id, role: "agent" }).select("_id");
      query.user_id = { $in: agents.map((a) => a._id) };
    }
    const history = await History.find(query).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.post("/api/history", auth, authorize("agent", "subsystem"), async (req, res) => {
  try {
    const { action, details } = req.body;
    const historyEntry = new History({
      user_id: req.user._id,
      username: req.user.username,
      action,
      details,
      timestamp: new Date(),
    });
    await historyEntry.save();
    res.json({ success: true, history: historyEntry });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- MULTI-DRAW TICKETS ---
app.get("/api/tickets/multi-draw", auth, authorize("agent", "subsystem"), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "agent") {
      query.agent_id = req.user._id;
    } else if (req.user.role === "subsystem") {
      query.subsystem_id = req.user.subsystem_id;
    }
    const tickets = await MultiDrawTicket.find(query).sort({ date: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.post("/api/tickets/multi-draw", auth, authorize("agent", "subsystem"), async (req, res) => {
  try {
    const ticketData = req.body;
    const newTicket = new MultiDrawTicket({
      ...ticketData,
      subsystem_id: req.user.subsystem_id,
      agent_id: req.user._id,
      agent_name: req.user.name,
      number: ticketData.number || 1,
      date: new Date(),
    });
    await newTicket.save();
    res.json({ success: true, ticket: newTicket });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- CHECK WINNERS ---
app.post("/api/check-winners", auth, authorize("agent", "subsystem"), async (req, res) => {
  res.json({ success: true, message: "Vérification effectuée" });
});

// --- RESULTS ---
app.post("/api/results", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { draw, time, date, lot1, lot2, lot3, verified } = req.body;
    // Vérifier l'unicité (draw+time+date+subsystem)
    const existing = await Result.findOne({
      draw,
      time,
      date: new Date(date),
      subsystem_id: req.user.subsystem_id,
    });
    if (existing) {
      return res.status(400).json({ success: false, error: "Ce résultat existe déjà." });
    }
    const result = new Result({
      draw,
      time,
      date: new Date(date),
      lot1,
      lot2,
      lot3,
      verified,
      subsystem_id: req.user.subsystem_id,
    });
    await result.save();
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/results", auth, authorize("subsystem", "master", "agent"), async (req, res) => {
  try {
    const { draw, time, date, limit = 10 } = req.query;
    let query = {};
    if (req.user.role === "subsystem" || req.user.role === "agent") {
      query.subsystem_id = req.user.subsystem_id;
    }
    if (draw) query.draw = draw;
    if (time) query.time = time;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    const results = await Result.find(query).sort({ date: -1 }).limit(parseInt(limit));
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// *** Route de suppression d'un résultat ***
app.delete("/api/results", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { draw, time, date } = req.query;
    if (!draw || !time || !date) {
      return res.status(400).json({ success: false, error: "Paramètres manquants." });
    }
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const result = await Result.findOneAndDelete({
      draw,
      time,
      date: { $gte: start, $lte: end },
      subsystem_id: req.user.subsystem_id,
    });
    if (!result) {
      return res.status(404).json({ success: false, error: "Résultat non trouvé." });
    }
    res.json({ success: true, message: "Résultat supprimé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// Optionnel : modifier un résultat
app.put("/api/results", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { draw, time, date, lot1, lot2, lot3, verified } = req.body;
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const result = await Result.findOneAndUpdate(
      { draw, time, date: { $gte: start, $lte: end }, subsystem_id: req.user.subsystem_id },
      { lot1, lot2, lot3, verified },
      { new: true }
    );
    if (!result)
      return res.status(404).json({ success: false, error: "Résultat non trouvé." });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- RESTRICTIONS ---
app.post("/api/restrictions", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { number, type, limitAmount, draw, time } = req.body;
    const restriction = new Restriction({
      subsystem_id: req.user.subsystem_id,
      number,
      type,
      limitAmount,
      draw,
      time,
    });
    await restriction.save();
    res.json({ success: true, restriction });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/restrictions", auth, authorize("subsystem"), async (req, res) => {
  try {
    const restrictions = await Restriction.find({ subsystem_id: req.user.subsystem_id });
    res.json({ success: true, restrictions });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.put("/api/restrictions/:id", auth, authorize("subsystem"), async (req, res) => {
  try {
    const restriction = await Restriction.findOneAndUpdate(
      { _id: req.params.id, subsystem_id: req.user.subsystem_id },
      req.body,
      { new: true }
    );
    if (!restriction)
      return res.status(404).json({ success: false, error: "Restriction non trouvée." });
    res.json({ success: true, restriction });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.delete("/api/restrictions/:id", auth, authorize("subsystem"), async (req, res) => {
  try {
    const restriction = await Restriction.findOneAndDelete({ _id: req.params.id, subsystem_id: req.user.subsystem_id });
    if (!restriction)
      return res.status(404).json({ success: false, error: "Restriction non trouvée." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- MULTIPLICATEURS (System Settings) ---
app.post("/api/system/settings/multipliers", auth, authorize("subsystem", "master"), async (req, res) => {
  try {
    const multipliers = req.body; // objet contenant les multiplicateurs
    // Sauvegarder dans la collection Setting
    for (const [key, value] of Object.entries(multipliers)) {
      await Setting.findOneAndUpdate(
        { key: `multiplier_${key}` },
        { value },
        { upsert: true }
      );
    }
    res.json({ success: true, message: "Multiplicateurs sauvegardés" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/system/settings/multipliers", auth, authorize("subsystem", "master", "agent"), async (req, res) => {
  try {
    const settings = await Setting.find({ key: /^multiplier_/ });
    const multipliers = {};
    settings.forEach((s) => {
      const key = s.key.replace("multiplier_", "");
      multipliers[key] = s.value;
    });
    res.json({ success: true, multipliers });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- RAPPORTS ---
app.get("/api/reports/daily", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    const query = {
      subsystem_id: req.user.subsystem_id,
      date: { $gte: targetDate, $lt: nextDay },
    };

    const tickets = await Ticket.find(query);
    const totalTickets = tickets.length;
    const totalSales = tickets.reduce((sum, t) => sum + t.total, 0);

    // Détails par agent
    const agentsMap = {};
    for (const ticket of tickets) {
      if (!agentsMap[ticket.agent_id]) {
        const agent = await User.findById(ticket.agent_id);
        agentsMap[ticket.agent_id] = {
          name: agent ? agent.name : "Inconnu",
          tickets: 0,
          sales: 0,
        };
      }
      agentsMap[ticket.agent_id].tickets += 1;
      agentsMap[ticket.agent_id].sales += ticket.total;
    }
    const agents = Object.values(agentsMap);

    res.json({
      success: true,
      report: {
        date: targetDate.toISOString().split("T")[0],
        totalTickets,
        totalSales,
        agents,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/reports/monthly", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { month } = req.query; // format YYYY-MM
    const [year, monthIndex] = month.split("-").map(Number);
    const start = new Date(year, monthIndex - 1, 1);
    const end = new Date(year, monthIndex, 0, 23, 59, 59);

    const query = {
      subsystem_id: req.user.subsystem_id,
      date: { $gte: start, $lte: end },
    };

    const tickets = await Ticket.find(query);
    const totalTickets = tickets.length;
    const totalSales = tickets.reduce((sum, t) => sum + t.total, 0);

    // Regroupement quotidien
    const dailyMap = {};
    tickets.forEach((t) => {
      const day = t.date.toISOString().split("T")[0];
      if (!dailyMap[day]) {
        dailyMap[day] = { tickets: 0, sales: 0 };
      }
      dailyMap[day].tickets += 1;
      dailyMap[day].sales += t.total;
    });
    const daily = Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        tickets: data.tickets,
        sales: data.sales,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      report: {
        month,
        totalTickets,
        totalSales,
        daily,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

app.get("/api/reports/agent", auth, authorize("subsystem"), async (req, res) => {
  try {
    const { agentId, period } = req.query; // period = today, week, month
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (period === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(0); // Début de l'époque pour 'all' ou période non spécifiée
    }

    const query = {
      subsystem_id: req.user.subsystem_id,
      agent_id: agentId,
      date: { $gte: start, $lte: end },
    };

    const tickets = await Ticket.find(query).sort({ date: -1 });
    const totalTickets = tickets.length;
    const totalSales = tickets.reduce((sum, t) => sum + t.total, 0);
    const agent = await User.findById(agentId);

    res.json({
      success: true,
      report: {
        agent: { name: agent ? agent.name : "Inconnu", username: agent ? agent.username : "" },
        period,
        totalTickets,
        totalSales,
        tickets: tickets.slice(0, 50), // limiter le nombre retourné
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// --- UTILS ---
app.get("/api/health", (req, res) => res.json({ status: "OK" }));
app.get("/api/logo", (req, res) => res.json({ logoUrl: "/logo-borlette.jpg" }));
app.get("/api/company-info", (req, res) => {
  res.json({
    name: "Nova Lotto",
    phone: "+509 32 53 49 58",
    address: "Cap Haïtien",
    reportTitle: "Nova Lotto",
    reportPhone: "40104585",
  });
});

// --- WINNERS / PAY ---
app.put("/api/winners/:id/pay", auth, authorize("subsystem"), async (req, res) => {
    try {
        const ticket = await Ticket.findOneAndUpdate(
            { _id: req.params.id, subsystem_id: req.user.subsystem_id },
            { status: "paid" },
            { new: true }
        );
        if (!ticket) return res.status(404).json({ success: false, error: "Ticket non trouvé." });
        res.json({ success: true, message: "Ticket payé avec succès" });
    } catch (err) {
        console.error("Erreur lors du paiement du ticket:", err);
        res.status(500).json({ success: false, error: "Erreur serveur." });
    }
});

// ==================== SERVEUR STATIQUE ET FALLBACK ====================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ==================== DÉMARRAGE ====================
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB connecté");
    // Créer le master par défaut si inexistant
    const masterExists = await User.findOne({ role: "master" });
    if (!masterExists) {
      let masterUsername, masterPassword;
      if (process.env.DEFAULT_MASTER_USERNAME && process.env.DEFAULT_MASTER_PASSWORD) {
        masterUsername = process.env.DEFAULT_MASTER_USERNAME;
        masterPassword = process.env.DEFAULT_MASTER_PASSWORD;
        console.log("Création du master avec les variables d'environnement");
      } else {
        masterUsername = "admin";
        masterPassword = "admin123";
        console.warn("⚠️  ATTENTION: Utilisation des identifiants par défaut pour le master (admin/admin123). Changez-les dès que possible.");
      }
      const hashedPassword = await bcrypt.hash(masterPassword, 10);
      await User.create({
        username: masterUsername,
        password: hashedPassword,
        name: "Master Admin",
        role: "master",
        is_active: true,
      });
      console.log("✅ Master par défaut créé");
    }
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Serveur sur le port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ Erreur MongoDB:", err);
    process.exit(1);
  });
