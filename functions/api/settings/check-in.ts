import { hasPermission, getTenantId } from '../_lib/auth'

interface Env {
  DB: D1Database
}

export async function onRequestGet({ env, request }: { env: Env; request: Request }) {
  try {
    if (!env.DB) return new Response(null, { status: 204 })

    const tenantId = getTenantId(request);
    await ensureSettingsTable(env.DB)

    const settings = await env.DB.prepare('SELECT * FROM check_in_settings WHERE tenant_id = ? LIMIT 1').bind(tenantId).first()
    
    const data = {
      radius: settings?.radius || 50,
      timeWindow: settings?.time_window || 5
    }

    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch settings', detail: String(e) }), { status: 500 })
  }
}

export async function onRequestPost({ request, env }: { request: Request, env: Env }) {
  try {
    if (!(await hasPermission(env, request, '/settings', 'update'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    }

    const tenantId = getTenantId(request);
    const body = await request.json() as { radius: number, timeWindow: number }
    const radius = Number(body.radius)
    const timeWindow = Number(body.timeWindow)

    if (isNaN(radius) || isNaN(timeWindow)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 })
    }

    await ensureSettingsTable(env.DB)

    // Check if settings exist for this tenant
    const existing = await env.DB.prepare('SELECT id FROM check_in_settings WHERE tenant_id = ? LIMIT 1').bind(tenantId).first()

    if (existing) {
      await env.DB.prepare(
        'UPDATE check_in_settings SET radius = ?, time_window = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
      ).bind(radius, timeWindow, new Date().toISOString(), existing.id, tenantId).run()
    } else {
      await env.DB.prepare(
        'INSERT INTO check_in_settings (id, tenant_id, radius, time_window, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), tenantId, radius, timeWindow, new Date().toISOString()).run()
    }

    return new Response(JSON.stringify({ radius, timeWindow }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to update settings' }), { status: 500 })
  }
}

async function ensureSettingsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS check_in_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      radius INTEGER,
      time_window INTEGER,
      updated_at TEXT
    )
  `).run()
}
