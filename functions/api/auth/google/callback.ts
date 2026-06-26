function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=')
    out[name] = decodeURIComponent(rest.join('='))
  }
  return out
}

function base64UrlDecode<T = Record<string, unknown>>(str: string): T | null {
  try {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad
    const json = atob(b64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function generateToken(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const tokenPayload = { ...payload, iat: now, exp: now + 86400 }

  const base64url = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const data = `${base64url(header)}.${base64url(tokenPayload)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${data}.${sigB64}`
}

export async function onRequestGet({ request, env }: { request: Request; env: { DB: any; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; JWT_SECRET?: string; SUPER_ADMIN_EMAIL?: string } }) {
  try {
    return await handleCallback({ request, env })
  } catch (e) {
    return new Response(`Callback error: ${e instanceof Error ? e.message : String(e)}\n${e instanceof Error ? e.stack : ''}`, {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    })
  }
}

async function handleCallback({ request, env }: { request: Request; env: { DB: any; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; JWT_SECRET?: string; SUPER_ADMIN_EMAIL?: string } }) {
  const url = new URL(request.url)
  const origin = url.origin
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''
  const cookies = parseCookies(request.headers.get('cookie'))
  if (!code || !state || !cookies.oauth_state || state !== cookies.oauth_state) {
    return new Response('Invalid OAuth state', { status: 400 })
  }
  const verifier = cookies.oauth_verifier || ''
  const clientId = env.GOOGLE_CLIENT_ID || ''
  const clientSecret = env.GOOGLE_CLIENT_SECRET || ''
  const redirectUri = `${origin}/api/auth/google/callback`
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'missing_credentials' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return new Response(`Token exchange failed: ${text}`, { status: 400 })
  }
  const tokenJson = await tokenRes.json()
  const idToken = tokenJson.id_token as string

  let userEmail = ''
  let userName = ''
  if (idToken) {
    const parts = idToken.split('.')
    const payload = parts[1] ? (base64UrlDecode(parts[1]) as Record<string, unknown>) : null
    userEmail = (payload?.email as string) || ''
    userName = (payload?.name as string) || ''
  }

  if (!userEmail) {
    return new Response('Could not get email from Google', { status: 400 })
  }

  const jwtSecret = env.JWT_SECRET || 'demo-jwt-secret-komuniti-kita-2026'

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
  ).run()

  // — Super admin bypass —
  // If this email matches SUPER_ADMIN_EMAIL, skip invite/approval flow entirely
  // and grant access to all tenants.
  const isSuperAdmin = env.SUPER_ADMIN_EMAIL && userEmail === env.SUPER_ADMIN_EMAIL

  if (isSuperAdmin) {
    const now = new Date().toISOString()
    const normalizedEmail = userEmail.trim().toLowerCase()
    const username = normalizedEmail.split('@')[0] || 'super-admin'

    await env.DB.prepare(
      `INSERT INTO users (
        id,
        tenant_id,
        username,
        email,
        status,
        role,
        created_at,
        updated_at
      ) VALUES ('super-admin', 'default', ?, ?, 'active', 'super_admin', ?, ?)
      ON CONFLICT(tenant_id, email) DO UPDATE SET
        id = 'super-admin',
        role = 'super_admin',
        status = 'active',
        updated_at = excluded.updated_at`
    ).bind(username, normalizedEmail, now, now).run()

    const { results: allTenants } = await env.DB.prepare(
      `SELECT id, name, slug FROM tenants ORDER BY name`
    ).all() as { results: { id: string; name: string; slug: string }[] | null }

    const tenantList = allTenants || []

    const accessToken = await generateToken(
      { sub: 'super-admin', email: userEmail, role: ['super_admin'], tenantId: '*', tenantName: 'All Communities' },
      jwtSecret
    )

    const user = {
      accountNo: 'super-admin',
      email: userEmail,
      role: ['super_admin'],
      tenantId: '*',
      tenantName: 'All Communities',
      tenantSlug: '*',
      exp: Date.now() + 24 * 60 * 60 * 1000,
      name: userName || 'Super Admin',
      tenants: tenantList,
    }

    const headers = new Headers({ Location: `${origin}/` })
    headers.append('Set-Cookie', `thisisjustarandomstring=${encodeURIComponent(JSON.stringify(accessToken))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`)
    headers.append('Set-Cookie', `auth_user=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`)
    headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0')
    headers.append('Set-Cookie', 'oauth_verifier=; Path=/; Max-Age=0')
    return new Response(null, { status: 302, headers })
  }

  // Look up user by email (across any tenant)
  const userRow = await env.DB.prepare(
    `SELECT id, tenant_id, username, email, first_name, last_name, status, role FROM users WHERE email = ? LIMIT 1`
  ).bind(userEmail).first() as Record<string, unknown> | null

  if (userRow) {
    // User exists — sign them in
    const tenantId = String(userRow.tenant_id || 'default')
    const role = String(userRow.role || 'user')

    // Get tenant name
    const tenant = await env.DB.prepare(
      `SELECT name, slug FROM tenants WHERE id = ?`
    ).bind(tenantId).first() as { name: string; slug: string } | null

    const accessToken = await generateToken(
      { sub: String(userRow.id), email: userEmail, role: [role], tenantId, tenantName: tenant?.name || 'Community' },
      jwtSecret
    )

    const user = {
      accountNo: String(userRow.id),
      email: userEmail,
      role: [role],
      tenantId,
      tenantName: tenant?.name || 'Community',
      tenantSlug: tenant?.slug || '',
      exp: Date.now() + 24 * 60 * 60 * 1000,
      name: userName || String(userRow.first_name || '') || String(userRow.username || ''),
    }

    const headers = new Headers({ Location: `${origin}/` })
    headers.append('Set-Cookie', `thisisjustarandomstring=${encodeURIComponent(JSON.stringify(accessToken))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`)
    headers.append('Set-Cookie', `auth_user=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`)
    headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0')
    headers.append('Set-Cookie', 'oauth_verifier=; Path=/; Max-Age=0')
    return new Response(null, { status: 302, headers })
  }

  // Check if user has a pending approval
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
  ).run()

  const pending = await env.DB.prepare(
    `SELECT id, status FROM pending_approvals WHERE email = ? AND status = 'pending'`
  ).bind(userEmail).first() as Record<string, unknown> | null

  let redirectUrl = ''
  if (pending) {
    // Pending approval — tell user to wait
    redirectUrl = `${origin}/sign-in?error=approval_pending`
  } else {
    // First time — user needs an invite code. Redirect back to sign-in with invite code form
    redirectUrl = `${origin}/sign-in?new_user=true&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}`
  }

  const clearHeaders = new Headers({ Location: redirectUrl })
  clearHeaders.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0')
  clearHeaders.append('Set-Cookie', 'oauth_verifier=; Path=/; Max-Age=0')
  return new Response(null, { status: 302, headers: clearHeaders })
}
