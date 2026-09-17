import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Test database connection
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

app.get('/', (req, res) => {
  res.json({ message: 'TaskHub Backend is running!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});