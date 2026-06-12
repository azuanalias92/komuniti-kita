import { getTenantId, isAllTenantsScope } from '../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    const tenantId = getTenantId(request);
    const settings = await getSettings(env.DB)
    if (!settings) {
      return new Response(JSON.stringify({ frequency: 'monthly', rate: 0, period: null, data: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    }

    await ensureResidentsTable(env.DB)
    await ensurePaymentsTable(env.DB)

    const url = new URL(request.url)
    const freqParam = url.searchParams.get('frequency') || settings.frequency
    const yearParam = url.searchParams.get('year')
    const year = yearParam ? Math.max(1970, Number(yearParam)) : undefined
    const monthParam = url.searchParams.get('month')
    const month = monthParam ? Math.max(1, Math.min(12, Number(monthParam))) : undefined

    const computed = currentPeriod(freqParam, year, month)
    const period = clampStartToSettings(computed, settings.startDate)

    const residentsSql = isAllTenantsScope(tenantId)
      ? 'SELECT id, house_no, house_type, tenant_id FROM residents ORDER BY house_no ASC'
      : 'SELECT id, house_no, house_type, tenant_id FROM residents WHERE tenant_id = ? ORDER BY house_no ASC'
    const residents = isAllTenantsScope(tenantId)
      ? await env.DB.prepare(residentsSql).all()
      : await env.DB.prepare(residentsSql).bind(tenantId).all()
    const list = [] as any[]
    for (const r of residents.results || []) {
      const houseId = String(r.id)
      const residentTenantId = String((r as any).tenant_id || tenantId)
      const sumRow = await env.DB.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND house_id = ? AND payment_date BETWEEN ? AND ? AND status = ?')
        .bind(residentTenantId, houseId, period.start, period.end, 'confirmed')
        .first() as { total?: number } | null
      const amountPaid = Number(sumRow?.total || 0)
      const amountDue = Number(settings.rate)
      const balance = amountPaid - amountDue
      const status = balance >= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending')
      list.push({
        houseId,
        houseNo: String(r.house_no),
        amountDue,
        amountPaid,
        debit: balance < 0 ? Math.abs(balance) : 0,
        credit: balance > 0 ? balance : 0,
        status,
        period
      })
    }

    return new Response(JSON.stringify({ frequency: freqParam, rate: settings.rate, period, data: list }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to build summary' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

async function getSettings(db: any) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      rate REAL NOT NULL,
      frequency TEXT NOT NULL,
      qr_key TEXT,
      start_date TEXT,
      updated_at TEXT
    )
  `).run()
  try { await db.prepare('ALTER TABLE billing_settings ADD COLUMN start_date TEXT').run() } catch {}
  const row = await db.prepare('SELECT rate, frequency, start_date FROM billing_settings ORDER BY updated_at DESC LIMIT 1').first()
  if (!row) return null
  return { rate: Number(row.rate), frequency: String(row.frequency || 'monthly'), startDate: String(row.start_date || '') }
}

function currentPeriod(freq: string, overrideYear?: number, overrideMonth?: number): { start: string; end: string } {
  const now = new Date()
  const y = overrideYear && !isNaN(overrideYear) ? overrideYear : now.getFullYear()
  if (freq === 'annual') {
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  if (freq === 'semi-annual') {
    const m = now.getMonth()
    const firstHalf = m < 6
    return firstHalf ? { start: `${y}-01-01`, end: `${y}-06-30` } : { start: `${y}-07-01`, end: `${y}-12-31` }
  }
  // monthly default
  const month = overrideMonth && !isNaN(overrideMonth) ? overrideMonth : (now.getMonth() + 1)
  const start = `${y}-${String(month).padStart(2,'0')}-01`
  const endDate = new Date(y, month, 0).getDate()
  const end = `${y}-${String(month).padStart(2,'0')}-${String(endDate).padStart(2,'0')}`
  return { start, end }
}

function clampStartToSettings(period: { start: string; end: string }, settingsStart?: string): { start: string; end: string } {
  if (!settingsStart) return period
  const s = new Date(settingsStart)
  if (isNaN(s.getTime())) return period
  const start = new Date(period.start)
  if (s > start) {
    return { start: settingsStart, end: period.end }
  }
  return period
}

async function ensureResidentsTable(db: any) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS residents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      house_no TEXT NOT NULL,
      house_type TEXT NOT NULL,
      owners_json TEXT NOT NULL,
      vehicles_json TEXT NOT NULL
    )
  `).run()
}

async function ensurePaymentsTable(db: any) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      house_id TEXT NOT NULL,
      amount REAL NOT NULL,
      receipt_key TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `).run()
}
