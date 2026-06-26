import { generateToken } from '../_lib/auth'
import { verifyPassword } from '../_lib/password'

async function ensureSchema(env: { DB: any }) {
  await env.DB.prepare(
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
      updated_at TEXT,
      UNIQUE(tenant_id, email)
    )`
  ).run()
}

export async function onRequestPost({
  request,
  env,
}: {
  request: Request
  env: { DB: any; JWT_SECRET?: string }
}) {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  await ensureSchema(env)

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'invalid_credentials' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const userRow = await env.DB.prepare(
    `SELECT id, tenant_id, username, email, first_name, last_name, status, role, password_hash
     FROM users
     WHERE lower(email) = lower(?)
     LIMIT 1`
  ).bind(email).first() as Record<string, unknown> | null

  if (!userRow || String(userRow.status || 'active') !== 'active') {
    return new Response(JSON.stringify({ error: 'invalid_credentials' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const isValidPassword = await verifyPassword(password, String(userRow.password_hash || ''))
  if (!isValidPassword) {
    return new Response(JSON.stringify({ error: 'invalid_credentials' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const tenantId = String(userRow.tenant_id || 'default')
  const tenant = await env.DB.prepare(
    `SELECT name, slug FROM tenants WHERE id = ?`
  ).bind(tenantId).first() as { name: string; slug: string } | null

  const emailValue = String(userRow.email || email)
  const jwtSecret = env.JWT_SECRET || 'demo-jwt-secret-komuniti-kita-2026'
  const role = String(userRow.role || 'user')
  const accessToken = await generateToken(
    {
      sub: String(userRow.id || ''),
      email: emailValue,
      role: [role],
      tenantId,
      tenantName: tenant?.name || 'Community',
    },
    jwtSecret
  )

  const user = {
    accountNo: String(userRow.id || ''),
    email: emailValue,
    role: [role],
    tenantId,
    tenantName: tenant?.name || 'Community',
    tenantSlug: tenant?.slug || '',
    exp: Date.now() + 24 * 60 * 60 * 1000,
    name:
      String(userRow.first_name || '').trim() ||
      String(userRow.username || '').trim() ||
      emailValue.split('@')[0],
  }

  const headers = new Headers({ 'content-type': 'application/json' })
  headers.append(
    'Set-Cookie',
    `access_token=${encodeURIComponent(JSON.stringify(accessToken))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`
  )
  headers.append(
    'Set-Cookie',
    `auth_user=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`
  )

  return new Response(JSON.stringify({ ok: true, user, accessToken }), {
    status: 200,
    headers,
  })
}
