import { sha256, generateToken } from "../_lib/auth";

export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database; JWT_SECRET?: string } }) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "invalid_content_type" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Fallback: no DB available (dev mode)
  if (!env || !(env as any).DB || typeof (env as any).DB.prepare !== "function") {
    const localId = email ? email.split("@")[0] : "user";
    const user = {
      accountNo: localId,
      email,
      role: ["admin"],
      tenantId: "default",
      tenantName: "KomunitiKita",
      tenantSlug: "komuniti-kita",
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    const jwtSecret = env.JWT_SECRET || "dev-jwt-secret-change-in-production";
    const accessToken = await generateToken(
      {
        sub: localId,
        email,
        role: ["admin"],
        tenantId: "default",
        tenantName: "KomunitiKita",
      },
      jwtSecret
    );
    return new Response(JSON.stringify({ user, accessToken }), {
      headers: { "content-type": "application/json" },
    });
  }

  // Ensure schema
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      settings TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      username TEXT,
      email TEXT,
      first_name TEXT,
      last_name TEXT,
      phone_number TEXT,
      status TEXT,
      role TEXT,
      password_hash TEXT,
      password_updated_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(tenant_id, email)
    )`
  ).run();

  const selectSql = `SELECT id, tenant_id, username, email, first_name, last_name, phone_number, status, role, password_hash FROM users WHERE email = ?`;
  let row = (await env.DB.prepare(selectSql).bind(email).first()) as Record<string, unknown> | null;

  if (!row) {
    // Check if user has a pending approval
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS pending_approvals (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        invite_code TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ).run();

    const pending = await env.DB.prepare(
      `SELECT id, status FROM pending_approvals WHERE email = ? AND status = 'pending'`
    ).bind(email).first() as Record<string, unknown> | null;

    if (pending) {
      return new Response(JSON.stringify({ error: 'approval_pending' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Auto-create user with default tenant
    const tenantId = "default";
    await env.DB.prepare(
      `INSERT OR IGNORE INTO tenants (id, name, slug, settings, created_at, updated_at)
       VALUES ('default', 'KomunitiKita', 'komuniti-kita', '{}', datetime('now'), datetime('now'))`
    ).run();

    const id = crypto.randomUUID();
    const username = email.split("@")[0];
    const now = new Date().toISOString();
    const passwordHash = await sha256(password);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, tenant_id, username, email, status, role, password_hash, password_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 'admin', ?, ?, ?, ?)`
    ).bind(id, tenantId, username, email, passwordHash, now, now, now).run();
    row = (await env.DB.prepare(selectSql).bind(email).first()) as Record<string, unknown> | null;
    if (!row) {
      return new Response(JSON.stringify({ error: "invalid_credentials" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const hash = await sha256(password);
  if (String(row.password_hash || "") !== hash) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const tenantId = String(row.tenant_id || "default");

  // Get tenant name
  const tenant = await env.DB.prepare(
    `SELECT name, slug FROM tenants WHERE id = ?`
  ).bind(tenantId).first() as { name: string; slug: string } | null;

  const jwtSecret = env.JWT_SECRET || "dev-jwt-secret-change-in-production";
  const accessToken = await generateToken(
    {
      sub: String(row.id || ""),
      email: String(row.email || email),
      role: [String(row.role || "owner")],
      tenantId,
      tenantName: tenant?.name || "KomunitiKita",
    },
    jwtSecret
  );

  const user = {
    accountNo: String(row.id || ""),
    email: String(row.email || email),
    role: [String(row.role || "owner")],
    tenantId,
    tenantName: tenant?.name || "KomunitiKita",
    tenantSlug: tenant?.slug || "komuniti-kita",
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };

  return new Response(JSON.stringify({ user, accessToken }), {
    headers: { "content-type": "application/json" },
  });
}
