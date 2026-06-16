import { getTenantId, getUserFromToken } from '../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: D1Database; JWT_SECRET?: string }; request: Request }) {
  try {
    const user = await getUserFromToken(env, request);
    if (!user?.email) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    const tenantId = await getTenantId(env, request);
    const url = new URL(request.url)
    const email = url.searchParams.get('email') || ''
    if (!email) return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first()
    if (!tableCheck) return new Response(null, { status: 204 })

    const row = await env.DB.prepare(
      `SELECT id, username, email, first_name, last_name, phone_number FROM users WHERE tenant_id = ? AND email = ? LIMIT 1`
    ).bind(tenantId, email).first()

    if (!row) return new Response(null, { status: 204 })
    return Response.json(row)
  } catch (e) {
    return new Response(JSON.stringify({ error: 'profile_fetch_failed' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export async function onRequestPatch({ env, request }: { env: { DB: D1Database; JWT_SECRET?: string }; request: Request }) {
  try {
    const user = await getUserFromToken(env, request);
    if (!user?.email) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    const tenantId = await getTenantId(env, request);
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) return new Response(JSON.stringify({ error: 'invalid_content_type' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const body = await request.json().catch(() => ({} as any))
    const email = typeof body.email === 'string' ? body.email : ''
    const username = typeof body.username === 'string' ? body.username : undefined
    const firstName = typeof body.firstName === 'string' ? body.firstName : undefined
    const lastName = typeof body.lastName === 'string' ? body.lastName : undefined
    const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber : undefined
    if (!email) return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first()
    if (!tableCheck) return new Response(JSON.stringify({ error: 'users_table_missing' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const now = new Date().toISOString()
    const fields: string[] = []
    const params: unknown[] = []
    if (username !== undefined) { fields.push('username = ?'); params.push(username) }
    if (firstName !== undefined) { fields.push('first_name = ?'); params.push(firstName) }
    if (lastName !== undefined) { fields.push('last_name = ?'); params.push(lastName) }
    if (phoneNumber !== undefined) { fields.push('phone_number = ?'); params.push(phoneNumber) }
    fields.push('updated_at = ?'); params.push(now)
    params.push(email)
    params.push(tenantId)

    if (fields.length === 1) return new Response(JSON.stringify({ error: 'no_fields' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE email = ? AND tenant_id = ?`
    await env.DB.prepare(sql).bind(...params).run()
    return Response.json({ success: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'profile_update_failed' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}
