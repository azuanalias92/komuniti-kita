import { hasPermission, getTenantId, getUserFromToken } from '../_lib/auth';

export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database } }) {
  // Only admins/owners can generate invites
  if (!(await hasPermission(env, request, '/users', 'create'))) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const tenantId = getTenantId(request);
  const user = getUserFromToken(request);

  try {
    const body = await request.json();
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const maxUses = typeof body.maxUses === 'number' ? body.maxUses : 0;
    const expiresInHours = typeof body.expiresInHours === 'number' ? body.expiresInHours : 0;

    // Ensure schema
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS tenant_invites (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        created_by TEXT,
        max_uses INTEGER DEFAULT 0,
        use_count INTEGER DEFAULT 0,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ).run();

    // Generate a unique 8-char uppercase code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      attempts++;
      const existing = await env.DB.prepare(
        `SELECT id FROM tenant_invites WHERE code = ?`
      ).bind(code).first();
      if (!existing) break;
    } while (attempts < 10);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = expiresInHours > 0
      ? new Date(Date.now() + expiresInHours * 3600000).toISOString()
      : null;

    await env.DB.prepare(
      `INSERT INTO tenant_invites (id, tenant_id, code, description, created_by, max_uses, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, tenantId, code, description, user?.id || null, maxUses, expiresAt, now, now).run();

    return new Response(JSON.stringify({
      id,
      code,
      description,
      maxUses,
      expiresAt,
      createdAt: now,
    }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'failed_to_generate_invite' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function onRequestGet({ request, env }: { request: Request; env: { DB: D1Database } }) {
  if (!(await hasPermission(env, request, '/users', 'read'))) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const tenantId = getTenantId(request);

  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS tenant_invites (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        created_by TEXT,
        max_uses INTEGER DEFAULT 0,
        use_count INTEGER DEFAULT 0,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ).run();

    const invites = await env.DB.prepare(
      `SELECT id, code, description, max_uses, use_count, expires_at, is_active, created_at
       FROM tenant_invites
       WHERE tenant_id = ?
       ORDER BY created_at DESC`
    ).bind(tenantId).all();

    return new Response(JSON.stringify(invites.results || []), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'failed_to_list_invites' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function onRequestDelete({ request, env }: { request: Request; env: { DB: D1Database } }) {
  if (!(await hasPermission(env, request, '/users', 'delete'))) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const tenantId = getTenantId(request);
  const url = new URL(request.url);
  const inviteId = url.searchParams.get('id');

  if (!inviteId) {
    return new Response(JSON.stringify({ error: 'missing_invite_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    await env.DB.prepare(
      `UPDATE tenant_invites SET is_active = 0, updated_at = ?
       WHERE id = ? AND tenant_id = ?`
    ).bind(new Date().toISOString(), inviteId, tenantId).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'failed_to_disable_invite' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
