import { hasPermission, getTenantId, getUserFromToken } from '../_lib/auth'

interface Env {
  DB: D1Database
}

export async function onRequestGet({ env, request }: { env: Env; request: Request }) {
  try {
    await ensureSettingsTable(env.DB)
    const tenantId = getTenantId(request);
    const row = await env.DB.prepare('SELECT id, rate, frequency, qr_key, bg_key, start_date, updated_at FROM billing_settings WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 1').bind(tenantId).first()
    if (!row) return new Response(null, { status: 204 })
    return new Response(JSON.stringify({
      id: row.id,
      rate: Number(row.rate),
      frequency: String(row.frequency || 'monthly'),
      qrKey: row.qr_key ? String(row.qr_key) : null,
      bgKey: row.bg_key ? String(row.bg_key) : null,
      startDate: String(row.start_date || ''),
      updatedAt: String(row.updated_at || '')
    }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch billing settings' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export async function onRequestPost({ env, request }: { env: Env; request: Request }) {
  try {
    const canUpdate = await hasPermission(env, request, '/settings', 'update')
    const canRead = await hasPermission(env, request, '/settings', 'read')
    if (!canUpdate && !canRead) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    const tenantId = getTenantId(request);
    const body = await request.json().catch(() => ({} as any))
    const rate = Number(body.rate)
    const frequency = String(body.frequency || 'monthly')
    const qrKey = typeof body.qrKey === 'string' ? body.qrKey : null
    const bgKey = typeof body.bgKey === 'string' ? body.bgKey : null
    const startDate = String(body.startDate || '')

    if (!rate || isNaN(rate) || rate <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid rate' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (!['monthly', 'semi-annual', 'annual'].includes(frequency)) {
      return new Response(JSON.stringify({ error: 'Invalid frequency' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (!isValidDate(startDate)) {
      return new Response(JSON.stringify({ error: 'Invalid startDate' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    await ensureSettingsTable(env.DB)
    await ensureHistoryTable(env.DB)

    const prev = await env.DB.prepare('SELECT rate, frequency, qr_key, bg_key, start_date FROM billing_settings WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 1').bind(tenantId).first()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.prepare('INSERT INTO billing_settings (id, tenant_id, rate, frequency, qr_key, bg_key, start_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, tenantId, rate, frequency, qrKey, bgKey, startDate, now)
      .run()

    const changedBy = getUserFromToken(request)
    await env.DB.prepare(
      'INSERT INTO billing_settings_history (id, tenant_id, prev_rate, prev_frequency, prev_qr_key, prev_bg_key, prev_start_date, new_rate, new_frequency, new_qr_key, new_bg_key, new_start_date, changed_at, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      crypto.randomUUID(),
      tenantId,
      prev ? Number(prev.rate) : null,
      prev ? String(prev.frequency || '') : null,
      prev ? (prev.qr_key ? String(prev.qr_key) : null) : null,
      prev ? (prev.bg_key ? String(prev.bg_key) : null) : null,
      prev ? (prev.start_date ? String(prev.start_date) : null) : null,
      rate,
      frequency,
      qrKey,
      bgKey,
      startDate,
      now,
      changedBy ? changedBy.email || changedBy.id : null
    ).run()

    return new Response(JSON.stringify({ id, rate, frequency, qrKey, bgKey, startDate, updatedAt: now }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    const msg = (e as any)?.message || 'Failed to update billing settings'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

async function ensureSettingsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      rate REAL NOT NULL,
      frequency TEXT NOT NULL,
      qr_key TEXT,
      bg_key TEXT,
      start_date TEXT NOT NULL,
      updated_at TEXT
    )
  `).run()
  try { await db.prepare('ALTER TABLE billing_settings ADD COLUMN start_date TEXT').run() } catch {}
  try { await db.prepare('ALTER TABLE billing_settings ADD COLUMN bg_key TEXT').run() } catch {}
}

async function ensureHistoryTable(db: D1Database) {
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
  try { await db.prepare('ALTER TABLE billing_settings_history ADD COLUMN prev_bg_key TEXT').run() } catch {}
  try { await db.prepare('ALTER TABLE billing_settings_history ADD COLUMN new_bg_key TEXT').run() } catch {}
}

function isValidDate(d: string): boolean {
  if (!d) return false
  const m = /^\d{4}-\d{2}-\d{2}$/.test(d)
  if (!m) return false
  const dt = new Date(d)
  return !isNaN(dt.getTime())
}
