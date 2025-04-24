// server.js
import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ESM: __filename i __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicjalizacja Express
const app = express();

// Health check
app.get('/health', (_req, res) => res.sendStatus(200));

// Serwowanie statycznych plików
app.use(express.static(path.join(__dirname, 'public')));

// Ręczne CORS dla domeny gry Gladiatus\ napp.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://s63-pl.gladiatus.gameforge.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// JSON parser
app.use(express.json());

// Połączenie do bazy PostgreSQL
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Automatyczna migracja tabeli licences
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

// Middleware: wymaga obecności tokenu w nagłówku 'x-token' lub query param 'token'
const requireToken = (req, res, next) => {
  const token = req.headers['x-token'] || req.query.token;
  if (!token) {
    // Brak tokenu — brak dostępu do licencji
    return res.status(403).json({ licence: 'none', days: 0, object: {}, premium: false, active: false, expired: true, features: [] });
  }
  next();
};

// Obsługa GET i PUT /check-licence z wymogiem tokenu
dconst handleCheckLicence = async (req, res) => {
  const userId = req.query.userId || 'default';
  try {
    const { rows } = await pool.query(
      'SELECT type, days_remaining FROM licences WHERE user_id = $1 ORDER BY activated_at DESC LIMIT 1',
      [userId]
    );
    if (rows.length === 0) {
      return res.json({ licence: 'none', days: 0, object: {}, premium: false, active: false, expired: true, features: [] });
    }
    const lic = rows[0];
    const daysRemaining = lic.type === 'unlimited' ? Number.MAX_SAFE_INTEGER : lic.days_remaining;
    const premium = lic.type !== 'none';
    const active = daysRemaining > 0;
    const expired = !active;
    return res.json({ licence: lic.type, days: daysRemaining, object: {}, premium, active, expired, features: [] });
  } catch (err) {
    console.error('ERROR /check-licence:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
app.get('/check-licence', requireToken, handleCheckLicence);
app.put('/check-licence', requireToken, handleCheckLicence);('/check-licence', handleCheckLicence);

// Tworzenie / aktualizacja licencji
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

// Cron dekrementujący days_remaining o 1 dziennie
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

// Uruchomienie serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server działa na porcie ${PORT}`));
