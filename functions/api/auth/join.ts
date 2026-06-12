import { sha256, generateToken } from '../_lib/auth';

export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database; JWT_SECRET?: string } }) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await request.json();
  const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!inviteCode || !email || !password || password.length < 7) {
    return new Response(JSON.stringify({ error: 'invalid_input' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
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

    // Look up invite code
    const invite = await env.DB.prepare(
      `SELECT id, tenant_id, max_uses, use_count, expires_at, is_active
       FROM tenant_invites WHERE code = ?`
    ).bind(inviteCode).first() as Record<string, unknown> | null;

    if (!invite) {
      return new Response(JSON.stringify({ error: 'invalid_invite_code' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Validate invite
    if (!Number(invite.is_active)) {
      return new Response(JSON.stringify({ error: 'invite_code_disabled' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }

    const maxUses = Number(invite.max_uses || 0);
    const useCount = Number(invite.use_count || 0);
    if (maxUses > 0 && useCount >= maxUses) {
      return new Response(JSON.stringify({ error: 'invite_code_exhausted' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (invite.expires_at) {
      const expiresAt = new Date(String(invite.expires_at));
      if (expiresAt < new Date()) {
        return new Response(JSON.stringify({ error: 'invite_code_expired' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    const tenantId = String(invite.tenant_id);

    // Look up tenant name
    const tenant = await env.DB.prepare(
      `SELECT name, slug FROM tenants WHERE id = ?`
    ).bind(tenantId).first() as { name: string; slug: string } | null;

    // Ensure users table
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

    // Check if user already exists in this tenant
    const existingUser = await env.DB.prepare(
      `SELECT id FROM users WHERE tenant_id = ? AND email = ?`
    ).bind(tenantId, email).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'user_already_in_tenant' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Create user in this tenant
    const userId = crypto.randomUUID();
    const username = email.split('@')[0];
    const now = new Date().toISOString();
    const passwordHash = await sha256(password);
    await env.DB.prepare(
      `INSERT INTO users (id, tenant_id, username, email, status, role, password_hash, password_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 'user', ?, ?, ?, ?)`
    ).bind(userId, tenantId, username, email, passwordHash, now, now, now).run();

    // Increment invite usage
    await env.DB.prepare(
      `UPDATE tenant_invites SET use_count = use_count + 1, updated_at = ? WHERE id = ?`
    ).bind(now, String(invite.id)).run();

    // Generate token
    const jwtSecret = env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const accessToken = await generateToken(
      {
        sub: userId,
        email,
        role: ['user'],
        tenantId,
        tenantName: tenant?.name || 'Community',
      },
      jwtSecret
    );

    const user = {
      accountNo: userId,
      email,
      role: ['user'],
      tenantId,
      tenantName: tenant?.name || 'Community',
      tenantSlug: tenant?.slug || '',
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };

    return new Response(JSON.stringify({ user, accessToken }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'join_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
