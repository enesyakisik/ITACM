<div align="center">

# 🖥️ ITACM — IT Asset Control Pro

### Self-hosted IT asset management, batteries included.

Hardware inventory · employee asset handovers with printable PDF receipts · software licenses · consumables · repair tracking — all behind a built-in web UI, running fully on your own infrastructure.

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Self-hosted](https://img.shields.io/badge/Self--hosted-100%25-0ea5e9?style=flat-square)](#-quick-start--docker-compose)
[![No build step](https://img.shields.io/badge/Frontend-No%20build%20step-f59e0b?style=flat-square)](#-project-structure)

<br />

**🇬🇧 English** · [🇹🇷 Türkçe →](README.tr.md)

</div>

---

## 📑 Table of contents

- [Why ITACM?](#-why-itacm)
- [Screenshots](#-screenshots)
- [Feature highlights](#-feature-highlights)
- [Tech stack](#-tech-stack)
- [Quick start — Docker Compose](#-quick-start--docker-compose)
- [Deploying to a server](#-deploying-to-a-server)
- [Backup & recovery](#-backup--recovery)
- [Configuration reference](#-configuration-reference)
- [API reference](#-api-reference)
- [Security notes](#-security-notes)
- [Project structure](#-project-structure)
- [Development](#-development)
- [License](#-license)

---

## 💡 Why ITACM?

Most asset trackers are either a spreadsheet that rots or a heavyweight SaaS you can't self-host. ITACM sits in the middle:

- **One command to run.** `docker compose up -d` gives you the database, schema, first admin and a full web UI — no build step, no separate frontend to deploy.
- **Handovers that hold up.** Every asset assignment is an atomic, row-locked transaction that produces a printable **Zimmet Tutanağı** (handover receipt) with your company branding.
- **Everything in one dump.** Assets, employees, receipts, audit history and uploaded documents all live in PostgreSQL, so a single backup captures the whole system.
- **Yours to keep.** No telemetry, no vendor lock-in, MIT licensed.

---

## 📸 Screenshots

<div align="center">

|  |  |
|:--:|:--:|
| **Dashboard** — counts, alerts & recent activity | **Reports & custom report builder** |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Reports](docs/screenshots/reports.png) |

</div>

> More screenshots (hardware inventory, handover basket, printable receipt, employee detail) live in [`docs/screenshots/`](docs/screenshots).

---

## ✨ Feature highlights

<table>
<tr>
<td width="50%" valign="top">

### 🖥 Built-in web UI
Served by the backend itself — no build step. Login, Dashboard, Hardware Inventory (bulk actions, QR codes, global search), Employee Directory, Handover basket, Licenses, Consumables, Maintenance and IT-User management. Just open `http://localhost:8000`.

### 🤝 Atomic handover basket
Assign multiple assets to an employee in one all-or-nothing transaction, producing a printable handover receipt (Zimmet Tutanağı). Row locks make double-assignment impossible.

### 🎨 Customizable handover designs
Live-preview editor to pick which sections, columns, titles and labels appear on the printed/PDF form, plus multiple visual themes (`terminal`, `classic`, `corporate`, `slate`).

### 🛠 Maintenance lifecycle
Send to repair / return / scrap, with the pre-repair assignment state restored automatically. Attach invoices, service reports and photos that stay bound to the device.

### 📄 Software licenses
Seat pools with atomic claim/release, 30-day expiry alerts, and CSV export of who holds each license.

</td>
<td width="50%" valign="top">

### 🔐 Role-based access control
`Owner`, `Admin`, `Helpdesk`, `Viewer` roles enforced on **every** endpoint, re-checked on each request so changes apply instantly.

### 🧾 Full audit trail
Every assign / return / repair / software-zimmet is logged with who, when and why on a per-employee activity timeline; per-user login history.

### ⏳ Product lifecycle (EOL)
Lifecycle duration per category plus per-asset overrides (e.g. MacBooks at 5 years). Every asset shows its EOL date and "EOL soon" / overdue flags.

### 📈 Reports & builder
19 grouped preset reports plus a builder (7 data sources × selectable columns × filters), exported as Excel-friendly CSV or printed with company letterhead.

### 📁 Document archive & 📦 consumables
Upload signed handover scans and repair docs (stored in the DB, covered by backups). Track consumable stock movements with low-stock alerts.

</td>
</tr>
</table>

> 🚀 **First-run onboarding** sets your company name, logo and Owner account; branding flows into the UI and every printed receipt.
> 🧪 **Demo dataset** — `npm run seed:demo` fills Postgres with a realistic company; scale with `SEED_EMPLOYEES=2000 npm run seed:demo -- --reset`.

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js ≥ 20, Express 4 |
| **Database** | PostgreSQL 16 (auto-migrated on startup) |
| **Auth** | JWT (HS256) + bcrypt (cost 12), role-based middleware |
| **Frontend** | Vanilla JS SPA served by the backend — **no build step** |
| **PDF / labels** | PDFKit + QR codes, custom handover templates |
| **Packaging** | Docker + Docker Compose |

---

## 🚀 Quick start — Docker Compose

Everything is automatic: the database container is created, the schema is applied, and the first Admin (Owner) account is seeded.

```bash
git clone https://github.com/<you>/itacm.git
cd itacm

npm install
npm run setup          # generates .env with strong secrets (or copy .env.example)

docker compose up -d
docker compose logs api   # first-run Owner credentials are printed here
```

Then open **http://localhost:8000** — the first visit shows the onboarding wizard to set your company name/logo and create the **Owner** account.

> [!TIP]
> If you leave `ADMIN_PASSWORD` empty, a strong random password is generated and printed **once** in the API logs. Change it after first login.

Prefer to configure by hand? Copy `.env.example` to `.env`, set at least `JWT_SECRET` (`openssl rand -hex 32`), then `docker compose up -d`.

---

## 🌍 Deploying to a server

The compose file works unchanged on any host with Docker. Put a reverse proxy (Caddy / Nginx / Traefik) with TLS in front of port 8000 and set `CORS_ORIGINS` to your frontend's origin if it differs.

For managed platforms (Railway, Render, Fly.io, Cloud Run…), deploy the `Dockerfile`, attach a Postgres add-on, and set the same environment variables (`DATABASE_URL`, `PGSSL=true`, `JWT_SECRET`, `ADMIN_*`). The schema is applied automatically on startup.

---

## 💾 Backup & recovery

Your entire system — assets, employees, handover receipts, audit history and the document archive (scanned/generated PDFs) — lives in PostgreSQL. Back it up regularly.

```bash
npm run backup                 # → backups/itacm-YYYYMMDD-HHMMSS.sql.gz
npm run restore backups/itacm-20260707-120000.sql.gz   # replaces current data (asks to confirm)
```

A single dump captures everything (the document archive is stored inside the database). Copy the `backups/` folder somewhere safe, or schedule the command with cron, e.g. daily at 02:00:

```cron
0 2 * * *  cd /path/to/ITACM && npm run backup
```

### Changing the database password

`POSTGRES_PASSWORD` is fixed when the database volume is first created. **Editing it in `.env` and restarting will not work** — the API will fail to authenticate. To rotate it safely, without losing any data:

```bash
npm run change-db-password
```

> [!WARNING]
> **Never run `docker compose down -v`.** The `-v` flag deletes the database volume and permanently destroys all your data. If the API ever reports `password authentication failed`, run `npm run change-db-password` (or restore the previous password in `.env`) — do not wipe the volume.

---

## ⚙️ Configuration reference

| Variable | Required | Description |
|---|:---:|---|
| `PORT` | – | HTTP port (default `8000`) |
| `CORS_ORIGINS` | – | Comma-separated allowed origins (blank = same-origin) |
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/db` (or `POSTGRES_URL`) |
| `PGSSL` | – | `true` for managed Postgres over TLS |
| `JWT_SECRET` | ✅ | Min 32 chars — `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | – | Token lifetime (default `12h`) |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | – | First-run Owner seed (password auto-generated if empty) |

With docker compose, `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` feed both the database container and the API's `DATABASE_URL`.

---

## 🔌 API reference

All responses are `{ success, data }` or `{ success: false, error, details? }`. All endpoints (except `login` / `health`) require `Authorization: Bearer <TOKEN>`.

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/api/auth/login` | public | Email/password → JWT |
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

<details>
<summary><b>The atomic handover basket — how it works</b></summary>

<br />

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

In **one transaction** (Postgres `BEGIN … FOR UPDATE`): every asset is validated as `In Stock` → the receipt document is created → each asset flips to `Assigned` bound to the employee → the employee's `activeAssetCount` is incremented → one audit row is written per asset.

If **any** asset is locked, the API returns `409` with a per-asset conflict list and **nothing is written**. Row locks / transaction retries make it impossible for two operators to hand over the same laptop concurrently.

</details>

---

## 🔒 Security notes

- **Secrets never live in the repo.** `.env` is git-ignored; the setup wizard writes it with `0600` permissions and generates a strong `JWT_SECRET` and DB password for you.
- **Auth:** passwords are bcrypt-hashed (cost 12); JWTs are signed HS256 with your ≥32-char secret; login uses a single error message for both unknown email and wrong password; every request re-checks the user row so role changes/deletions apply instantly.
- **Hardening:** strict Content-Security-Policy (no inline scripts, self-only), HSTS, nosniff / frame-deny / referrer / permissions-policy headers, login rate-limiting (20 attempts / 15 min / IP), global API rate limit (1000 req / 5 min / IP), same-origin-only CORS by default, 1 MB body limit, `x-powered-by` disabled, one-shot onboarding endpoint that locks itself after first use, `npm audit`-clean dependency tree.
- **Transport:** front the API with HTTPS (Caddy / Nginx / Traefik on a VPS). Set `CORS_ORIGINS` to your exact frontend origin if it differs.

---

## 🗂 Project structure

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

---

## 🧑‍💻 Development

```bash
npm install
npm run setup      # or hand-write .env
npm run dev        # auto-restarting local server
npm run lint       # syntax check
npm run migrate    # apply the Postgres schema manually (optional)
```

---

## 📜 License

Released under the [MIT](LICENSE) license.

<div align="center">
<br />
<sub>Built with ❤️ by <a href="https://github.com/enesyakisik">Enes Yakışık</a> · If ITACM helps you, consider giving it a ⭐</sub>
</div>
