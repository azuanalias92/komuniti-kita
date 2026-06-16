import { getTenantId, isAllTenantsScope } from '../_lib/auth'

interface Env {
  DB: any;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const tenantId = await getTenantId(env, request);
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const checkpointId = url.searchParams.get("checkpointId");

    await ensureTables(env.DB);

    // If both userId and checkpointId are provided, return last check-in for that combination
    if (userId && checkpointId) {
      const sql = isAllTenantsScope(tenantId)
        ? `
        SELECT timestamp FROM check_in_logs
        WHERE user_id = ? AND checkpoint_id = ?
        ORDER BY timestamp DESC LIMIT 1
      `
        : `
        SELECT timestamp FROM check_in_logs 
        WHERE tenant_id = ? AND user_id = ? AND checkpoint_id = ?
        ORDER BY timestamp DESC LIMIT 1
      `;
      const lastCheckIn = await env.DB.prepare(sql)
        .bind(...(isAllTenantsScope(tenantId) ? [userId, checkpointId] : [tenantId, userId, checkpointId]))
        .first();

      return new Response(
        JSON.stringify({
          lastCheckIn: lastCheckIn ? lastCheckIn.timestamp : null,
        }),
        {
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Otherwise, return all check-in logs with checkpoint info
    try {
      const sql = isAllTenantsScope(tenantId)
        ? `
        SELECT
          cl.id,
          cl.user_id,
          cl.checkpoint_id,
          cl.timestamp,
          c.name as checkpoint_name
        FROM check_in_logs cl
        LEFT JOIN checkpoints c ON cl.checkpoint_id = c.id
        ORDER BY cl.timestamp DESC
      `
        : `
        SELECT 
          cl.id,
          cl.user_id,
          cl.checkpoint_id,
          cl.timestamp,
          c.name as checkpoint_name
        FROM check_in_logs cl
        LEFT JOIN checkpoints c ON cl.checkpoint_id = c.id
        WHERE cl.tenant_id = ?
        ORDER BY cl.timestamp DESC
      `;
      const logs = await env.DB.prepare(sql)
        .bind(...(isAllTenantsScope(tenantId) ? [] : [tenantId]))
        .all();

      return new Response(JSON.stringify(logs.results || []), {
        headers: { "content-type": "application/json" },
      });
    } catch (queryError) {
      console.error("Query error:", queryError);
      return new Response(JSON.stringify({ error: "Database query failed: " + (queryError as Error).message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to fetch check-ins: " + (e as Error).message }), { status: 500 });
  }
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  try {
    const authHeader = request.headers.get("Authorization");
    // Basic auth check - in real app use middleware
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const tenantId = await getTenantId(env, request);
    const body = (await request.json().catch(() => ({} as any))) as { latitude: number; longitude: number; userId: string };
    const { latitude, longitude, userId } = body;

    if (!latitude || !longitude || !userId) {
      return new Response(JSON.stringify({ error: "Missing location or user ID" }), { status: 400 });
    }

    await ensureTables(env.DB);

    // 1. Get Settings
    const settings = await env.DB.prepare("SELECT * FROM check_in_settings LIMIT 1").first();
    const radius = settings?.radius || 50; // meters
    const timeWindow = settings?.time_window || 5; // minutes

    // 2. Get Checkpoints (filter by tenant)
    const { results: checkpoints } = await env.DB.prepare("SELECT * FROM checkpoints WHERE tenant_id = ?").bind(tenantId).all();

    if (!checkpoints || checkpoints.length === 0) {
      return new Response(JSON.stringify({ error: "No checkpoints defined" }), { status: 400 });
    }

    // 3. Find nearest checkpoint
    let nearestCheckpoint: any = null;
    let minDistance = Infinity;

    for (const cp of checkpoints) {
      const dist = getDistanceFromLatLonInKm(latitude, longitude, cp.latitude as number, cp.longitude as number);
      if (dist < minDistance) {
        minDistance = dist;
        nearestCheckpoint = cp;
      }
    }

    // 4. Validate Geofence
    if (minDistance > radius) {
      return new Response(
        JSON.stringify({
          error: `You are too far from any checkpoint. Nearest is ${Math.round(minDistance)}m away (Max ${radius}m).`,
        }),
        { status: 400 }
      );
    }

    // 5. Validate Rate Limit
    const timeWindowMs = timeWindow * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeWindowMs).toISOString();

    const lastCheckIn = await env.DB.prepare(
      `
      SELECT timestamp FROM check_in_logs 
      WHERE tenant_id = ? AND user_id = ? AND checkpoint_id = ? AND timestamp > ?
      ORDER BY timestamp DESC LIMIT 1
    `
    )
      .bind(tenantId, userId, nearestCheckpoint.id, cutoffTime)
      .first();

    if (lastCheckIn) {
      const lastTime = new Date(lastCheckIn.timestamp as string).getTime();
      const nextAllowed = new Date(lastTime + timeWindowMs);
      const minutesLeft = Math.ceil((nextAllowed.getTime() - Date.now()) / 60000);

      return new Response(
        JSON.stringify({
          error: `You checked in here recently. Please wait ${minutesLeft} minutes.`,
        }),
        { status: 429 }
      );
    }

    // 6. Record Check-in
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO check_in_logs (id, tenant_id, user_id, checkpoint_id, latitude, longitude, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(id, tenantId, userId, nearestCheckpoint.id, latitude, longitude, timestamp)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked in at ${nearestCheckpoint.name}`,
        checkpoint: nearestCheckpoint.name,
        timestamp,
      }),
      {
        headers: { "content-type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Check-in failed: " + (e as Error).message }), { status: 500 });
  }
}

async function ensureTables(db: any) {
  await db
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS check_in_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      user_id TEXT,
      checkpoint_id TEXT,
      latitude REAL,
      longitude REAL,
      timestamp TEXT
    )
  `
    )
    .run();

  // Ensure settings table too just in case
  await db
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS check_in_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      radius INTEGER,
      time_window INTEGER,
      updated_at TEXT
    )
  `
    )
    .run();

  // Ensure checkpoints table to avoid JOIN failures
  await db
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT,
      updated_at TEXT
    )
  `
    )
    .run();
}
