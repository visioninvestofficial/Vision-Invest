'use strict';
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ===================== CONFIGURATION =====================

const PORT = 5000;
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const WELCOME_BONUS = 50;
const REFERRAL_BONUS = 2.50;
const PLAN_AMOUNTS = { Starter: 150, Silver: 300, Gold: 500, Premium: 1000 };

// ===================== DATABASE =====================

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function bootstrapSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      balance DECIMAL(12,2) DEFAULT 0.00,
      referral_earnings DECIMAL(12,2) DEFAULT 0.00,
      welcome_bonus_claimed BOOLEAN DEFAULT FALSE,
      active_plan VARCHAR(50) DEFAULT NULL,
      referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS investments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(50) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(50) NOT NULL,
      gift_card_type VARCHAR(100) NOT NULL,
      image_path VARCHAR(500),
      amount DECIMAL(12,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      method VARCHAR(100) NOT NULL,
      account_address VARCHAR(500) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      description TEXT,
      reference_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS referral_credits (
      id          SERIAL PRIMARY KEY,
      referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMP DEFAULT NOW(),
      UNIQUE (referrer_id, referred_id)
    );

    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR NOT NULL PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
  `);
}

async function bootstrapAdmin() {
  const existing = await pool.query('SELECT id FROM admins LIMIT 1');
  if (existing.rows.length > 0) return; // Admin already exists; no action needed

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('WARNING: No admin account exists and ADMIN_PASSWORD is not set.');
    console.error('Set the ADMIN_PASSWORD secret in Replit Secrets and restart to create the admin account.');
    return; // Server continues to run; admin panel will return 401 until credential is set
  }
  const hash = await bcrypt.hash(adminPassword, 12);
  await pool.query(
    'INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [adminUsername, hash]
  );
  console.log(`Admin account created with username: ${adminUsername}`);
}

// ===================== FILE UPLOADS =====================

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = /^\.(jpg|jpeg|png|gif|webp)$/.test(ext) ? ext : '.jpg';
    cb(null, `deposit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ===================== APP =====================

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Block direct uploads access BEFORE static middleware
app.use('/uploads', (req, res) => res.status(403).json({ error: 'Forbidden' }));

// Serve all other static files
app.use(express.static(__dirname, { index: 'index.html' }));

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict' }
}));

// CSRF: reject state-changing requests whose Origin doesn't match the server host
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // same-origin requests (direct curl / server-to-server) have no Origin header
  const host = req.headers.host;
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
  } catch {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  next();
});

// ===================== MIDDLEWARE =====================

const requireUser = async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const result = await pool.query('SELECT status FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0 || result.rows[0].status !== 'active') {
      // Destroy session immediately so suspended users cannot re-use it
      req.session.destroy(() => {});
      return res.status(403).json({ error: 'Account suspended or not found' });
    }
    next();
  } catch (err) {
    next(err);
  }
};
const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// ===================== AUTHENTICATED UPLOAD SERVING =====================

// Admins can see any deposit image; users can only see their own
app.get('/api/uploads/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename); // strip path traversal
  if (!req.session.userId && !req.session.adminId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.session.adminId) {
    // Admin: serve any file
    return res.sendFile(path.join(UPLOADS_DIR, filename));
  }

  // User: verify they own the deposit that references this image
  const result = await pool.query(
    'SELECT id FROM deposits WHERE user_id = $1 AND image_path = $2',
    [req.session.userId, filename]
  );
  if (result.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });
  res.sendFile(path.join(UPLOADS_DIR, filename));
});

// Block direct static access to uploads directory
app.use('/uploads', (req, res) => res.status(403).json({ error: 'Forbidden' }));

// ===================== USER AUTH =====================

