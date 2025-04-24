// server.js
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ESM: policz __dirname
tconst __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Stwórz instancję aplikacji
const app = express();

// 2) Serwuj pliki statyczne z /public
app.use(express.static(path.join(__dirname, 'public')));

// 3) Włącz CORS (dopuszczając domenę gry Gladiatus)
app.use(cors({
  origin: 'https://s63-pl.gladiatus.gameforge.com',
  methods: ['GET','POST','PUT','OPTIONS'],
  credentials: true
}));

// 4) JSON-body parser
app.use(express.json());

// 5) Połączenie do bazy
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Migracja: tworzenie tabeli licences, jeśli brak
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS licences (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        days_remaining INTEGER,
        activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_licences_user_id ON licences (user_id);
    `);
    console.log('✅ Tabela licences jest gotowa');
  } catch (err) {
    console.error('❌ Błąd tworzenia tabeli licences:', err);
    process.exit(1);
  }
})();

// 6) Endpointy:
app.get('/check-licence', async (req, res) => {
  const userId = req.query.userId || 'default';
  try {
    const { rows } = await pool.query(
      'SELECT type, days_remaining FROM licences WHERE user_id = $1 ORDER BY activated_at DESC LIMIT 1',
      [userId]
    );
    if (rows.length === 0) {
      return res.json({ licence: 'none', days: 0, object: {} });
    }
    const lic = rows[0];
    const days = lic.type === 'unlimited' ? Number.MAX_SAFE_INTEGER : lic.days_remaining;
    return res.json({ licence: lic.type, days, object: {} });
  } catch (err) {
    console.error('ERROR /check-licence:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/licence', async (req, res) => {
  const { userId, type, days } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO licences (user_id, type, days_remaining)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, type, days]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('ERROR /licence:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 7) Cron do dekrementacji
cron.schedule('0 0 * * *', async () => {
  try {
    await pool.query(
      `UPDATE licences
       SET days_remaining = days_remaining - 1,
           updated_at = NOW()
       WHERE type = 'timed' AND days_remaining > 0`
    );
    console.log('Cron: odjęto 1 dzień od licencji timed');
  } catch (err) {
    console.error('ERROR cron decrement:', err);
  }
});

// 8) Start serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server działa na porcie ${PORT}`));
