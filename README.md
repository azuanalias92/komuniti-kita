# Komuniti Kita

Community management admin dashboard — manage residents, homestay check-ins, geofenced attendance, roles & permissions, and billing. Built on Shadcn UI + Vite, deployed on Cloudflare Pages with D1 and R2.

## Features

- **Dashboard** — overview of community activity
- **Residents** — resident registry with filters and pagination
- **Homestay Booking** — check-in/out tracking for homestay units
- **Check-in System** — geofenced attendance with configurable radius & time window
- **Checkpoints** — manage geofenced locations
- **Check-in Logs** — audit trail of all check-ins
- **Users & Roles** — role-based access control with granular ACL permissions
- **Billing** — payment tracking and management
- **Directory** — neighbourhood directory listing
- **Settings** — check-in configuration (radius, time window)
- **Auth** — email/password sign-in, Google OAuth (PKCE)
- Light/dark mode, responsive, global search command

## Tech Stack

| Layer | Stack |
|---|---|
| UI | ShadcnUI (TailwindCSS 4 + RadixUI) |
| Build | Vite 7 + SWC |
| Router | TanStack Router |
| State | TanStack Query + Zustand |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Backend | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Auth | Clerk (email/password + Google OAuth) |

## Local Development

```bash
pnpm install
pnpm dev
```

## Cloudflare Pages Deployment

This project includes Cloudflare Pages Functions with D1 and R2 bindings.

### Configure Bindings

Edit `wrangler.toml`:

- Set `name` to the project slug (already `komuniti-kita`).
- In `[[d1_databases]]`, set `database_id` to your D1 database ID.
- In `[[r2_buckets]]`, set `bucket_name` to your R2 bucket name.

You can also configure bindings in the Cloudflare Pages dashboard under Settings → Environment Variables & Bindings.

### Build and Deploy

```bash
pnpm build
pnpm cf:deploy
```

`cf:deploy` publishes the built `dist` directory to Cloudflare Pages using the configured project.

### Local Pages Dev (Simulated D1/R2)

```bash
pnpm build
pnpm cf:dev
```

Runs a local server at `http://localhost:8788/` with simulated D1 and R2.

## API Endpoints

### System

- `GET /api/health` — health check
- `GET /api/d1` — D1 reachability check

### Storage

- `GET /api/r2/[key]` — retrieve object from R2
- `PUT /api/r2/[key]` — store object in R2

### Auth

- `POST /api/auth/sign-in` — email/password sign-in
- `POST /api/auth/sign-up` — email/password sign-up
- `POST /api/auth/change-password` — change password
- `GET /api/auth/google/start` — start Google OAuth (PKCE)
- `GET /api/auth/google/callback` — Google OAuth callback

### Profile

- `GET /api/profile?email=...` — fetch profile by email
- `PATCH /api/profile` — update profile fields

### Users

- `GET /api/users` — list users (filters: username, status, role, pagination)
- `POST /api/users` — create user
- `PUT /api/users/[userId]` — update a user by id
- `PATCH /api/users/[id]/role` — update a user role
- `PATCH /api/users/[userId]/role` — update a user role by userId

### Roles & ACL

- `GET /api/roles` — list roles
- `POST /api/roles` — create role (supports startPage)
- `GET /api/roles/[id]` — fetch role + permissions
- `PUT /api/roles/[id]` — update role (name, description, startPage)
- `GET /api/acl?role=...` — list ACL for a role
- `POST /api/acl` — replace ACL for a role

### Checkpoints

- `GET /api/checkpoints` — list checkpoints (name filter, pagination)
- `POST /api/checkpoints` — create checkpoint
- `PUT /api/checkpoints` — update checkpoint
- `DELETE /api/checkpoints?id=...` — delete checkpoint by id

### Check-in

- `GET /api/check-in` — list check-in logs or last check-in per user/checkpoint
- `POST /api/check-in` — perform a geofenced check-in

### Check-in Settings

- `GET /api/settings/check-in` — fetch check-in settings (radius, timeWindow)
- `POST /api/settings/check-in` — update check-in settings

### Homestay Check-ins

- `GET /api/homestay-checkins` — list homestay check-ins (pagination or latest per homestay)
- `POST /api/homestay-checkins` — create homestay check-in
- `PUT /api/homestay-checkins/[id]` — update homestay check-in

### Residents

- `GET /api/residents` — list residents (filters, pagination)
- `POST /api/residents` — create resident
- `PUT /api/residents/[id]` — update resident
- `DELETE /api/residents/[id]` — delete resident

### Billing

- Billing management endpoints with payment tracking

### R2 Example

```bash
curl -X PUT -H "content-type: text/plain" --data-binary "hello" \
  https://<your-pages-domain>/api/r2/test.txt

curl https://<your-pages-domain>/api/r2/test.txt
```

### Environment Variables

- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- D1/R2 bindings — configure via `wrangler.toml` or Pages project Settings

## License

MIT
