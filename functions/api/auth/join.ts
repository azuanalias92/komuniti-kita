export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database } }) {
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

  if (!inviteCode || !email) {
    return new Response(JSON.stringify({ error: 'invalid_input' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    // Ensure schemas
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

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS pending_approvals (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        invite_code TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT,
        username TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TEXT,
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

    // Check if there's already a pending approval for this email + tenant
    const existingRequest = await env.DB.prepare(
      `SELECT id, status FROM pending_approvals WHERE tenant_id = ? AND email = ?`
    ).bind(tenantId, email).first() as Record<string, unknown> | null;

    if (existingRequest) {
      const status = String(existingRequest.status || '');
      if (status === 'pending') {
        return new Response(JSON.stringify({ error: 'approval_already_pending' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        });
      }
      // If rejected, allow re-requesting
      if (status === 'rejected') {
        const username = email.split('@')[0];
        const now = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE pending_approvals SET status = 'pending', username = ?, updated_at = ?, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?`
        ).bind(username, now, String(existingRequest.id)).run();

        return new Response(JSON.stringify({
          message: 'request_submitted',
          tenantName: tenant?.name || 'Community',
        }), {
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    // Create pending approval (no password needed — user signs in with Google)
    const id = crypto.randomUUID();
    const username = email.split('@')[0];
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO pending_approvals (id, tenant_id, invite_code, email, username, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(id, tenantId, inviteCode, email, username, now, now).run();

    return new Response(JSON.stringify({
      message: 'request_submitted',
      tenantName: tenant?.name || 'Community',
    }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'join_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
