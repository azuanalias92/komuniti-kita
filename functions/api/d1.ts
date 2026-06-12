import { getTenantId } from './_lib/auth'

export async function onRequestGet({ env, request }: { env: { DB: D1Database }; request: Request }) {
  const tenantId = getTenantId(request);
  const row = await env.DB.prepare("select 1 as ok").first()
  return new Response(JSON.stringify({ ok: row?.ok === 1, tenantId }), {
    headers: { "content-type": "application/json" }
  })
}

interface D1Database {
  prepare: (query: string) => {
    first: <T = unknown>() => Promise<T | null>
  }
}