app.post('/api/register', async (req, res) => {
  const { full_name, email, username, password, ref } = req.body;
  if (!full_name || !email || !username || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email or username already taken' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    let referredBy = null;
    if (ref) {
      const refUser = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [ref.toLowerCase()]
      );
      if (refUser.rows.length > 0) referredBy = refUser.rows[0].id;
    }

    const result = await client.query(
      `INSERT INTO users (full_name, email, username, password_hash, referred_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [full_name, email.toLowerCase(), username.toLowerCase(), password_hash, referredBy]
    );
    await client.query('COMMIT');
    req.session.userId = result.rows[0].id;
    res.json({ success: true, redirect: '/dashboard.html' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ error: 'Username/email and password are required' });

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1 OR username = $1',
    [identifier.toLowerCase()]
  );
  if (result.rows.length === 0)
    return res.status(401).json({ error: 'Invalid credentials' });

  const user = result.rows[0];
  if (user.status !== 'active')
    return res.status(403).json({ error: 'Your account has been suspended' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;
  res.json({ success: true, redirect: '/dashboard.html' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ===================== USER DATA =====================

app.get('/api/me', requireUser, async (req, res) => {
  const result = await pool.query(
    `SELECT id, full_name, email, username, balance, referral_earnings,
            welcome_bonus_claimed, active_plan, status, created_at
     FROM users WHERE id = $1`,
    [req.session.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

app.get('/api/dashboard', requireUser, async (req, res) => {
  const result = await pool.query(
    `SELECT u.full_name, u.balance, u.referral_earnings, u.welcome_bonus_claimed,
            u.active_plan,
            (SELECT COUNT(*) FROM users WHERE referred_by = u.id) AS referral_count
     FROM users u WHERE u.id = $1`,
    [req.session.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// ===================== DEPOSITS =====================

app.post('/api/deposits', requireUser, upload.single('gift_card_image'), async (req, res) => {
  const { plan, gift_card_type } = req.body;
  if (!plan || !gift_card_type)
    return res.status(400).json({ error: 'Plan and gift card type are required' });
  if (!PLAN_AMOUNTS[plan])
    return res.status(400).json({ error: 'Invalid plan' });
  if (!req.file)
    return res.status(400).json({ error: 'Gift card image is required' });

  const amount = PLAN_AMOUNTS[plan];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dep = await client.query(
      `INSERT INTO deposits (user_id, plan, gift_card_type, image_path, amount)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.session.userId, plan, gift_card_type, req.file.filename, amount]
    );
    const depositId = dep.rows[0].id;
    // Link transaction to this specific deposit via reference_id
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, status, description, reference_id)
       VALUES ($1, 'Deposit', $2, 'pending', $3, $4)`,
      [req.session.userId, amount, `${plan} Plan - ${gift_card_type}`, depositId]
    );
    await client.query('COMMIT');
    res.json({ success: true, deposit_id: depositId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Deposit error:', err);
    res.status(500).json({ error: 'Failed to submit deposit' });
  } finally {
    client.release();
  }
});

app.get('/api/deposits', requireUser, async (req, res) => {
  const result = await pool.query(
    'SELECT id, plan, gift_card_type, amount, status, created_at FROM deposits WHERE user_id = $1 ORDER BY created_at DESC',
    [req.session.userId]
  );
  res.json(result.rows);
});

// ===================== WITHDRAWALS =====================

app.post('/api/withdrawals', requireUser, async (req, res) => {
  const { full_name, email, amount, method, account_address } = req.body;
  if (!full_name || !email || !amount || !method || !account_address)
    return res.status(400).json({ error: 'All fields are required' });

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum < 800)
    return res.status(400).json({ error: 'Minimum withdrawal is $800' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atomically reserve balance — only succeeds if balance >= amount
    const updateResult = await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING id',
      [amountNum, req.session.userId]
    );
    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const w = await client.query(
      `INSERT INTO withdrawals (user_id, full_name, email, amount, method, account_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.session.userId, full_name, email.toLowerCase(), amountNum, method, account_address]
    );
    const withdrawalId = w.rows[0].id;
    // Link transaction to this specific withdrawal via reference_id
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, status, description, reference_id)
       VALUES ($1, 'Withdrawal', $2, 'pending', $3, $4)`,
      [req.session.userId, amountNum, `Via ${method}`, withdrawalId]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Failed to submit withdrawal' });
  } finally {
    client.release();
  }
});

// ===================== TRANSACTIONS =====================

app.get('/api/transactions', requireUser, async (req, res) => {
  const result = await pool.query(
    'SELECT id, type, amount, status, description, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
    [req.session.userId]
  );
  res.json(result.rows);
});

// ===================== REFERRALS =====================

app.get('/api/referral', requireUser, async (req, res) => {
  const result = await pool.query(
    `SELECT u.username, u.referral_earnings,
            (SELECT COUNT(*) FROM users WHERE referred_by = u.id) AS referral_count,
            (SELECT COALESCE(json_agg(json_build_object('username', ru.username, 'created_at', ru.created_at)), '[]'::json)
             FROM users ru WHERE ru.referred_by = u.id) AS referrals
     FROM users u WHERE u.id = $1`,
    [req.session.userId]
  );
  res.json(result.rows[0]);
});

// ===================== ADMIN AUTH =====================

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username.toLowerCase()]);
  if (result.rows.length === 0)
    return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.adminId = result.rows[0].id;
  res.json({ success: true, redirect: '/admin-dashboard.html' });
});

app.post('/api/admin/logout', (req, res) => {
  delete req.session.adminId;
  req.session.save(() => res.json({ success: true }));
});

// ===================== ADMIN DASHBOARD =====================

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [users, deposits, withdrawals, investments] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE status = 'approved'"),
    pool.query("SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'"),
    pool.query("SELECT COUNT(*) FROM investments WHERE status = 'active'")
  ]);
  res.json({
    total_users: parseInt(users.rows[0].count),
    total_deposits: parseFloat(deposits.rows[0].total),
    pending_withdrawals: parseInt(withdrawals.rows[0].count),
    active_investments: parseInt(investments.rows[0].count)
  });
});

// ===================== ADMIN: DEPOSITS =====================

app.get('/api/admin/deposits', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT d.id, d.plan, d.gift_card_type, d.image_path, d.amount, d.status, d.created_at,
            u.username, u.full_name
     FROM deposits d JOIN users u ON d.user_id = u.id
     ORDER BY d.created_at DESC`
  );
  res.json(result.rows);
});

