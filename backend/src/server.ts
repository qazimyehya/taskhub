import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pool from './db';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';

dotenv.config();

const app = express();

// Rate limiter for auth endpoints only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // Max 10 requests per 15 mins
  message: {
    error: 'Too many requests',
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/auth', authLimiter, authRoutes); // Rate limited!
app.use('/projects', projectRoutes);
app.use('/tasks', taskRoutes);

// Test routes
app.get('/', (req, res) => {
  res.json({ message: 'TaskHub Backend is running!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM tenants');
    res.json({ 
      message: 'Database connected!',
      tenants_count: result.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});
import userRoutes from './routes/users';

app.use('/users', userRoutes);

