/* POST /api/book
   Crea la reserva tras validar entrada, anti-spam y re-comprobar el hueco. */
import { TIMEZONE, SEND_UPDATES, SERVICES, serviceConfig, DEFAULT_SERVICE } from '../_lib/config.js';
import { parseYmd, parseHm, zonedToUtc } from '../_lib/time.js';
import { getAccessToken, freeBusy, insertEvent } from '../_lib/google.js';
import { isSlotBookable } from '../_lib/slots.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // sin secret configurado, no bloquea (dev)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token || '', remoteip: ip || '' }),
  });
  const data = await res.json().catch(() => ({ success: false }));
  return !!data.success;
}

function clean(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max);
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'INVALID_INPUT' }, 400);

    const date = parseYmd(body.date);
    const hm = parseHm(body.time);
    const name = clean(body.name, 120);
    const phone = clean(body.phone, 40);
    const email = clean(body.email, 160);
    const notes = clean(body.notes, 1000);
    const service = body.service in SERVICES ? body.service : DEFAULT_SERVICE;

    if (!date || !hm || !name || !phone) return json({ error: 'INVALID_INPUT' }, 400);
    if (email && !EMAIL_RE.test(email)) return json({ error: 'INVALID_INPUT', detail: 'email' }, 400);

    const ip = request.headers.get('cf-connecting-ip') || '';
    if (!(await verifyTurnstile(env, body.antispamToken, ip))) {
      return json({ error: 'SPAM_REJECTED' }, 403);
    }

    const { durationMin, location } = serviceConfig(service);
    const now = new Date();

    const token = await getAccessToken(env);

    // Re-comprobar disponibilidad del hueco concreto (evita doble reserva).
    const start = zonedToUtc(date.year, date.month, date.day, hm.hour, hm.minute, TIMEZONE);
    const end = new Date(start.getTime() + durationMin * 60000);
    const busy = await freeBusy(env, token, start.toISOString(), end.toISOString());
    if (!isSlotBookable(date, body.time, durationMin, busy, now)) {
      return json({ error: 'SLOT_TAKEN' }, 409);
    }

    const description = [
      `Servicio: ${service}`,
      `Nombre: ${name}`,
      `Teléfono: ${phone}`,
      email ? `Email: ${email}` : null,
      notes ? `Notas: ${notes}` : null,
      'Origen: web unaovejafeliz',
    ].filter(Boolean).join('\n');

    const event = {
      summary: `Reserva · ${service} — ${name}`,
      description,
      location,
      start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
      reminders: { useDefault: true },
      extendedProperties: { private: { service, phone, source: 'web' } },
    };
    // Solo añadimos asistente si la vía de auth puede notificar (evita fallos en Gmail personal).
    if (SEND_UPDATES === 'all' && email) event.attendees = [{ email }];

    const created = await insertEvent(env, token, event, SEND_UPDATES);
    return json({ ok: true, eventId: created.id, htmlLink: created.htmlLink });
  } catch (err) {
    return json({ error: 'SERVER_ERROR', detail: String(err && err.message || err) }, 500);
  }
}
