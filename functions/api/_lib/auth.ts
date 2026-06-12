// Shared auth + tenant utilities for Cloudflare Pages Functions

type TokenPayload = {
  sub?: string;
  id?: string;
  email?: string;
  role?: string | string[];
  tenantId?: string;
  tenant_id?: string;
};

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    return JSON.parse(atob(token.split(".")[1])) as TokenPayload;
  } catch {
    return null;
  }
}

function getRoles(payload: TokenPayload | null): string[] {
  if (!payload?.role) return [];
  return Array.isArray(payload.role) ? payload.role : [payload.role];
}

function isSuperAdminRole(role: string | undefined): boolean {
  return role === "super_admin" || role === "superadmin";
}

export function isAllTenantsScope(tenantId: string): boolean {
  return tenantId === "*";
}

export function addTenantFilter(
  where: string[],
  params: unknown[],
  tenantId: string,
  column = "tenant_id"
) {
  if (isAllTenantsScope(tenantId)) return;
  where.push(`${column} = ?`);
  params.push(tenantId);
}

/**
 * Extract tenant_id from the Authorization header JWT.
 * Returns the tenant_id or 'default' fallback.
 */
export function getTenantId(request: Request): string {
  const tenantHeader = request.headers.get("X-Tenant-ID") || "";
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return tenantHeader || "default";
  }
  const token = authHeader.replace("Bearer ", "");
  const payload = decodeTokenPayload(token);
  if (!payload) {
    return tenantHeader || "default";
  }

  const roles = getRoles(payload);
  const tokenTenantId = String(payload.tenantId || payload.tenant_id || "");
  const isWildcardTenant = tokenTenantId === "*";
  const isSuperAdmin = roles.some(isSuperAdminRole);

  if ((isSuperAdmin || isWildcardTenant) && tenantHeader) {
    return tenantHeader;
  }

  return tokenTenantId || tenantHeader || "default";
}

/**
 * Extract user info from the Authorization header JWT.
 */
export function getUserFromToken(request: Request): {
  id: string;
  email: string;
  role: string[];
  tenantId: string;
} | null {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    if (token === "mock-access-token") {
      // Fallback for dev: read from X-User headers
      return {
        id: request.headers.get("X-User-ID") || "",
        email: request.headers.get("X-User-Email") || "",
        role: (request.headers.get("X-User-Role") || "admin").split(","),
        tenantId: getTenantId(request),
      };
    }
    const payload = decodeTokenPayload(token);
    if (!payload) return null;
    return {
      id: payload.sub || payload.id || "",
      email: payload.email || "",
      role: getRoles(payload).length ? getRoles(payload) : ["admin"],
      tenantId: getTenantId(request),
    };
  } catch {
    return null;
  }
}

/**
 * Check if a user has permission for a given resource + action.
 */
export async function hasPermission(
  env: { DB: any },
  request: Request,
  resource: string,
  action: "create" | "read" | "update" | "delete"
): Promise<boolean> {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;

  const token = authHeader.replace("Bearer ", "");
  // Dev bypass for testing
  if (token === "mock-access-token") return true;

  const user = getUserFromToken(request);
  if (!user) return false;

  const roleName = Array.isArray(user.role) ? user.role[0] : user.role;
  if (isSuperAdminRole(roleName)) return true;

  try {
    // Ensure schema
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
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        resource TEXT,
        can_create INTEGER,
        can_read INTEGER,
        can_update INTEGER,
        can_delete INTEGER,
        PRIMARY KEY (role_id, resource)
      )`
    ).run();

    const role = await env.DB.prepare(
      `SELECT id FROM roles WHERE tenant_id = ? AND name = ?`
    ).bind(user.tenantId, roleName).first();

    if (!role) return false;

    const perm = await env.DB.prepare(
      `SELECT can_create, can_read, can_update, can_delete
       FROM role_permissions
       WHERE role_id = ? AND resource = ?`
    ).bind((role as any).id, resource).first();

    if (!perm) return false;

    const actionMap: Record<string, string> = {
      create: "can_create",
      read: "can_read",
      update: "can_update",
      delete: "can_delete",
    };
    return !!(perm as any)[actionMap[action]];
  } catch {
    return false;
  }
}

/**
 * Generate a simple signed JWT for tenant-aware auth claims.
 * Uses HMAC-SHA256 with a secret key.
 */
export async function generateToken(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + 86400, // 24 hours
  };

  const base64url = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const data = `${base64url(header)}.${base64url(tokenPayload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${sigB64}`;
}
