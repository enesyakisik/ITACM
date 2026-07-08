# ITACM — IT Asset Control Pro

> Self-hosted IT asset management: hardware inventory, employee asset handovers
> (with printable PDF receipts), software licenses, consumables and repair
> tracking — with a built-in web UI. Runs fully self-hosted on **PostgreSQL via
> Docker Compose**.

**[🇹🇷 Türkçe dokümantasyon için buraya tıklayın → README.tr.md](README.tr.md)**

---

## Screenshots

| Dashboard | Hardware Inventory |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Hardware Inventory](docs/screenshots/hardware.png) |

| Handover Operations | Printable Handover Form (Zimmet Tutanağı) |
|---|---|
| ![Handover](docs/screenshots/handover.png) | ![Print preview](docs/screenshots/print-preview.png) |

| Employee Detail (assets, software, history) | Reports & Custom Report Builder |
|---|---|
| ![Employee detail](docs/screenshots/employee-detail.png) | ![Reports](docs/screenshots/reports.png) |

---

## Features

- 🖥 **Built-in web UI** — served by the backend itself (no build step): Login, Dashboard, Hardware Inventory (bulk actions, QR codes, global search), Employee Directory with per-employee device history, Handover basket with **printable receipt**, software (license) assignment, Licenses, Consumables, Maintenance and IT User management with login auditing. Open `http://localhost:8000` after starting.
- 🚀 **First-run onboarding** — set company name, logo and the Admin account on first launch; branding is applied across the UI and the printed handover forms (change later via Settings).
- 🧪 **Demo dataset** — `npm run seed:demo` fills a postgres instance with a realistic company for evaluation; scale it with `SEED_EMPLOYEES=2000 npm run seed:demo -- --reset` (assets, licenses, repairs all scale proportionally).
- 🔐 **Role-based access control** — `Owner`, `Admin`, `Helpdesk`, `Viewer` roles enforced on every endpoint
- 💻 **Hardware inventory** — asset tags (unique, QR-encoded), serials, MAC addresses, specs, plus accessory categories (keyboard, mouse, headset, docking station, webcam) that can be assigned to people
- 🤝 **Atomic handover basket** — assign multiple assets to an employee in one all-or-nothing transaction, producing a printable handover receipt (Zimmet Tutanağı)
- 🎨 **Customizable handover template** — a live-preview editor (Settings → Customize Zimmet Template) to choose which sections, columns, titles and labels appear on the printed/PDF form
- 🛠 **Maintenance lifecycle** — send to repair / return / scrap, with the pre-repair assignment state restored automatically; attach repair paperwork (invoices, service reports, photos) that stays accessible from the device
- 📄 **Software licenses** — seat pools with atomic claim/release, 30-day expiry alerts, and CSV export of who holds each license
- 📦 **Consumables** — stock movements with low-stock alerts
- 📊 **Dashboard aggregates** — asset counts by status, alerts, recent handover activity
- 🧾 **Full audit trail** — every assign/return/repair/software-zimmet is logged with who/when/why on a per-employee activity timeline; per-user login history
- ⏳ **Product lifecycle management** — a lifecycle duration (months) per category, plus an optional per-asset override (e.g. MacBooks at 5 years); every asset shows its EOL date and "EOL soon"/overdue flags
- 📈 **Reports & Custom Report Builder** — 19 grouped preset reports plus a builder (7 data sources × selectable columns × filters), exported as Excel-friendly CSV or printed with company letterhead
- 🗂 **Product catalog** — centrally managed brand/model & spec lists per category feed the asset form dropdowns; asset tags are system-assigned and sequential
- 📁 **Document archive** — upload signed handover scans per employee and repair documents per device (stored securely in the database, covered by backups)

## Quick start — Docker Compose

Everything is automatic: the database container is created, the schema is
applied, and the first Admin (Owner) account is seeded.

```bash
git clone https://github.com/<you>/itacm.git
cd itacm

npm install
npm run setup          # generates .env with strong secrets (or copy .env.example)

docker compose up -d
docker compose logs api   # first-run Owner credentials are printed here
```

Then open **http://localhost:8000** — the first visit shows the onboarding
wizard to set your company name/logo and create the **Owner** account.

> If you leave `ADMIN_PASSWORD` empty, a strong random password is generated and
> printed **once** in the API logs. Change it after first login.

Prefer to configure by hand? Copy `.env.example` to `.env`, set at least
`JWT_SECRET` (`openssl rand -hex 32`), then `docker compose up -d`.

---

## Deploying to a server

The compose file works unchanged on any host with Docker. Put a reverse proxy
(Caddy/Nginx/Traefik) with TLS in front of port 8000 and set `CORS_ORIGINS` to
your frontend's origin if it differs.

For managed platforms (Railway, Render, Fly.io, Cloud Run…), deploy the
`Dockerfile`, attach a Postgres add-on, and set the same environment variables
(`DATABASE_URL`, `PGSSL=true`, `JWT_SECRET`, `ADMIN_*`). The schema is applied
automatically on startup.

---

## Backup & Recovery

Your entire system — assets, employees, handover receipts, audit history and the
document archive (scanned/generated PDFs) — lives in PostgreSQL. Back it up
regularly.

```bash
npm run backup                 # → backups/itacm-YYYYMMDD-HHMMSS.sql.gz
npm run restore backups/itacm-20260707-120000.sql.gz   # replaces current data (asks to confirm)
```

A single dump captures everything (the document archive is stored inside the
database). Copy the `backups/` folder somewhere safe, or schedule the command
with cron, e.g. daily at 02:00:

```cron
0 2 * * *  cd /path/to/ITACM && npm run backup
```

### Changing the database password