app.post('/api/admin/deposits/:id/approve', requireAdmin, async (req, res) => {
  const depositId = parseInt(req.params.id);
  if (!depositId) return res.status(400).json({ error: 'Invalid ID' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the deposit row
    const dep = await client.query(
      'SELECT * FROM deposits WHERE id = $1 FOR UPDATE',
      [depositId]
    );
    if (dep.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Deposit not found' }); }
    const d = dep.rows[0];
    if (d.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Deposit already processed' }); }

    await client.query('UPDATE deposits SET status = $1 WHERE id = $2', ['approved', depositId]);

    // Credit balance and set active plan
    await client.query(
      'UPDATE users SET balance = balance + $1, active_plan = $2 WHERE id = $3',
      [d.amount, d.plan, d.user_id]
    );

    // Create investment record
    await client.query(
      'INSERT INTO investments (user_id, plan, amount) VALUES ($1, $2, $3)',
      [d.user_id, d.plan, d.amount]
    );

    // Update the linked transaction by reference_id
    await client.query(
      `UPDATE transactions SET status = 'approved' WHERE reference_id = $1 AND type = 'Deposit'`,
      [depositId]
    );

    // Lock the user row to prevent concurrent approval races on bonus fields
    const userResult = await client.query(
      'SELECT welcome_bonus_claimed, referred_by FROM users WHERE id = $1 FOR UPDATE',
      [d.user_id]
    );
    const user = userResult.rows[0];

    // Welcome bonus: safe because user row is locked for this transaction
    if (!user.welcome_bonus_claimed) {
      await client.query(
        'UPDATE users SET balance = balance + $1, welcome_bonus_claimed = TRUE WHERE id = $2',
        [WELCOME_BONUS, d.user_id]
      );
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, status, description)
         VALUES ($1, 'Bonus', $2, 'approved', 'Welcome bonus')`,
        [d.user_id, WELCOME_BONUS]
      );
    }

    // Referral bonus — ON CONFLICT DO NOTHING avoids aborted-txn state from a 23505 error
    if (user.referred_by) {
      // Lock referrer row to prevent concurrent over-credit
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.referred_by]);
      const credit = await client.query(
        `INSERT INTO referral_credits (referrer_id, referred_id)
         VALUES ($1, $2)
         ON CONFLICT (referrer_id, referred_id) DO NOTHING
         RETURNING id`,
        [user.referred_by, d.user_id]
      );
      if (credit.rows.length > 0) {
        // Row was newly inserted — this is the first approval for this referral
        await client.query(
          'UPDATE users SET referral_earnings = referral_earnings + $1, balance = balance + $1 WHERE id = $2',
          [REFERRAL_BONUS, user.referred_by]
        );
        await client.query(
          `INSERT INTO transactions (user_id, type, amount, status, description)
           VALUES ($1, 'Referral', $2, 'approved', $3)`,
          [user.referred_by, REFERRAL_BONUS, `Referral bonus for referred user ${d.user_id}`]
        );
      }
      // If credit.rows.length === 0, referral was already credited — skip silently
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve deposit error:', err);
    res.status(500).json({ error: 'Failed to approve deposit' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/deposits/:id/reject', requireAdmin, async (req, res) => {
  const depositId = parseInt(req.params.id);
  if (!depositId) return res.status(400).json({ error: 'Invalid ID' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dep = await client.query('SELECT * FROM deposits WHERE id = $1 FOR UPDATE', [depositId]);
    if (dep.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (dep.rows[0].status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already processed' }); }

    await client.query('UPDATE deposits SET status = $1 WHERE id = $2', ['rejected', depositId]);
    await client.query(
      `UPDATE transactions SET status = 'rejected' WHERE reference_id = $1 AND type = 'Deposit'`,
      [depositId]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject deposit error:', err);
    res.status(500).json({ error: 'Failed to reject deposit' });
  } finally {
    client.release();
  }
});

// ===================== ADMIN: WITHDRAWALS =====================

app.get('/api/admin/withdrawals', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT w.id, w.amount, w.method, w.account_address, w.status, w.created_at,
            u.username, u.full_name
     FROM withdrawals w JOIN users u ON w.user_id = u.id
     ORDER BY w.created_at DESC`
  );
  res.json(result.rows);
});

app.post('/api/admin/withdrawals/:id/approve', requireAdmin, async (req, res) => {
  const wId = parseInt(req.params.id);
  if (!wId) return res.status(400).json({ error: 'Invalid ID' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [wId]);
    if (w.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (w.rows[0].status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already processed' }); }

    await client.query('UPDATE withdrawals SET status = $1 WHERE id = $2', ['approved', wId]);
    await client.query(
      `UPDATE transactions SET status = 'approved' WHERE reference_id = $1 AND type = 'Withdrawal'`,
      [wId]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve withdrawal error:', err);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/withdrawals/:id/reject', requireAdmin, async (req, res) => {
  const wId = parseInt(req.params.id);
  if (!wId) return res.status(400).json({ error: 'Invalid ID' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [wId]);
    if (w.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (w.rows[0].status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already processed' }); }

    // Refund the reserved balance
    await client.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [w.rows[0].amount, w.rows[0].user_id]
    );
    await client.query('UPDATE withdrawals SET status = $1 WHERE id = $2', ['rejected', wId]);
    await client.query(
      `UPDATE transactions SET status = 'rejected' WHERE reference_id = $1 AND type = 'Withdrawal'`,
      [wId]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject withdrawal error:', err);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  } finally {
    client.release();
  }
});

// ===================== ADMIN: USERS =====================

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const result = await pool.query(
    'SELECT id, full_name, username, email, balance, referral_earnings, active_plan, status, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(result.rows);
});

app.post('/api/admin/users/balance', requireAdmin, async (req, res) => {
  const { username, balance } = req.body;
  if (!username || balance === undefined || balance === '')
    return res.status(400).json({ error: 'Username and balance required' });
  const balanceNum = parseFloat(balance);
  if (isNaN(balanceNum) || balanceNum < 0)
    return res.status(400).json({ error: 'Balance must be a non-negative number' });

  const result = await pool.query(
    'UPDATE users SET balance = $1 WHERE username = $2 RETURNING id',
    [balanceNum, username.toLowerCase()]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

app.post('/api/admin/users/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  const userId = parseInt(req.params.id);
  if (!userId) return res.status(400).json({ error: 'Invalid ID' });
  await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
  res.json({ success: true });
});

// ===================== ADMIN: REFERRALS =====================

app.get('/api/admin/referrals', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.referral_earnings, u.status,
            COUNT(r.id)::int AS referral_count
     FROM users u
     LEFT JOIN users r ON r.referred_by = u.id
     GROUP BY u.id ORDER BY u.created_at DESC`
  );
  res.json(result.rows);
});

app.post('/api/admin/referrals/bonus', requireAdmin, async (req, res) => {
  const { username, bonus } = req.body;
  if (!username || bonus === undefined || bonus === '')
    return res.status(400).json({ error: 'Username and bonus required' });
  const bonusNum = parseFloat(bonus);
  if (isNaN(bonusNum) || bonusNum < 0)
    return res.status(400).json({ error: 'Bonus must be a non-negative number' });

  const result = await pool.query(
    'UPDATE users SET referral_earnings = $1, balance = balance + ($1 - referral_earnings) WHERE username = $2 RETURNING id',
    [bonusNum, username.toLowerCase()]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

// ===================== ADMIN: PLANS =====================

app.get('/api/admin/plans', requireAdmin, async (req, res) => {
  res.json([
    { name: 'Starter', amount: 150, status: 'Active' },
    { name: 'Silver',  amount: 300, status: 'Active' },
    { name: 'Gold',    amount: 500, status: 'Active' },
    { name: 'Premium', amount: 1000, status: 'Active' }
  ]);
});

// ===================== START =====================

async function start() {
  try {
    await bootstrapSchema();
    await bootstrapAdmin();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Vision Invest server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
