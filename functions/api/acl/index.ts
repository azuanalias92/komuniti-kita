import { getTenantId } from '../_lib/auth'

export async function onRequestGet({ request, env }: { request: Request; env: { DB: D1Database } }) {
  if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
    return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } })
  }
  await ensureSchema(env)
  const tenantId = getTenantId(request);
  const url = new URL(request.url)
  const roleName = url.searchParams.get('role') || ''
  if (!roleName) {
    return new Response(JSON.stringify({ error: 'missing_role' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const role = await env.DB.prepare(`SELECT id FROM roles WHERE tenant_id = ? AND lower(name) = lower(?)`).bind(tenantId, roleName).first()
  if (!role) {
    return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } })
  }
  const perms = await env.DB.prepare(
    `SELECT resource, can_create, can_read, can_update, can_delete FROM role_permissions WHERE role_id = ?`
  ).bind((role as any).id).all()
  return new Response(JSON.stringify(perms.results || []), {
    headers: { 'content-type': 'application/json' },
  })
}

export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database } }) {
  if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
  }
  await ensureSchema(env)
  const tenantId = getTenantId(request);
  const json = await request.json().catch(() => ({} as any))
  const roleName = typeof json.role === 'string' ? json.role.trim() : ''
  const permissions = Array.isArray(json.permissions) ? json.permissions : []
  if (!roleName || permissions.length === 0) {
    return new Response(JSON.stringify({ error: 'invalid_payload' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  let role = await env.DB.prepare(`SELECT id FROM roles WHERE tenant_id = ? AND lower(name) = lower(?)`).bind(tenantId, roleName).first()
  if (!role) {
    const id = crypto.randomUUID()
    await env.DB.prepare(
      `INSERT INTO roles (id, tenant_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, tenantId, roleName, '', new Date().toISOString(), new Date().toISOString())
      .run()
    role = { id } as any
  }
  const roleId = (role as any).id
  await env.DB.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).bind(roleId).run()
  for (const p of permissions) {
    const resource = typeof p.resource === 'string' ? p.resource : ''
    const can_create = p.create ? 1 : 0
    const can_read = p.read ? 1 : 0
    const can_update = p.update ? 1 : 0
    const can_delete = p.delete ? 1 : 0
    if (!resource) continue
    await env.DB.prepare(
      `INSERT INTO role_permissions (role_id, tenant_id, resource, can_create, can_read, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(roleId, tenantId, resource, can_create, can_read, can_update, can_delete)
      .run()
  }
  return new Response(JSON.stringify({ ok: true }), {
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
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(tenant_id, name)
    )`
  ).run()
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
