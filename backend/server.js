const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

if (process.env.NODE_ENV === 'test') {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), app: 'KupataLove' });
  });
}

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Global Middleware ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
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

// Serve frontend from the local public directory
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

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
  const fs = require('fs');
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'API route not found or frontend not available.' });
  }
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

function startServer() {
  syncDB()
    .then((dbReady) => {
      server.listen(PORT, () => {
        console.log(`\n💖 KupataLove server running on port ${PORT}`);
        console.log(`📡 Socket.IO ready`);
        if (dbReady) {
          console.log(`🗄️  MySQL connected`);
        } else {
          console.log(`⚠️  Database connection unavailable; API requests will fail until credentials are fixed.`);
        }
      });
    })
    .catch((err) => {
      console.error('❌ Failed to initialize database on startup:', err.message);
      server.listen(PORT, () => {
        console.log(`\n⚠️ KupataLove server running on port ${PORT}, but startup checks did not complete.`);
      });
    });
}

startServer();

module.exports = { app, server, startServer };
