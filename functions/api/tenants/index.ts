import { getUserFromToken } from '../_lib/auth'

function isSuperAdmin(request: Request) {
  const user = getUserFromToken(request)
  return !!user?.role.some((role) => role === 'super_admin' || role === 'superadmin')
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function ensureSchema(db: any) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      settings TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run()

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      username TEXT,
      email TEXT,
      first_name TEXT,
      last_name TEXT,
      phone_number TEXT,
      status TEXT,
      role TEXT,
      password_hash TEXT,
      password_updated_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )`
  ).run()

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS tenant_invites (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      created_by TEXT,
      max_uses INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run()

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS pending_approvals (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      invite_code TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run()
}

export async function onRequestGet({ request, env }: { request: Request; env: { DB: any } }) {
  if (!isSuperAdmin(request)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  await ensureSchema(env.DB)

  const sql = `
    SELECT
      t.id,
      t.name,
      t.slug,
      t.created_at,
      t.updated_at,
      COALESCE((
        SELECT COUNT(*) FROM users u
        WHERE u.tenant_id = t.id
      ), 0) AS users_count,
      COALESCE((
        SELECT COUNT(*) FROM tenant_invites i
        WHERE i.tenant_id = t.id AND COALESCE(i.is_active, 1) = 1
      ), 0) AS invites_count,
      COALESCE((
        SELECT COUNT(*) FROM pending_approvals p
        WHERE p.tenant_id = t.id AND p.status = 'pending'
      ), 0) AS pending_approvals_count
    FROM tenants t
    ORDER BY t.created_at DESC, t.name ASC
  `

  const result = await env.DB.prepare(sql).all()
  const data = (result.results || []).map((row: any) => ({
    id: String(row.id || ''),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    usersCount: Number(row.users_count || 0),
    invitesCount: Number(row.invites_count || 0),
    pendingApprovalsCount: Number(row.pending_approvals_count || 0),
  }))

  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  })
}

export async function onRequestPost({ request, env }: { request: Request; env: { DB: any } }) {
  if (!isSuperAdmin(request)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  await ensureSchema(env.DB)

  const body = await request.json().catch(() => ({} as any))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const slug = slugify(rawSlug || name)

  if (!name) {
    return new Response(JSON.stringify({ error: 'name_required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug_required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM tenants WHERE lower(slug) = lower(?) LIMIT 1`
  ).bind(slug).first()

  if (existing) {
    return new Response(JSON.stringify({ error: 'slug_exists' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO tenants (id, name, slug, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, name, slug, '{}', now, now).run()

  return new Response(
    JSON.stringify({
      id,
      name,
      slug,
      createdAt: now,
      updatedAt: now,
      usersCount: 0,
      invitesCount: 0,
      pendingApprovalsCount: 0,
    }),
    {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }
  )
}
