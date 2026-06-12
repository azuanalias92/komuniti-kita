# KomunitiKita

Admin Dashboard UI built on Shadcn UI and Vite, configured for Cloudflare Pages with D1 and R2.

![Dashboard](public/images/shadcn-admin.png)

## Features

- Light/dark mode
- Responsive and accessible
- Built-in Sidebar
- Global search command
- 10+ pages
- Extra custom components
- RTL support

## Tech Stack

- UI: ShadcnUI (TailwindCSS + RadixUI)
- Build Tool: Vite
- Router: TanStack Router
- TypeScript
- ESLint & Prettier
- Icons: Lucide & Tabler

## Local Development

```bash
yarn install
yarn dev
```

## Cloudflare Pages Deployment

This project includes Cloudflare Pages Functions and bindings for D1 and R2.

### Configure Bindings

Edit `wrangler.toml`:

- Set `name` to the project slug (already `komuniti-kita`).
- In `[[d1_databases]]`, set `database_id` to your D1 database ID.
- In `[[r2_buckets]]`, set `bucket_name` to your R2 bucket name.

You can also configure bindings in the Cloudflare Pages dashboard under Settings → Environment Variables & Bindings.

### Build and Deploy

```bash
yarn build
yarn cf:deploy
```

`cf:deploy` publishes the built `dist` directory to Cloudflare Pages using the configured project.

### Local Pages Dev (Simulated D1/R2)

```bash
yarn build
yarn cf:dev
```

Runs a local server at `http://localhost:8788/` with simulated D1 and R2.

## API Endpoints

- `GET /api/health` — health check
- `GET /api/d1` — simple D1 reachability

- `GET /api/r2/[key]` — retrieve object from R2
- `PUT /api/r2/[key]` — store object in R2

- `POST /api/auth/sign-in` — email/password sign-in
- `POST /api/auth/sign-up` — email/password sign-up
- `POST /api/auth/change-password` — change password
- `GET /api/auth/google/start` — start Google OAuth (PKCE)
- `GET /api/auth/google/callback` — Google OAuth callback

- `GET /api/profile?email=...` — fetch profile by email
- `PATCH /api/profile` — update profile fields

- `GET /api/users` — list users (filters: `username`, `status`, `role`, pagination)
- `POST /api/users` — create user
- `PUT /api/users/[userId]` — update a user by id
- `PATCH /api/users/[id]/role` — update a user role by id
- `PATCH /api/users/[userId]/role` — update a user role by userId

- `GET /api/roles` — list roles
- `POST /api/roles` — create role (supports `startPage`)
- `GET /api/roles/[id]` — fetch role + permissions
- `PUT /api/roles/[id]` — update role (name, description, startPage)

- `GET /api/acl?role=...` — list ACL for a role
- `POST /api/acl` — replace ACL for a role

- `GET /api/checkpoints` — list checkpoints (name filter, pagination)
- `POST /api/checkpoints` — create checkpoint
- `PUT /api/checkpoints` — update checkpoint
- `DELETE /api/checkpoints?id=...` — delete checkpoint by id

- `GET /api/check-in` — list check-in logs or last check-in per user/checkpoint
- `POST /api/check-in` — perform a geofenced check-in (uses `check_in_settings` and nearest checkpoint)

- `GET /api/settings/check-in` — fetch check-in settings (`radius`, `timeWindow`)
- `POST /api/settings/check-in` — update check-in settings

- `GET /api/homestay-checkins` — list homestay check-ins (pagination or latest per homestay)
- `POST /api/homestay-checkins` — create homestay check-in
- `PUT /api/homestay-checkins/[id]` — update homestay check-in

- `GET /api/residents` — list residents (filters, pagination)
- `POST /api/residents` — create resident
- `PUT /api/residents/[id]` — update resident
- `DELETE /api/residents/[id]` — delete resident

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
