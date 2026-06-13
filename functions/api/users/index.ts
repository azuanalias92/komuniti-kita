import { addTenantFilter, hasPermission, getTenantId } from '../_lib/auth'
import { hashPassword } from '../_lib/password'

async function ensureSchema(env: { DB: any }) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      username TEXT,
      email TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      phone_number TEXT,
      status TEXT,
      role TEXT,
      password_hash TEXT,
      password_updated_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )`
  ).run();
}

export async function onRequestGet({ request, env }: { request: Request; env: { DB: any } }) {
  if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== "function") {
    return new Response(JSON.stringify({ data: [], page: 1, pageSize: 10, total: 0 }), {
      status: 204,
      headers: { "content-type": "application/json" },
    });
  }
  await ensureSchema(env);

  // Check permission
  if (!(await hasPermission(env, request, "/users", "read"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const tenantId = getTenantId(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || "10")));
  const username = url.searchParams.get("username") || "";
  const statuses = url.searchParams.getAll("status");
  const roles = url.searchParams.getAll("role");

  const where: string[] = [];
  const bind: any[] = [];
  addTenantFilter(where, bind, tenantId);
  if (username) {
    where.push("(username LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)");
    bind.push(`%${username}%`, `%${username}%`, `%${username}%`, `%${username}%`);
  }
  if (statuses.length > 0) {
    where.push(`status IN (${statuses.map(() => "?").join(",")})`);
    bind.push(...statuses);
  }
  if (roles.length > 0) {
    where.push(`role IN (${roles.map(() => "?").join(",")})`);
    bind.push(...roles);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const offset = (page - 1) * pageSize;
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM users ${whereSql}`)
    .bind(...bind)
    .first();
  const total = Number((totalRow as any)?.cnt || 0);
  if (total === 0) {
    return new Response(JSON.stringify({ data: [], page, pageSize, total }), {
      headers: { "content-type": "application/json" },
    });
  }

  const rows = await env.DB.prepare(
    `SELECT id, username, email, first_name, last_name, phone_number, status, role, created_at, updated_at
     FROM users ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...bind, pageSize, offset)
    .all();

  const data = (rows.results || []).map((r: any) => ({
    id: String(r.id || ""),
    username: String(r.username || ""),
    email: String(r.email || ""),
    firstName: String(r.first_name || ""),
    lastName: String(r.last_name || ""),
    phoneNumber: String(r.phone_number || ""),
    status: String(r.status || "active"),
    role: String(r.role || "owner"),
    createdAt: String(r.created_at || new Date().toISOString()),
    updatedAt: String(r.updated_at || new Date().toISOString()),
  }));

  return new Response(JSON.stringify({ data, page, pageSize, total }), {
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost({ request, env }: { request: Request; env: { DB: any } }) {
  try {
    if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== 'function') {
      return new Response(JSON.stringify({ error: 'db_unavailable' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
    await ensureSchema(env)

    if (!(await hasPermission(env, request, '/users', 'create'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const tenantId = getTenantId(request);
    const body = await request.json().catch(() => ({} as any))
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : ''
    const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'owner'
    const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'active'
    const password = typeof body.password === 'string' ? body.password.trim() : ''

    if (!username) {
      return new Response(JSON.stringify({ error: 'invalid_username' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'invalid_email' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const exists = await env.DB.prepare('SELECT id FROM users WHERE tenant_id = ? AND (lower(email) = lower(?) OR lower(username) = lower(?))')
      .bind(tenantId, email, username)
      .first()
    if (exists) {
      return new Response(JSON.stringify({ error: 'user_exists' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const passwordHash = password ? await hashPassword(password) : null

    const ok = await env.DB.prepare(
      `INSERT INTO users (id, tenant_id, username, email, first_name, last_name, phone_number, status, role, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, tenantId, username, email, firstName, lastName, phoneNumber, status, role, passwordHash, now, now)
      .run()

    if (!ok.success) {
      return new Response(JSON.stringify({ error: 'create_failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    const user = {
      id,
      username,
      email,
      firstName,
      lastName,
      phoneNumber,
      status,
      role,
      createdAt: now,
      updatedAt: now,
    }
    return new Response(JSON.stringify(user), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
