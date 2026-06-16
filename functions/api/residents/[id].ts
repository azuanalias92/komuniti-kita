import { getTenantId, hasPermission } from '../_lib/auth'

async function ensureResidentsTable(db: any) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS residents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      house_no TEXT,
      house_type TEXT,
      owners TEXT DEFAULT '[]',
      vehicles TEXT DEFAULT '[]',
      created_at TEXT,
      updated_at TEXT
    )`
  ).run()

  const info = await db.prepare('PRAGMA table_info(residents)').all()
  const cols = new Set((info.results || []).map((r: any) => String(r.name)))

  const addColumn = async (name: string, def: string) => {
    if (cols.has(name)) return
    await db.prepare(`ALTER TABLE residents ADD COLUMN ${name} ${def}`).run()
    cols.add(name)
  }

  await addColumn("tenant_id", "TEXT NOT NULL DEFAULT 'default'")
  await addColumn('house_no', 'TEXT')
  await addColumn('house_type', 'TEXT')
  await addColumn("owners", "TEXT NOT NULL DEFAULT '[]'")
  await addColumn("vehicles", "TEXT NOT NULL DEFAULT '[]'")
  await addColumn("owners_json", "TEXT NOT NULL DEFAULT '[]'")
  await addColumn("vehicles_json", "TEXT NOT NULL DEFAULT '[]'")
  await addColumn('created_at', 'TEXT')
  await addColumn('updated_at', 'TEXT')

  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_house_no ON residents(tenant_id, house_no)`
    )
    .run()
}

export async function onRequestPut({ env, request, params }: { env: { DB: any }; request: Request; params: { id: string } }) {
  try {
    if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
      return new Response(JSON.stringify({ error: 'database_unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (!(await hasPermission(env, request, '/directory', 'update'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const { id } = params
    const tenantId = await getTenantId(env, request);
    const body = await request.json().catch(() => ({} as any))

    await ensureResidentsTable(env.DB)
    
    // Validate required fields
    if (!body.houseNo) {
      return new Response(JSON.stringify({ error: 'House number is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Check if resident exists and belongs to this tenant
    const existingResident = await env.DB.prepare(
      'SELECT id FROM residents WHERE id = ? AND tenant_id = ?'
    ).bind(id, tenantId).first()

    if (!existingResident) {
      return new Response(JSON.stringify({ error: 'Resident not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }

    const houseNo = String(body.houseNo).trim()
    const houseType = body.houseType === 'homestay' ? 'homestay' : 'own'
    const owners = Array.isArray(body.owners)
      ? body.owners
          .map((owner: any) => ({
            name: String(owner.name || '').trim(),
            phone: String(owner.phone || '').trim(),
            userId: owner.userId ? String(owner.userId) : undefined,
          }))
          .filter((o: { name: string; phone: string }) => o.name && o.phone)
      : []
    const vehicles = Array.isArray(body.vehicles) ? body.vehicles.map((vehicle: any) => ({
      brand: String(vehicle.brand || '').trim(),
      model: String(vehicle.model || '').trim(),
      plate: String(vehicle.plate || '').trim()
    })).filter((v: { brand: string; model: string; plate: string }) => v.brand && v.model && v.plate) : []

    const ownersJson = JSON.stringify(owners)
    const vehiclesJson = JSON.stringify(vehicles)

    // Check if house number already exists for a different resident in this tenant
    const existingHouse = await env.DB.prepare(
      'SELECT id FROM residents WHERE tenant_id = ? AND house_no = ? AND id != ?'
    ).bind(tenantId, houseNo, id).first()

    if (existingHouse) {
      return new Response(JSON.stringify({ error: 'House number already exists' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    }

    const updateSql = `
      UPDATE residents 
      SET house_no = ?, house_type = ?, owners = ?, vehicles = ?, owners_json = ?, vehicles_json = ?, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `

    await env.DB.prepare(updateSql).bind(
      houseNo,
      houseType,
      ownersJson,
      vehiclesJson,
      ownersJson,
      vehiclesJson,
      id,
      tenantId
    ).run()

    const updatedResident = {
      id,
      houseNo,
      houseType,
      owners,
      vehicles
    }

    return Response.json(updatedResident)
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update resident' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export async function onRequestDelete({ env, request, params }: { env: { DB: any }; request: Request; params: { id: string } }) {
  try {
    if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
      return new Response(JSON.stringify({ error: 'database_unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (!(await hasPermission(env, request, '/directory', 'delete'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const { id } = params
    const tenantId = await getTenantId(env, request);

    await ensureResidentsTable(env.DB)

    // Check if resident exists and belongs to this tenant
    const existingResident = await env.DB.prepare(
      'SELECT id FROM residents WHERE id = ? AND tenant_id = ?'
    ).bind(id, tenantId).first()

    if (!existingResident) {
      return new Response(JSON.stringify({ error: 'Resident not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }

    await env.DB.prepare('DELETE FROM residents WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run()

    return new Response(null, { status: 204 })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to delete resident' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
