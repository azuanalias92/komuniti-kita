import { hasPermission, getTenantId } from '../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: D1Database }; request: Request }) {
  try {
    // Check permission
    if (!(await hasPermission(env, request, "/check-in-logs", "read"))) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const tenantId = getTenantId(request);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || "10")));
    const homestayId = url.searchParams.get("homestayId");
    const latestByHomestay = url.searchParams.get("latestByHomestay") === "true";

    const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='homestay_checkins'").first();
    if (!tableCheck) {
      return new Response(null, { status: 204 });
    }

    if (latestByHomestay) {
      const sql = `
        SELECT hc.*
        FROM homestay_checkins hc
        INNER JOIN (
          SELECT homestay_id, MAX(submitted_at) AS max_submitted
          FROM homestay_checkins
          WHERE tenant_id = ?
          GROUP BY homestay_id
        ) latest ON latest.homestay_id = hc.homestay_id AND latest.max_submitted = hc.submitted_at
        WHERE hc.tenant_id = ?
        ORDER BY hc.homestay_id ASC
      `;
      const result = await env.DB.prepare(sql).bind(tenantId, tenantId).all();
      const data = (result.results || []).map(mapRow);
      if (!data.length) return new Response(null, { status: 204 });
      return Response.json({ data });
    }

    const where: string[] = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (homestayId) {
      where.push("homestay_id = ?");
      params.push(homestayId);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const offset = (page - 1) * pageSize;

    const countStmt = env.DB.prepare(`SELECT COUNT(*) as count FROM homestay_checkins ${whereSql}`);
    const total = (await countStmt.bind(...params).first()) as { count?: number } | null;

    const listSql = `
      SELECT *
      FROM homestay_checkins
      ${whereSql}
      ORDER BY submitted_at DESC
      LIMIT ? OFFSET ?
    `;
    const result = await env.DB.prepare(listSql)
      .bind(...params, pageSize, offset)
      .all();
    const data = (result.results || []).map(mapRow);
    if (!data.length) return new Response(null, { status: 204 });
    return Response.json({ page, pageSize, total: total?.count ?? 0, data });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch homestay check-ins" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function onRequestPost({ env, request }: { env: { DB: D1Database }; request: Request }) {
  try {
    // Public endpoint - no permission check needed for creating check-ins

    const tenantId = getTenantId(request);
    const body = await request.json();

    if (!body.homestayId || !body.personInCharge || !body.numberOfGuests) {
      return new Response(JSON.stringify({ error: "homestayId, personInCharge, numberOfGuests are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='homestay_checkins'").first();
    if (!tableCheck) {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS homestay_checkins (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          homestay_id TEXT NOT NULL,
          person_in_charge TEXT NOT NULL,
          guests INTEGER NOT NULL,
          plates_json TEXT NOT NULL,
          arrival TEXT,
          departure TEXT,
          notes TEXT,
          submitted_at TEXT NOT NULL
        )`
      ).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_hc_homestay_submitted ON homestay_checkins(tenant_id, homestay_id, submitted_at)`).run();
    }

    const id = crypto.randomUUID();
    const homestayId = String(body.homestayId).trim();
    const personInCharge = String(body.personInCharge).trim();
    const numberOfGuests = Number(body.numberOfGuests);
    const plates = Array.isArray(body.numberPlates)
      ? body.numberPlates.map((p: unknown) => String(p || "").trim()).filter(Boolean)
      : String(body.numberPlates || "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
    const arrival = body.dateOfArrival ? String(body.dateOfArrival) : null;
    const departure = body.dateOfDeparture ? String(body.dateOfDeparture) : null;
    const notes = body.additionalNotes ? String(body.additionalNotes) : null;
    const submittedAt = new Date().toISOString();

    const insertSql = `
      INSERT INTO homestay_checkins (id, tenant_id, homestay_id, person_in_charge, guests, plates_json, arrival, departure, notes, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await env.DB.prepare(insertSql).bind(id, tenantId, homestayId, personInCharge, numberOfGuests, JSON.stringify(plates), arrival, departure, notes, submittedAt).run();

    const created = {
      id,
      homestayId,
      personInCharge,
      numberOfGuests,
      numberPlates: plates,
      dateOfArrival: arrival || undefined,
      dateOfDeparture: departure || undefined,
      additionalNotes: notes || undefined,
      submittedAt,
    };

    return Response.json(created, { status: 201 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed to create homestay check-in" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

function mapRow(row: any) {
  let plates = [];
  try {
    plates = row.plates_json ? JSON.parse(row.plates_json) : [];
  } catch (e) {
    console.error("Failed to parse plates_json for row", row.id, e);
    // Fallback: try to treat as comma-separated string if simple string
    if (typeof row.plates_json === "string") {
      plates = [row.plates_json];
    }
  }

  return {
    id: row.id,
    homestayId: row.homestay_id,
    personInCharge: row.person_in_charge,
    numberOfGuests: row.guests,
    numberPlates: plates,
    dateOfArrival: row.arrival,
    dateOfDeparture: row.departure,
    additionalNotes: row.notes,
    submittedAt: row.submitted_at,
  };
}
