import { hasPermission, getTenantId } from '../_lib/auth'

export async function onRequestPatch({ request, params, env }: {
  request: Request
  params: { userId: string }
  env: { DB: D1Database }
}) {
  try {
    // Check permission
    if (!(await hasPermission(env, request, '/users', 'update'))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' }
      })
    }

    const tenantId = getTenantId(request);

    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    const body = await request.json()
    const { role } = body

    const validRoles = ['admin', 'owner', 'guard']
    if (!role || !validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'invalid_role' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    const now = new Date().toISOString()
    const stmt = env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
    await stmt.bind(role, now, params.userId, tenantId).run()

    return new Response(JSON.stringify({ success: true, role }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    return new Response(JSON.stringify({ error: 'internal_server_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}
