import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import pool from './db';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/auth', authRoutes);

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
import projectRoutes from './routes/projects';

// Add after auth routes
app.use('/projects', projectRoutes);
import taskRoutes from './routes/tasks';

// Add after projects routes
app.use('/tasks', taskRoutes);