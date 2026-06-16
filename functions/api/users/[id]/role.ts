import { getTenantId } from '../../_lib/auth'

async function ensureSchema(env: { DB: D1Database }) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      username TEXT,
      email TEXT UNIQUE,
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
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT UNIQUE,
      description TEXT,
      created_at TEXT,
      updated_at TEXT
    )`
  ).run()
}

export async function onRequestPatch({ request, params, env }: { request: Request; params: { id: string }; env: { DB: D1Database } }) {
  await ensureSchema(env)
  const tenantId = await getTenantId(env, request);
  const json = await request.json().catch(() => ({} as any))
  const role = typeof json.role === 'string' ? json.role.trim() : ''
  if (!role) {
    return new Response(JSON.stringify({ error: 'invalid_role' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const existingRole = await env.DB.prepare(`SELECT id FROM roles WHERE tenant_id = ? AND name = ?`).bind(tenantId, role).first()
  if (!existingRole) {
    return new Response(JSON.stringify({ error: 'role_not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }
  const up = await env.DB.prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(role, new Date().toISOString(), params.id, tenantId)
    .run()
  if (!up.success) {
    return new Response(JSON.stringify({ error: 'update_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
}
