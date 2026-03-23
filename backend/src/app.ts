import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import teamsRoutes from './routes/teams';
import usersRoutes from './routes/users';
import schedulesRoutes from './routes/schedules';
import shiftsRoutes from './routes/shifts';
import homeRequestsRoutes from './routes/homeRequests';
import autoFillRoutes from './routes/autoFill';
import notificationsRoutes from './routes/notifications';
import auditLogsRoutes from './routes/auditLogs';

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/schedules', shiftsRoutes);
app.use('/api/home-requests', homeRequestsRoutes);
app.use('/api/schedules', autoFillRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

export default app;
