import { hasPermission, getTenantId, getUserFromToken } from '../_lib/auth';

export async function onRequestGet({ request, env }: { request: Request; env: { DB: D1Database } }) {
  if (!(await hasPermission(env, request, '/users', 'read'))) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const tenantId = getTenantId(request);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'pending';

  try {
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

    const approvals = await env.DB.prepare(
      `SELECT id, invite_code, email, username, status, created_at
       FROM pending_approvals
       WHERE tenant_id = ? AND status = ?
       ORDER BY created_at DESC`
    ).bind(tenantId, statusFilter).all();

    return new Response(JSON.stringify(approvals.results || []), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'failed_to_list_approvals' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database } }) {
  if (!(await hasPermission(env, request, '/users', 'create'))) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const tenantId = getTenantId(request);
  const user = getUserFromToken(request);
  const url = new URL(request.url);
  const approvalId = url.searchParams.get('id');
  const action = url.searchParams.get('action') || '';

  if (!approvalId || !['approve', 'reject'].includes(action)) {
    return new Response(JSON.stringify({ error: 'invalid_request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
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

    // Get the approval
    const approval = await env.DB.prepare(
      `SELECT id, tenant_id, email, password_hash, username, invite_code
       FROM pending_approvals WHERE id = ? AND tenant_id = ? AND status = 'pending'`
    ).bind(approvalId, tenantId).first() as Record<string, unknown> | null;

    if (!approval) {
      return new Response(JSON.stringify({ error: 'approval_not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const reviewedBy = user?.id || '';

    if (action === 'reject') {
      await env.DB.prepare(
        `UPDATE pending_approvals SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ?
         WHERE id = ?`
      ).bind(reviewedBy, now, now, approvalId).run();

      return new Response(JSON.stringify({ ok: true, status: 'rejected' }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Approve — create the user
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
    await env.DB.prepare(
      `INSERT INTO users (id, tenant_id, username, email, status, role, password_hash, password_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 'user', ?, ?, ?, ?)`
    ).bind(
      userId,
      tenantId,
      String(approval.username),
      String(approval.email),
      String(approval.password_hash),
      now, now, now
    ).run();

    // Mark approval as done
    await env.DB.prepare(
      `UPDATE pending_approvals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(reviewedBy, now, now, approvalId).run();

    // Increment invite usage
    const inviteCode = String(approval.invite_code || '');
    if (inviteCode) {
      await env.DB.prepare(
        `UPDATE tenant_invites SET use_count = use_count + 1, updated_at = ? WHERE code = ?`
      ).bind(now, inviteCode).run();
    }

    return new Response(JSON.stringify({ ok: true, status: 'approved', email: approval.email }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'failed_to_process_approval' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
