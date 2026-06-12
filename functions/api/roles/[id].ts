import { getTenantId } from '../_lib/auth'

export async function onRequestGet({ params, env, request }: { params: { id: string }; env: { DB: D1Database }; request: Request }) {
  await ensureSchema(env)
  const tenantId = getTenantId(request);
  const role = await env.DB.prepare(`SELECT id, name, description, start_page FROM roles WHERE id = ? AND tenant_id = ?`).bind(params.id, tenantId).first()
  if (!role) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }
  const perms = await env.DB.prepare(
    `SELECT resource, can_create, can_read, can_update, can_delete FROM role_permissions WHERE role_id = ?`
  ).bind(params.id).all()
  return new Response(JSON.stringify({ role, permissions: perms.results || [] }), {
    headers: { 'content-type': 'application/json' },
  })
}

export async function onRequestPut({ request, params, env }: { request: Request; params: { id: string }; env: { DB: D1Database } }) {
  await ensureSchema(env)
  const tenantId = getTenantId(request);
  const json = await request.json().catch(() => ({} as any))
  const name = typeof json.name === 'string' ? json.name.trim() : ''
  const description = typeof json.description === 'string' ? json.description.trim() : ''
  const startPage = typeof json.startPage === 'string' ? json.startPage.trim() : ''
  if (!name) {
    return new Response(JSON.stringify({ error: 'invalid_name' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const up = await env.DB.prepare(
    `UPDATE roles SET name = ?, description = ?, start_page = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`
  )
    .bind(name, description, startPage, new Date().toISOString(), params.id, tenantId)
    .run()
  if (!up.success) {
    return new Response(JSON.stringify({ error: 'update_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ id: params.id, name, description, start_page: startPage }), {
    headers: { 'content-type': 'application/json' },
  })
}

async function ensureSchema(env: { DB: D1Database }) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      description TEXT,
      start_page TEXT,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(tenant_id, name)
    )`
  ).run()
  const col = await env.DB.prepare(`SELECT name FROM pragma_table_info('roles') WHERE name = 'start_page'`).first()
  if (!col) {
    try {
      await env.DB.prepare(`ALTER TABLE roles ADD COLUMN start_page TEXT`).run()
    } catch {}
  }
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      resource TEXT,
      can_create INTEGER,
      can_read INTEGER,
      can_update INTEGER,
      can_delete INTEGER,
      PRIMARY KEY (role_id, resource)
    )`
  ).run()
}
