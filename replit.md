# Vision Invest

A full-stack investment platform with gift card deposits, withdrawal management, referral system, and an admin panel.

## Stack
- **Backend**: Node.js + Express (`server.js`)
- **Database**: Replit PostgreSQL (via `pg` pool, `DATABASE_URL` env var)
- **Auth**: `express-session` + `connect-pg-simple` (sessions stored in `session` table)
- **File uploads**: `multer` → `uploads/` directory
- **Frontend**: Static HTML + vanilla JS in `js/`

## How to run
```
node server.js
```
Serves on port **5000**.

## Environment variables
- `DATABASE_URL` — Replit-managed PostgreSQL (auto-provided)
- `SESSION_SECRET` — session signing secret (stored in Replit Secrets)

## Key features
- User registration / login with bcrypt-hashed passwords
- Session-based authentication (7-day cookies)
- **Deposit**: User selects plan + gift card type, uploads image → admin approves
- **Withdrawal**: Min $800, balance reserved on request → admin approve/reject
- **Referral**: $2.50 per successful referral (credited when admin approves referree's first deposit)
- **Welcome bonus**: $50 credited when admin approves user's first deposit
- **Admin panel**: `/admin.html` — manage users, approve deposits/withdrawals, view stats

## Admin credentials
Admin credentials are configured via Replit Secrets before first boot:
- `ADMIN_USERNAME` — defaults to `admin` if not set
- `ADMIN_PASSWORD` — **required** to create the initial admin account

On first startup with no admin in the database, the server reads these secrets and seeds the admin row. On subsequent restarts the seeding step is skipped (existing admin is unchanged).

If `ADMIN_PASSWORD` is not set and no admin exists, the admin panel returns 401 until the secret is added and the server is restarted.

## Plans
| Plan     | Amount  |
|----------|---------|
| Starter  | $150    |
| Silver   | $300    |
| Gold     | $500    |
| Premium  | $1,000  |

## User preferences
- Keep existing HTML/CSS structure
- Do not migrate or replace the Replit PostgreSQL database
