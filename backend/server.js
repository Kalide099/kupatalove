require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { syncDB } = require('./src/models');
const { initSocket } = require('./src/sockets/chatSocket');

// Routes
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const discoverRoutes = require('./src/routes/discover');
const likesRoutes = require('./src/routes/likes');
const chatRoutes = require('./src/routes/chat');
const subscriptionRoutes = require('./src/routes/subscription');
const safetyRoutes = require('./src/routes/safety');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Global Middleware ────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Raw body for Stripe webhook (must come BEFORE express.json)
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', apiLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend (if running from same origin)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ─── API Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/safety', safetyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), app: 'KupataLove' });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ─── Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Socket.IO ───────────────────────────────────────────────────
initSocket(io);

// ─── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

syncDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n💖 KupataLove server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🗄️  MySQL connected (XAMPP)`);
    console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
  });
});
