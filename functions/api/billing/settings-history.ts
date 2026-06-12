import { getTenantId } from '../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: D1Database }; request: Request }) {
  try {
    await ensureHistory(env.DB)
    const tenantId = getTenantId(request);
    const res = await env.DB.prepare('SELECT * FROM billing_settings_history WHERE tenant_id = ? ORDER BY changed_at DESC').bind(tenantId).all()
    return new Response(JSON.stringify(res.results || []), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch history' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

async function ensureHistory(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_settings_history (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      prev_rate REAL,
      prev_frequency TEXT,
      prev_qr_key TEXT,
      prev_bg_key TEXT,
      prev_start_date TEXT,
      new_rate REAL,
      new_frequency TEXT,
      new_qr_key TEXT,
      new_bg_key TEXT,
      new_start_date TEXT,
      changed_at TEXT,
      changed_by TEXT
    )
  `).run()
}
