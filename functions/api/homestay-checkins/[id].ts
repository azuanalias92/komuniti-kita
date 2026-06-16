import { hasPermission, getTenantId } from '../_lib/auth'

export async function onRequestPut({ env, request, params }: { env: { DB: D1Database }; request: Request; params: { id: string } }) {
  try {
    if (!(await hasPermission(env, request, "/check-in-logs", "update"))) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const tenantId = getTenantId(request);
    const id = params.id;
    const body = await request.json();

    if (!body.personInCharge || !body.numberOfGuests) {
      return new Response(JSON.stringify({ error: "personInCharge and numberOfGuests are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const personInCharge = String(body.personInCharge).trim();
    const numberOfGuests = Number(body.numberOfGuests);
    const plates = Array.isArray(body.numberPlates)
      ? body.numberPlates.map((p: unknown) => String(p || "").trim()).filter(Boolean)
      : String(body.numberPlates || "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
    const arrival = body.dateOfArrival ? String(body.dateOfArrival) : null;
    const departure = body.dateOfDeparture ? String(body.dateOfDeparture) : null;
    const notes = body.additionalNotes ? String(body.additionalNotes) : null;

    const updateSql = `
      UPDATE homestay_checkins
      SET person_in_charge = ?, number_of_guests = ?, number_plates = ?, date_of_arrival = ?, date_of_departure = ?, additional_notes = ?
      WHERE id = ? AND tenant_id = ?
    `;

    await env.DB.prepare(updateSql).bind(personInCharge, numberOfGuests, JSON.stringify(plates), arrival, departure, notes, id, tenantId).run();

    const updated = {
      id,
      personInCharge,
      numberOfGuests,
      numberPlates: plates,
      dateOfArrival: arrival || undefined,
      dateOfDeparture: departure || undefined,
      additionalNotes: notes || undefined,
    };

    return Response.json(updated);
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed to update check-in" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
