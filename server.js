import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';

const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'public')));

dotenv.config();
const app = express();
app.use(express.json());
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Check licence
app.get('/check-licence', async (req, res) => {
  const userId = req.query.userId || 'default';
  const { rows } = await pool.query(
    'SELECT type, days_remaining FROM licences WHERE user_id = $1 ORDER BY activated_at DESC LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
    return res.json({ licence: 'none', days: 0, object: {} });
  }
  const lic = rows[0];
  const days = lic.type === 'unlimited' ? Number.MAX_SAFE_INTEGER : lic.days_remaining;
  res.json({ licence: lic.type, days, object: {} });
});

// Create or update licence
app.post('/licence', async (req, res) => {
  const { userId, type, days } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO licences (user_id, type, days_remaining)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, type, days]
  );
  res.json(rows[0]);
});

// Daily decrement for timed licences at midnight
cron.schedule('0 0 * * *', async () => {
  await pool.query(
    `UPDATE licences
     SET days_remaining = days_remaining - 1,
         updated_at = NOW()
     WHERE type = 'timed' AND days_remaining > 0`
  );
  console.log('Cron: odjęto 1 dzień od licencji timed');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server działa na porcie ${PORT}`));
