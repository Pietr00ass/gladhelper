// server.js
import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ESM: policz __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Stwórz instancję aplikacji
const app = express();

// 2) Serwuj pliki statyczne z /public
app.use(express.static(path.join(__dirname, 'public')));

// 3) JSON-body parser
app.use(express.json());

// 4) Połączenie do bazy
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// 5) Endpointy:
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

// 6) Cron do dekrementacji
cron.schedule('0 0 * * *', async () => {
  await pool.query(
    `UPDATE licences
     SET days_remaining = days_remaining - 1,
         updated_at = NOW()
     WHERE type = 'timed' AND days_remaining > 0`
  );
  console.log('Cron: odjęto 1 dzień od licencji timed');
});

// 7) Start serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server działa na porcie ${PORT}`));
