import { addTenantFilter, getTenantId } from '../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: any }; request: Request }) {
  await ensureSchema(env)
  const tenantId = getTenantId(request);
  const where: string[] = []
  const params: unknown[] = []
  addTenantFilter(where, params, tenantId)
  const sql = `SELECT id, name, description, start_page FROM roles ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name`
  const rows = await env.DB.prepare(sql).bind(...params).all()
  return new Response(JSON.stringify(rows.results || []), {
    headers: { 'content-type': 'application/json' },
  })
}

export async function onRequestPost({ request, env }: { request: Request; env: { DB: any } }) {
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
  const id = crypto.randomUUID()
  const insert = await env.DB.prepare(
    `INSERT INTO roles (id, tenant_id, name, description, start_page, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, tenantId, name, description, startPage, new Date().toISOString(), new Date().toISOString())
    .run()
  if (!insert.success) {
    return new Response(JSON.stringify({ error: 'insert_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ id, name, description, start_page: startPage }), {
    headers: { 'content-type': 'application/json' },
  })
}

async function ensureSchema(env: { DB: any }) {
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
