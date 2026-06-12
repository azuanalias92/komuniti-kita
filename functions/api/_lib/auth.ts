// Shared auth + tenant utilities for Cloudflare Pages Functions

/**
 * Extract tenant_id from the Authorization header JWT.
 * Returns the tenant_id or 'default' fallback.
 */
export function getTenantId(request: Request): string {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    const tenantHeader = request.headers.get("X-Tenant-ID") || "default";
    return tenantHeader;
  }
  try {
    const token = authHeader.replace("Bearer ", "");
    // Decode JWT payload (base64url)
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.tenantId || payload.tenant_id || "default";
  } catch {
    return request.headers.get("X-Tenant-ID") || "default";
  }
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
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub || payload.id || "",
      email: payload.email || "",
      role: Array.isArray(payload.role) ? payload.role : [payload.role || "admin"],
      tenantId: payload.tenantId || payload.tenant_id || "default",
    };
  } catch {
    return null;
  }
}

/**
 * Check if a user has permission for a given resource + action.
 */
export async function hasPermission(
  env: { DB: D1Database },
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
