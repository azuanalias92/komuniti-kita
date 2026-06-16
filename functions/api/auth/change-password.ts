import { getUserFromToken } from '../_lib/auth'
import { hashPassword, verifyPassword } from '../_lib/password'

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

function hasSuperAdminRole(role: string) {
  return role === 'super_admin' || role === 'superadmin'
}

export async function onRequestPost({
  request,
  env,
}: {
  request: Request
  env: { DB: any }
}) {
  const user = await getUserFromToken(env, request)
  if (!user?.email) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  await ensureSchema(env)

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : ''
  const normalizedEmail = user.email.trim().toLowerCase()

  if (newPassword.length < 8) {
    return new Response(JSON.stringify({ error: 'password_too_short' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  let userRow = null as Record<string, unknown> | null

  if (user.id) {
    userRow = await env.DB.prepare(
      `SELECT id, password_hash
       FROM users
       WHERE id = ?
       LIMIT 1`
    ).bind(user.id).first() as Record<string, unknown> | null
  }

  if (!userRow && normalizedEmail) {
    userRow = await env.DB.prepare(
      `SELECT id, password_hash
       FROM users
       WHERE lower(email) = lower(?)
       LIMIT 1`
    ).bind(normalizedEmail).first() as Record<string, unknown> | null
  }

  if (!userRow && user.role.some(hasSuperAdminRole) && normalizedEmail) {
    const now = new Date().toISOString()
    const id = user.id || 'super-admin'
    const username = normalizedEmail.split('@')[0] || 'super-admin'

    await env.DB.prepare(
      `INSERT INTO users (
        id,
        tenant_id,
        username,
        email,
        status,
        role,
        created_at,
        updated_at
      ) VALUES (?, 'default', ?, ?, 'active', 'super_admin', ?, ?)
      ON CONFLICT(tenant_id, email) DO UPDATE SET
        role = 'super_admin',
        status = 'active',
        updated_at = excluded.updated_at`
    ).bind(id, username, normalizedEmail, now, now).run()

    userRow = await env.DB.prepare(
      `SELECT id, password_hash
       FROM users
       WHERE id = ?
       LIMIT 1`
    ).bind(id).first() as Record<string, unknown> | null
  }

  if (!userRow) {
    return new Response(JSON.stringify({ error: 'user_not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  const existingPasswordHash = String(userRow.password_hash || '')
  if (existingPasswordHash) {
    const matches = await verifyPassword(currentPassword, existingPasswordHash)
    if (!matches) {
      return new Response(JSON.stringify({ error: 'invalid_current_password' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  const nextPasswordHash = await hashPassword(newPassword)
  const now = new Date().toISOString()
  await env.DB.prepare(
    `UPDATE users
     SET password_hash = ?, password_updated_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(nextPasswordHash, now, now, String(userRow.id || '')).run()

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
}
