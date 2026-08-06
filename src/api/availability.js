/* GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD&service=Zumeria
   Devuelve los huecos libres por día. */
import { TIMEZONE, MAX_ADVANCE_DAYS, serviceConfig, DEFAULT_SERVICE } from '../lib/config.js';
import { parseYmd, zonedToUtc } from '../lib/time.js';
import { getAccessToken, freeBusy } from '../lib/google.js';
import { computeAvailability } from '../lib/slots.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const from = parseYmd(url.searchParams.get('from'));
    const to = parseYmd(url.searchParams.get('to'));
    if (!from || !to) return json({ error: 'INVALID_INPUT', detail: 'from/to requeridos (YYYY-MM-DD)' }, 400);

    const service = url.searchParams.get('service') || DEFAULT_SERVICE;
    const { durationMin } = serviceConfig(service);

    // Limitar la ventana consultable.
    const now = new Date();
    const maxTo = new Date(now.getTime() + MAX_ADVANCE_DAYS * 86400000);

    const timeMin = zonedToUtc(from.year, from.month, from.day, 0, 0, TIMEZONE);
    let timeMax = zonedToUtc(to.year, to.month, to.day, 23, 59, TIMEZONE);
    if (timeMax > maxTo) timeMax = maxTo;

    const token = await getAccessToken(env);
    const busy = await freeBusy(env, token, timeMin.toISOString(), timeMax.toISOString());
    const days = computeAvailability(from, to, durationMin, busy, now);

    return json({ timezone: TIMEZONE, service, durationMin, days });
  } catch (err) {
    return json({ error: 'SERVER_ERROR', detail: String(err && err.message || err) }, 500);
  }
}
