import { addTenantFilter, getTenantId, hasPermission } from '../_lib/auth'

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

export async function onRequestGet({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
      return new Response(null, { status: 204 });
    }

    if (!(await hasPermission(env, request, '/directory', 'read'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }

    const tenantId = await getTenantId(env, request);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || "10")));
    const houseTypes = url.searchParams.getAll("houseType");
    const filter = url.searchParams.get("filter") || "";

    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];
    addTenantFilter(where, params, tenantId);

    if (houseTypes.length) {
      where.push(`(house_type IN (${houseTypes.map(() => "?").join(", ")}))`);
      params.push(...houseTypes);
    }

    if (filter) {
      where.push(
        "(house_no LIKE ? OR COALESCE(owners_json, owners, '[]') LIKE ? OR COALESCE(vehicles_json, vehicles, '[]') LIKE ?)"
      )
      params.push(`%${filter}%`, `%${filter}%`, `%${filter}%`)
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    await ensureResidentsTable(env.DB);

    const countStmt = env.DB.prepare(`SELECT COUNT(*) as count FROM residents ${whereSql}`);
    const total = (await countStmt.bind(...params).first()) as { count?: number } | null;

    const selectSql = `
      SELECT id,
             house_no as house_no,
             house_type as house_type,
             COALESCE(owners_json, owners, '[]') as owners_json,
             COALESCE(vehicles_json, vehicles, '[]') as vehicles_json
      FROM residents
      ${whereSql}
      ORDER BY house_no ASC
      LIMIT ? OFFSET ?
    `;

    const listStmt = env.DB.prepare(selectSql);
    const result = await listStmt.bind(...params, pageSize, offset).all();

    const data = (result.results || []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      houseNo: String(row.house_no ?? ""),
      houseType: String(row.house_type ?? "own"),
      owners: parseJsonArray(row.owners_json) || [],
      vehicles: parseJsonArray(row.vehicles_json) || [],
    }));

    if (!data.length) {
      return Response.json({ page, pageSize, total: total?.count ?? 0, data: [] });
    }

    return Response.json({ page, pageSize, total: total?.count ?? 0, data });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch residents" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function onRequestPost({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
      return new Response(JSON.stringify({ error: 'database_unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!(await hasPermission(env, request, '/directory', 'create'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }

    const tenantId = await getTenantId(env, request);
    const body = await request.json().catch(() => ({} as any));

    // Validate required fields
    if (!body.houseNo) {
      return new Response(JSON.stringify({ error: "House number is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Validate owners data
    for (const owner of body.owners) {
      if (!owner.name || !owner.phone) {
        return new Response(JSON.stringify({ error: "Owner name and phone are required" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
    }

    await ensureResidentsTable(env.DB);

    const id = crypto.randomUUID();
    const houseNo = String(body.houseNo).trim();
    const houseType = body.houseType === "homestay" ? "homestay" : "own";
    const owners = Array.isArray(body.owners)
      ? body.owners.map((owner: any) => ({
          name: String(owner.name).trim(),
          phone: String(owner.phone).trim(),
          userId: owner.userId ? String(owner.userId) : undefined,
        }))
      : [];
    const vehicles = Array.isArray(body.vehicles)
      ? body.vehicles
          .map((vehicle: any) => ({
            brand: String(vehicle.brand || "").trim(),
            model: String(vehicle.model || "").trim(),
            plate: String(vehicle.plate || "").trim(),
          }))
          .filter((v: { brand: string; model: string; plate: string }) => v.brand && v.model && v.plate)
      : [];

    // Check if house number already exists for this tenant
    const existingHouse = await env.DB.prepare("SELECT id FROM residents WHERE tenant_id = ? AND house_no = ?").bind(tenantId, houseNo).first();

    if (existingHouse) {
      return new Response(JSON.stringify({ error: "House number already exists" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    }

    const insertSql = `
      INSERT INTO residents (id, tenant_id, house_no, house_type, owners, vehicles, owners_json, vehicles_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    const ownersJson = JSON.stringify(owners)
    const vehiclesJson = JSON.stringify(vehicles)
    await env.DB
      .prepare(insertSql)
      .bind(
        id,
        tenantId,
        houseNo,
        houseType,
        ownersJson,
        vehiclesJson,
        ownersJson,
        vehiclesJson
      )
      .run()

    const newResident = {
      id,
      houseNo,
      houseType,
      owners,
      vehicles,
    };

    return Response.json(newResident, { status: 201 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed to create resident" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

function parseJsonArray(value: unknown): any[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }
  return null;
}
