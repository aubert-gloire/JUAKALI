import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/routes';
import { inventoryRouter } from './modules/inventory/routes';
import { salesRouter } from './modules/sales/routes';
import { creditsRouter } from './modules/credits/routes';

export const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: config.APP_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Shop-Id'],
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Health check (no auth, no tenant)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: config.NODE_ENV });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/sales', salesRouter);
app.use('/api/credits', creditsRouter);

// 404 for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);
