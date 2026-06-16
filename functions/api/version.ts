export async function onRequestGet({ env }: { env: { DB: any } }) {
  try {
    const row = await env.DB.prepare(
      "SELECT version FROM app_version WHERE id = 1"
    ).first();
    return new Response(JSON.stringify({ version: (row as any)?.version ?? 0 }), {
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ version: 0 }), {
      headers: { "content-type": "application/json" },
    });
  }
}
