import { addTenantFilter, hasPermission, getTenantId, isAllTenantsScope } from '../_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    // Check permission
    if (!(await hasPermission(env, request, "/check-in-logs", "read"))) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const tenantId = await getTenantId(env, request);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || "10")));
    const homestayId = url.searchParams.get("homestayId");
    const latestByHomestay = url.searchParams.get("latestByHomestay") === "true";

    const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='homestay_checkins'").first();
    if (!tableCheck) {
      return Response.json({ page, pageSize, total: 0, data: [] });
    }

    if (latestByHomestay) {
      const aggregateSql = `
        SELECT hc.*
        FROM homestay_checkins hc
        INNER JOIN (
          SELECT tenant_id, homestay_id, MAX(submitted_at) AS max_submitted
          FROM homestay_checkins
          GROUP BY tenant_id, homestay_id
        ) latest ON latest.tenant_id = hc.tenant_id
          AND latest.homestay_id = hc.homestay_id
          AND latest.max_submitted = hc.submitted_at
        ORDER BY hc.tenant_id ASC, hc.homestay_id ASC
      `;
      const tenantSql = `
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
      const result = isAllTenantsScope(tenantId)
        ? await env.DB.prepare(aggregateSql).all()
        : await env.DB.prepare(tenantSql).bind(tenantId, tenantId).all();
      const data = (result.results || []).map(mapRow);
      if (!data.length) return Response.json({ data: [] });
      return Response.json({ data });
    }

    const where: string[] = [];
    const params: unknown[] = [];
    addTenantFilter(where, params, tenantId);
    if (homestayId) {
      where.push("homestay_id = ?");
      params.push(homestayId);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
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
    if (!data.length) return Response.json({ page, pageSize, total: total?.count ?? 0, data: [] });
    return Response.json({ page, pageSize, total: total?.count ?? 0, data });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch homestay check-ins" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function onRequestPost({ env, request }: { env: { DB: any }; request: Request }) {
  try {
    // Public endpoint - no permission check needed for creating check-ins

    const tenantId = await getTenantId(env, request);
    const body = await request.json().catch(() => ({} as any));

    if (!body.homestayId || !body.personInCharge || !body.numberOfGuests) {
      return new Response(JSON.stringify({ error: "homestayId, personInCharge, numberOfGuests are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Ensure table exists — use schema.sql column names
    await ensureTable(env.DB);

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
      INSERT INTO homestay_checkins (id, tenant_id, homestay_id, person_in_charge, number_of_guests, number_plates, date_of_arrival, date_of_departure, additional_notes, submitted_at)
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

async function ensureTable(db: any) {
  // Only creates if table doesn't exist; existing tables keep their schema
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS homestay_checkins (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      homestay_id TEXT,
      person_in_charge TEXT,
      number_of_guests INTEGER,
      number_plates TEXT DEFAULT '[]',
      date_of_arrival TEXT,
      date_of_departure TEXT,
      additional_notes TEXT,
      submitted_at TEXT
    )`
  ).run();

  // Migrate old column names to new ones if needed (runs on every POST)
  const info = await db.prepare("PRAGMA table_info(homestay_checkins)").all();
  const cols = new Set((info.results || []).map((r: any) => String(r.name)));

  if (cols.has("guests") && !cols.has("number_of_guests")) {
    // Old schema had 'guests' — can't rename in D1, so we add a compatibility layer
    // The INSERT now uses number_of_guests which matches schema.sql
  }
}

function mapRow(row: any) {
  let plates = [];
  try {
    const raw = row.number_plates || row.plates_json || "[]";
    plates = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    if (typeof row.number_plates === "string") {
      plates = [row.number_plates];
    }
  }

  return {
    id: row.id,
    homestayId: row.homestay_id,
    personInCharge: row.person_in_charge,
    numberOfGuests: row.number_of_guests ?? row.guests ?? 0,
    numberPlates: plates,
    dateOfArrival: row.date_of_arrival || row.arrival,
    dateOfDeparture: row.date_of_departure || row.departure,
    additionalNotes: row.additional_notes || row.notes,
    submittedAt: row.submitted_at,
  };
}
