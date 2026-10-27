# StaffSync — Modern Human Resource Management System

> **A smarter way to manage people.**

A full-stack HRMS built on the MERN stack: **MongoDB · Express · React · Node.js**, with JWT authentication, server-enforced role-based access control, and pluggable file storage (local disk / AWS S3).

## Features

| Module | Employee | Manager | Admin / HR |
|---|---|---|---|
| **Auth** | Sign-up (Employee ID, email, password — always the `employee` role), mandatory email verification, sign-in, forgot/reset password, change password | Same | Same; admin accounts are provisioned by an existing admin or the seed |
| **Dashboard** | Quick-access cards + recent-activity notifications | Same, plus a My Team shortcut | Live summary tiles (headcount, present today, pending leaves) |
| **Profile** | View all own details; edit contact fields + profile picture; upload documents (PDF/image, 5 MB) | Read-only profiles of direct reports (salary and documents hidden) | Searchable paginated directory; create employees with an initial password; edit profile, role, manager and active status; delete any account (never their own) with cascade over attendance/leave/notification data |
| **Attendance** | Check-in / check-out (double-click safe), own daily/weekly history | Direct-report attendance view | Master view with date/status filters, corrections, absentee sweep (auto at 23:55 + manual trigger) |
| **Leave** | Request (paid/sick/unpaid) with date range + remarks, monthly calendar, balances, upcoming holidays, cancel pending | Approve/reject direct reports | Approval queue, approve/reject with feedback; manage per-employee entitlements |
| **Payroll** | Strictly read-only salary breakdown (no write route exists) | Own read-only breakdown; no team payroll access | Full read/write of every salary structure |
| **Announcements** | Read published announcements | Read published announcements | Create, publish/hide and delete |
| **Training** | Read published programmes | Read published programmes | Create, hide and delete programmes with optional material link |
| **Holidays** | See upcoming public holidays | See upcoming public holidays | Add and remove public holidays |
| **Reports** | — | Team-scoped attendance and leave reports with CSV export | Org-wide attendance and leave reports with filters and CSV export |
| **Security** | Change password | Change password | Change password |

Leave day counts exclude weekends and configured public holidays. Entitlements default to 20 paid and 10 sick days per year; unpaid leave is never deducted. Balances count approved and pending days separately.

## Architecture

```
client/   React 19 SPA (Vite, Tailwind 4, react-router 7)
          ├─ /app route tree for employees and managers (shared layout)
          ├─ /team manager-only team directory and read-only profiles
          ├─ /admin admin-only route tree + layout
          └─ axios instance with in-memory access token and single-flight refresh
server/   Express 4 REST API - layered: routes → middleware → controllers → services → models
          ├─ JWT access (15 min) + rotating refresh cookie (7 d)
          ├─ rbac('admin') / rbac('admin', 'manager') on every privileged route
          ├─ direct-report team scoping enforced in services, not just the UI
          ├─ field-level whitelists in services (employee vs admin profile edits)
          └─ storage abstraction: disk driver (dev) / S3 driver (STORAGE_DRIVER=s3)
```

Key invariants:
- **Access tokens live only in memory** in the browser; a reload restores the session through the `httpOnly` refresh cookie, never through `localStorage`.
- **Identity comes from the JWT**, never from request params, on all `/me` endpoints.
- **Public sign-up can only create employees.** Roles are changed only by an admin, so sign-up cannot be used to self-promote.
- **Manager scope is limited to direct reports.** Listing, profile, leave decisions, balances and reports all re-check the reporting line server-side.
- **Attendance is the single source of truth** for day states; leave approval bulk-upserts `leave` records.
- **Check-in is an atomic upsert** guarded by a unique `{user, date}` index — concurrent clock-ins cannot double-write.

## Getting started

Requirements: Node.js ≥ 20. **No MongoDB install needed** — with `USE_MEMORY_DB=true` the server runs an embedded MongoDB persisted to `server/.mongo-data`.

```bash
# API (http://localhost:5000)
cd server
cp .env.example .env        # defaults work for local dev
npm install
npm run dev

# Client (http://localhost:5173, proxies /api to :5000)
cd client
npm install
npm run dev
```

On first boot in development the server seeds demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin / HR | `admin@hr-system.local` | `Admin@123` |
| Manager | `manager@hr-system.local` | `Manager@123` |
| Employee | `alice@hr-system.local` | `Alice@123` |
| Employee | `bob@hr-system.local` | `Bob@12345` |

Alice and Bob report to the demo manager. Email verification and password-reset links are printed to the server console when no SMTP host is configured. To send real mail via Gmail: enable 2-Step Verification, create an app password at <https://myaccount.google.com/apppasswords>, and set in `server/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=<16-char app password>
MAIL_FROM="StaffSync <you@gmail.com>"   # must match SMTP_USER — Gmail rewrites the From header
```

The server verifies the SMTP connection at boot and logs the result; if a send fails during sign-up, the registration is rolled back so the email/employee ID stay free for a retry.

## Tests

```bash
cd server && npm test
```

94 integration tests (Jest + Supertest + in-memory MongoDB) covering the auth flow, password reset/change, public-signup role escalation, manager team scoping, admin employee lifecycle, leave entitlements and weekend/holiday-aware day counts, announcements/training/holidays, report filters and CSV exports, an RBAC 403/401 matrix over every privileged endpoint, attendance check-in atomicity, the leave→attendance sync loop, payroll write-denial, account deletion (cascade, self-delete block), and Mongo operator-injection sanitisation.

## Security

- bcrypt (cost 12) password hashing; verification, refresh and password-reset tokens stored hashed
- Rotating refresh tokens in an `httpOnly` cookie scoped to `/api/auth`; reset tokens expire after 30 minutes and revoke all refresh sessions
- Access tokens held in client memory only; automatic single-flight refresh on reload and on a 401
- helmet, CORS origin whitelist, rate limiting on `/api/auth/*`, recursive body sanitisation against `$`/dot operator injection
- Query and search inputs validated with `express-validator`; user-entered search terms are regex-escaped before reaching MongoDB
- CSV exports neutralise spreadsheet formula injection for cells starting with `=`, `+`, `-` or `@`
- Upload hardening: MIME whitelist, 5 MB cap, randomized filenames
- Admins cannot delete their own account or remove their own admin role, so at least one admin always remains
- Central error handler; stack traces suppressed in production

## Deployment notes

- **API**: Render/Railway/EC2. Set `NODE_ENV=production`, real `MONGO_URI` (Atlas), strong `JWT_*` secrets, `CLIENT_ORIGIN`, SMTP credentials, and `STORAGE_DRIVER=s3` + `S3_BUCKET`/`S3_REGION` (credentials via standard AWS env/role).
- **Client**: `npm run build` → deploy `client/dist` to Vercel/Netlify; route `/api/*` and `/uploads/*` to the API origin.
- Future scaling (not needed at current size): Redis cache for dashboard aggregates, BullMQ for email fan-out, MongoDB read replicas.
