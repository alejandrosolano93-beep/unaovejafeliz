/* ============================================================
   Utilidades de tiempo con zona horaria (sin dependencias).
   Los Workers no traen date-fns/luxon; usamos Intl para resolver
   el offset real de la zona (respeta DST).
   ============================================================ */

/* Offset (ms) de `timeZone` para un instante UTC dado. */
function tzOffsetMs(utcMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(new Date(utcMs))) p[type] = value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - utcMs;
}

/* Convierte una hora de pared (año/mes/día/HH:MM) en `timeZone` a un
   instante UTC (Date). month es 1-based. */
export function zonedToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(guess, timeZone);
  // segunda pasada por si el guess cayó en un salto de DST
  const offset2 = tzOffsetMs(guess - offset, timeZone);
  return new Date(guess - offset2);
}

/* Partes de fecha local en `timeZone` para un instante dado. */
export function partsInTz(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value;
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour, minute: +p.minute, weekday: wd,
  };
}

export function ymd(year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

export function parseHm(s) {
  const m = /^(\d{2}):(\d{2})$/.exec(s || '');
  if (!m) return null;
  return { hour: +m[1], minute: +m[2] };
}

/* Itera los días (YMD) del rango [from, to] inclusive. */
export function eachDay(from, to) {
  const out = [];
  let d = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  while (d <= end) {
    const dt = new Date(d);
    out.push({ year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() });
    d += 86400000;
  }
  return out;
}
