console.log('>> PROCESS STARTING');

process.on('uncaughtException', (err) => {
  console.error('CRASH:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import { config } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import paymentRoutes from './routes/payments';
import contactRoutes from './routes/contacts';
import walletRoutes from './routes/wallet';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';

console.log('>> index.ts loaded, building express app...');

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

// ─── Body parsing ──────────────────────────────────────────────────────────────
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging & tracing ─────────────────────────────────────────────────────────
app.use(requestId);
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/health',
}));

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'quicksend-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────────
const API = `/api/${config.apiVersion}`;

console.log(`>> Registering routes under ${API}`);

app.use(`${API}/auth`,      authRoutes);
app.use(`${API}/users`,     userRoutes);
app.use(`${API}/payments`,  paymentRoutes);
app.use(`${API}/contacts`,  contactRoutes);
app.use(`${API}/wallet`,    walletRoutes);
app.use(`${API}/webhooks`,  webhookRoutes);
app.use(`${API}/admin`,     adminRoutes);

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ──────────────────────────────────────────────────────────────
const PORT = config.port;

console.log(`>> Starting server on PORT: ${PORT}`);

app.listen(PORT, () => {
  console.log(`>> SERVER STARTED ON PORT ${PORT}`);
  logger.info(`🚀 QuickSend API running on port ${PORT} [${config.nodeEnv}]`);
  logger.info(`📡 ILP Resource Server: ${config.rafikiResourceServerUrl}`);
  logger.info(`🔑 Auth Server:         ${config.rafikiAuthServerUrl}`);
});

export default app;