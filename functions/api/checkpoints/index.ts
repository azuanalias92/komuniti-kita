import { addTenantFilter, hasPermission, getTenantId } from '../_lib/auth'

async function ensureCheckpointsTable(db: any) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT,
      updated_at TEXT
    )`
  ).run()
}

export async function onRequestGet({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
      return new Response(null, { status: 204 })
    }
    // Check permission
    if (!(await hasPermission(env, request, '/checkpoints', 'read'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const tenantId = getTenantId(request);
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || '10')))
    const name = url.searchParams.get('name') || ''

    const offset = (page - 1) * pageSize

    const where: string[] = []
    const params: unknown[] = []
    addTenantFilter(where, params, tenantId)

    if (name) {
      where.push('(name LIKE ?)')
      params.push(`%${name}%`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    await ensureCheckpointsTable(env.DB)

    const countStmt = env.DB.prepare(`SELECT COUNT(*) as count FROM checkpoints ${whereSql}`)
    const total = (await countStmt.bind(...params).first()) as { count?: number } | null

    const selectSql = `
      SELECT id,
             name,
             latitude,
             longitude,
             created_at as created_at,
             updated_at as updated_at
      FROM checkpoints
      ${whereSql}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `

    const listStmt = env.DB.prepare(selectSql)
    const result = await listStmt.bind(...params, pageSize, offset).all()

    const data = (result.results || []).map((row: any) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      latitude: Number(row.latitude ?? 0),
      longitude: Number(row.longitude ?? 0),
      createdAt: new Date(String(row.created_at ?? new Date().toISOString())),
      updatedAt: new Date(String(row.updated_at ?? new Date().toISOString())),
    })).filter((row: any) => row.id && row.name && Number.isFinite(row.latitude) && Number.isFinite(row.longitude))

    if (!data.length) {
      return Response.json({ page, pageSize, total: total?.count ?? 0, data: [] })
    }

    return Response.json({ page, pageSize, total: (total?.count ?? 0), data })
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Failed to fetch checkpoints', detail: String(_) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export async function onRequestPost({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
      const body = await request.json().catch(() => ({}))
      const now = new Date().toISOString()
      const created = {
        id: crypto.randomUUID(),
        name: String(body.name || ''),
        latitude: Number(body.latitude || 0),
        longitude: Number(body.longitude || 0),
        createdAt: now,
        updatedAt: now,
      }
      return new Response(JSON.stringify(created), { headers: { 'content-type': 'application/json' } })
    }

    if (!(await hasPermission(env, request, '/checkpoints', 'create'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const tenantId = getTenantId(request);

    await ensureCheckpointsTable(env.DB)

    const body = await request.json().catch(() => ({} as any))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)
    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const insert = await env.DB.prepare(
      `INSERT INTO checkpoints (id, tenant_id, name, latitude, longitude, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, tenantId, name, latitude, longitude, now, now).run()

    if (!(insert as any).success && typeof (insert as any).success !== 'undefined') {
      return new Response(JSON.stringify({ error: 'insert_failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    const created = {
      id,
      name,
      latitude,
      longitude,
      createdAt: now,
      updatedAt: now,
    }
    return new Response(JSON.stringify(created), { headers: { 'content-type': 'application/json' } })
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Failed to create checkpoint', detail: String(_) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export async function onRequestPut({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (!(await hasPermission(env, request, '/checkpoints', 'update'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const tenantId = getTenantId(request);

    const body = await request.json().catch(() => ({} as any))
    const id = body.id
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)

    if (!id || !name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const now = new Date().toISOString()
    const update = await env.DB.prepare(
      `UPDATE checkpoints 
       SET name = ?, latitude = ?, longitude = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`
    ).bind(name, latitude, longitude, now, id, tenantId).run()

    if (!(update as any).success) {
      return new Response(JSON.stringify({ error: 'update_failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ id, name, latitude, longitude, updatedAt: now }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Failed to update checkpoint', detail: String(_) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export async function onRequestDelete({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    if (!(await hasPermission(env, request, '/checkpoints', 'delete'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const tenantId = getTenantId(request);
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return new Response(JSON.stringify({ error: 'missing_id' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await env.DB.prepare('DELETE FROM checkpoints WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()

    if (!(result as any).success) {
      return new Response(JSON.stringify({ error: 'delete_failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response(null, { status: 204 })
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Failed to delete checkpoint', detail: String(_) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
