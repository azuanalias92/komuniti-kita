import { getTenantId } from '../../_lib/auth'

export async function onRequestPut({ env, request, params }: { env: { DB: D1Database }; request: Request; params: { userId: string } }) {
  try {
    const tenantId = getTenantId(request);
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const body = await request.json()
    const firstName = String(body.firstName || '').trim()
    const lastName = String(body.lastName || '').trim()
    const username = String(body.username || '').trim()
    const email = String(body.email || '').trim()
    const phoneNumber = String(body.phoneNumber || '').trim()
    const status = ['active','inactive','invited','suspended'].includes(body.status) ? body.status : undefined
    const role = ['admin','owner','guard'].includes(body.role) ? body.role : undefined
    const password = String(body.password || '')

    const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').bind(params.userId, tenantId).first()
    if (!existing) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }

    const now = new Date().toISOString()
    const passwordHash = password ? await sha256(password) : undefined

    const updateSql = `
      UPDATE users
      SET username = COALESCE(?, username),
          email = COALESCE(?, email),
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          phone_number = COALESCE(?, phone_number),
          status = COALESCE(?, status),
          role = COALESCE(?, role),
          password_hash = COALESCE(?, password_hash),
          password_updated_at = CASE WHEN ? IS NOT NULL THEN ? ELSE password_updated_at END,
          updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `

    await env.DB.prepare(updateSql).bind(
      username || null,
      email || null,
      firstName || null,
      lastName || null,
      phoneNumber || null,
      status || null,
      role || null,
      passwordHash || null,
      passwordHash ? now : null,
      passwordHash ? now : null,
      now,
      params.userId,
      tenantId
    ).run()

    const selectSql = `
      SELECT id, username, email, first_name, last_name, phone_number, status, role, created_at, updated_at
      FROM users WHERE id = ? AND tenant_id = ?
    `
    const row = await env.DB.prepare(selectSql).bind(params.userId, tenantId).first() as Record<string, unknown> | null
    if (!row) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    const user = {
      id: String(row.id ?? params.userId),
      username: String(row.username ?? ''),
      email: String(row.email ?? ''),
      firstName: String(row.first_name ?? ''),
      lastName: String(row.last_name ?? ''),
      phoneNumber: String(row.phone_number ?? ''),
      status: String(row.status ?? 'active'),
      role: String(row.role ?? 'owner'),
      createdAt: row.created_at ?? now,
      updatedAt: row.updated_at ?? now,
    }

    return Response.json(user)
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update user' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
