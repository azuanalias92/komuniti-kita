import { hasPermission, getTenantId } from '../../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: D1Database }; request: Request }) {
  try {
    await ensurePaymentsTable(env.DB)
    const tenantId = getTenantId(request);
    const url = new URL(request.url)
    const houseId = url.searchParams.get('houseId')
    const status = url.searchParams.get('status')
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')

    const where: string[] = ['tenant_id = ?']
    const params: any[] = [tenantId]
    if (houseId) { where.push('house_id = ?'); params.push(houseId) }
    if (status) { where.push('status = ?'); params.push(status) }
    if (start && end) { where.push('payment_date BETWEEN ? AND ?'); params.push(start, end) }

    const sql = `SELECT id, house_id, amount, receipt_key, payment_date, status, created_at, updated_at, reviewed_at FROM payments ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY payment_date DESC`
    const result = await env.DB.prepare(sql).bind(...params).all()
    return new Response(JSON.stringify(result.results || []), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch payments' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export async function onRequestPost({ env, request }: { env: { DB: D1Database }; request: Request }) {
  try {
    await ensurePaymentsTable(env.DB)
    const tenantId = getTenantId(request);
    const body = await request.json().catch(() => ({} as any))
    const houseId = String(body.houseId || '')
    const amount = Number(body.amount)
    const receiptKey = String(body.receiptKey || '')
    const paymentDate = String(body.paymentDate || new Date().toISOString().slice(0, 10))

    if (!houseId) return new Response(JSON.stringify({ error: 'houseId required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    if (!amount || isNaN(amount) || amount <= 0) return new Response(JSON.stringify({ error: 'invalid amount' }), { status: 400, headers: { 'content-type': 'application/json' } })
    if (!receiptKey) return new Response(JSON.stringify({ error: 'receiptKey required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.prepare('INSERT INTO payments (id, tenant_id, house_id, amount, receipt_key, payment_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, tenantId, houseId, amount, receiptKey, paymentDate, 'pending', now, now)
      .run()

    return new Response(JSON.stringify({ id, houseId, amount, receiptKey, paymentDate, status: 'pending', createdAt: now }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to submit payment' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export async function onRequestPut({ env, request }: { env: { DB: D1Database }; request: Request }) {
  try {
    if (!(await hasPermission(env, request, '/billing', 'update'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }
    await ensurePaymentsTable(env.DB)
    const tenantId = getTenantId(request);
    const body = await request.json().catch(() => ({} as any))
    const id = String(body.id || '')
    const status = String(body.status || '')
    if (!id || !['pending','confirmed','rejected'].includes(status)) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    await env.DB.prepare('UPDATE payments SET status = ?, updated_at = ?, reviewed_at = ? WHERE id = ? AND tenant_id = ?').bind(status, new Date().toISOString(), new Date().toISOString(), id, tenantId).run()
    return new Response(JSON.stringify({ id, status }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to update payment' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

async function ensurePaymentsTable(db: D1Database) {
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
      updated_at TEXT,
      reviewed_at TEXT
    )
  `).run()
  try { await db.prepare('ALTER TABLE payments ADD COLUMN reviewed_at TEXT').run() } catch {}
}