`POSTGRES_PASSWORD` is fixed when the database volume is first created. **Editing
it in `.env` and restarting will not work** — the API will fail to authenticate.
To rotate it safely, without losing any data:

```bash
npm run change-db-password
```

> ⚠ **Never run `docker compose down -v`.** The `-v` flag deletes the database
> volume and permanently destroys all your data. If the API ever reports
> `password authentication failed`, run `npm run change-db-password` (or restore
> the previous password in `.env`) — do not wipe the volume.

---

## Configuration reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | – | HTTP port (default `8000`) |
| `CORS_ORIGINS` | – | Comma-separated allowed origins (blank = same-origin) |
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/db` (or `POSTGRES_URL`) |
| `PGSSL` | – | `true` for managed Postgres over TLS |
| `JWT_SECRET` | ✅ | Min 32 chars — `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | – | Token lifetime (default `12h`) |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | – | First-run Owner seed (password auto-generated if empty) |

With docker compose, `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` feed
both the database container and the API's `DATABASE_URL`.

## API reference

All responses are `{ success, data }` or `{ success: false, error, details? }`.
All endpoints (except `login`/`health`) require `Authorization: Bearer <TOKEN>`.

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/api/auth/login` | public | Email/password → JWT *(postgres mode)* |
| POST | `/api/auth/verify-token` | any | Validate token, return profile + permissions |
| GET/POST | `/api/auth/users` | Admin | List / create IT users |
| PUT | `/api/auth/users/:uid/role` | Admin | Change a user's role |
| GET | `/api/dashboard/stats` | all | Counts, low-stock & license alerts, recent activity |
| GET | `/api/assets` | all | Inventory list — `?status=&category=&search=` |
| GET | `/api/assets/:id` | all | Asset detail + audit history |
| POST / PUT | `/api/assets`, `/api/assets/:id` | Admin, Helpdesk | Create / update hardware |
| POST | `/api/assets/:id/return` | Admin, Helpdesk | Return an assigned asset to stock |
| POST | `/api/handovers` | Admin, Helpdesk | **Atomic handover basket** (below) |
| GET | `/api/handovers`, `/:id` | all | Receipts (feeds the printable form) |
| GET/POST | `/api/maintenance` | Admin, Helpdesk | Repair logs / send to repair |
| PUT | `/api/maintenance/:id/close` | Admin, Helpdesk | Close repair (`{scrap:true}` to scrap) |
| GET | `/api/employees` | all | Directory + handover employee selector |
| POST / PUT | `/api/employees` | Admin, Helpdesk | Create / update (deactivation blocked while assets held) |
| GET | `/api/licenses`, `/api/consumables` | all | Lists with alert flags |
| POST | `/api/licenses`, `/:id/seats` | Admin, Helpdesk | Create / atomic seat claim-release |
| POST | `/api/consumables`, `/:id/stock` | Admin, Helpdesk | Create / atomic stock movement |

### The atomic handover basket

```http
POST /api/handovers
{
  "employeeId": "…",
  "documentType": "single",
  "items": [
    { "assetId": "…", "conditionNote": "New, sealed box" },
    { "assetId": "…", "conditionNote": "Used, good condition" }
  ]
}
```

In **one transaction** (Firestore `runTransaction` / Postgres `BEGIN … FOR UPDATE`):
every asset is validated as `In Stock` → the receipt document is created →
each asset flips to `Assigned` bound to the employee → the employee's
`activeAssetCount` is incremented → one audit row is written per asset.
If **any** asset is locked, the API returns `409` with a per-asset conflict
list and **nothing is written**. Row locks / transaction retries make it
impossible for two operators to hand over the same laptop concurrently.

## Security notes

- **Secrets never live in the repo.** `.env` is git-ignored; the setup wizard
  writes it with `0600` permissions and generates a strong `JWT_SECRET` and DB
  password for you.
- **Auth:** passwords are bcrypt-hashed (cost 12); JWTs are signed HS256 with
  your ≥32-char secret; login uses a single error message for both unknown
  email and wrong password; every request re-checks the user row so role
  changes/deletions apply instantly.
- **Hardening:** strict Content-Security-Policy (no inline scripts, self-only), HSTS, nosniff/frame-deny/referrer/
  permissions-policy headers, login rate-limiting (20 attempts / 15 min / IP), global API rate limit
  (1000 req / 5 min / IP), same-origin-only CORS by default, 1MB body limit, `x-powered-by` disabled,
  one-shot onboarding endpoint that locks itself after first use, `npm audit`-clean dependency tree.
- **Transport:** front the API with HTTPS (Caddy/Nginx/Traefik on a VPS). Set
  `CORS_ORIGINS` to your exact frontend origin if it differs.

## Project structure

```
├── server.js                  Node/Docker entry (auto-migrates on startup)
├── public/                    Built-in web UI (vanilla JS SPA, no build step)
├── src/
│   ├── app.js                 Express app + route mounting
│   ├── config/                Env parsing
│   ├── middleware/            Bearer auth + role gate, error handling
│   ├── routes/                Thin controllers
│   ├── utils/                 PDF generation, defaults, permissions
│   └── providers/postgres/    JWT auth + PostgreSQL (schema.sql, auto-migrate, services)
├── scripts/setup.js           .env generator (npm run setup)
├── scripts/seed-demo.js       500-employee demo dataset (npm run seed:demo)
├── docker-compose.yml         Self-hosted stack (API + Postgres)
├── Dockerfile
└── .env.example               Fully documented configuration template
```

## Development

```bash
npm install
npm run setup      # or hand-write .env
npm run dev        # auto-restarting local server
npm run lint       # syntax check
npm run migrate    # apply the Postgres schema manually (optional)
```

## License

[MIT](LICENSE)
