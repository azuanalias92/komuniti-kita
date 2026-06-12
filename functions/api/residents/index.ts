import { addTenantFilter, getTenantId } from '../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    const tenantId = getTenantId(request);
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
      where.push("(house_no LIKE ? OR owners_json LIKE ? OR vehicles_json LIKE ?)");
      params.push(`%${filter}%`, `%${filter}%`, `%${filter}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='residents'").first();
    if (!tableCheck) {
      return Response.json({ page, pageSize, total: 0, data: [] });
    }

    const countStmt = env.DB.prepare(`SELECT COUNT(*) as count FROM residents ${whereSql}`);
    const total = (await countStmt.bind(...params).first()) as { count?: number } | null;

    const selectSql = `
      SELECT id,
             house_no as house_no,
             house_type as house_type,
             owners_json as owners_json,
             vehicles_json as vehicles_json
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
    const tenantId = getTenantId(request);
    const body = await request.json();

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

    // Ensure table exists
    const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='residents'").first();
    if (!tableCheck) {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS residents (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          house_no TEXT NOT NULL,
          house_type TEXT NOT NULL,
          owners_json TEXT NOT NULL,
          vehicles_json TEXT NOT NULL
        )`
      ).run();
      await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_house_no ON residents(tenant_id, house_no)`).run();
    }

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
      INSERT INTO residents (id, tenant_id, house_no, house_type, owners_json, vehicles_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await env.DB.prepare(insertSql).bind(id, tenantId, houseNo, houseType, JSON.stringify(owners), JSON.stringify(vehicles)).run();

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
