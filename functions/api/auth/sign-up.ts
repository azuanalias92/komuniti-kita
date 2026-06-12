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
  const tenantName = typeof body.tenantName === "string" ? body.tenantName : email.split("@")[0] + "'s Community";

  if (!email || !password || password.length < 7) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
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

    // Create tenant
    const tenantId = crypto.randomUUID();
    const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") + "-community";
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO tenants (id, name, slug, settings, created_at, updated_at)
       VALUES (?, ?, ?, '{}', ?, ?)`
    ).bind(tenantId, tenantName, slug, now, now).run();

    // Create user table with tenant_id
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

    const userId = crypto.randomUUID();
    const username = email.split("@")[0];
    const passwordHash = await sha256(password);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, tenant_id, username, email, status, role, password_hash, password_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 'owner', ?, ?, ?, ?)`
    ).bind(userId, tenantId, username, email, passwordHash, now, now, now).run();

    // Ensure default roles for this tenant
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        description TEXT,
        start_page TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(tenant_id, name)
      )`
    ).run();

    // Seed default roles
    const defaultRoles = [
      { name: "owner", desc: "Full access to all features" },
      { name: "admin", desc: "Administrative access" },
      { name: "user", desc: "Basic user access" },
    ];
    for (const r of defaultRoles) {
      const roleId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO roles (id, tenant_id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(roleId, tenantId, r.name, r.desc, now, now).run();
    }

    const jwtSecret = env.JWT_SECRET || "dev-jwt-secret-change-in-production";
    const accessToken = await generateToken(
      {
        sub: userId,
        email,
        role: ["owner"],
        tenantId,
        tenantName,
      },
      jwtSecret
    );

    const user = {
      accountNo: userId,
      email,
      role: ["owner"],
      tenantId,
      tenantName,
      tenantSlug: slug,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };

    return new Response(JSON.stringify({ user, accessToken }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "signup_failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
