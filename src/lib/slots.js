/* ============================================================
   Cálculo de huecos disponibles.
   Regla del PRD (§1.2):
     slots = (horario base + duración + granularidad + márgenes) − ocupados(freebusy)
   ============================================================ */
import {
  TIMEZONE, WEEKLY_HOURS, SLOT_INTERVAL_MIN, BUFFER_MIN, MIN_NOTICE_MIN, MAX_ADVANCE_DAYS,
} from './config.js';
import { zonedToUtc, partsInTz, parseHm, ymd, eachDay } from './time.js';

/* Genera los inicios candidatos (Date UTC) de un día según el horario. */
function candidatesForDay(dayYmd, durationMin) {
  const { year, month, day } = dayYmd;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const ranges = WEEKLY_HOURS[weekday] || [];
  const out = [];
  for (const [startStr, endStr] of ranges) {
    const s = parseHm(startStr);
    const e = parseHm(endStr);
    if (!s || !e) continue;
    const rangeStart = zonedToUtc(year, month, day, s.hour, s.minute, TIMEZONE);
    const rangeEnd = zonedToUtc(year, month, day, e.hour, e.minute, TIMEZONE);
    for (
      let t = rangeStart.getTime();
      t + durationMin * 60000 <= rangeEnd.getTime();
      t += SLOT_INTERVAL_MIN * 60000
    ) {
      out.push({ start: t, end: t + durationMin * 60000 });
    }
  }
  return out;
}

function overlapsBusy(slot, busy) {
  const buf = BUFFER_MIN * 60000;
  for (const b of busy) {
    const bs = new Date(b.start).getTime() - buf;
    const be = new Date(b.end).getTime() + buf;
    if (slot.start < be && slot.end > bs) return true;
  }
  return false;
}

/* Devuelve { 'YYYY-MM-DD': ['HH:MM', …] } libre en el rango. */
export function computeAvailability(fromYmd, toYmd, durationMin, busy, now = new Date()) {
  const minStart = now.getTime() + MIN_NOTICE_MIN * 60000;
  const maxStart = now.getTime() + MAX_ADVANCE_DAYS * 86400000;
  const days = {};
  for (const d of eachDay(fromYmd, toYmd)) {
    const key = ymd(d.year, d.month, d.day);
    const free = [];
    for (const slot of candidatesForDay(d, durationMin)) {
      if (slot.start < minStart || slot.start > maxStart) continue;
      if (overlapsBusy(slot, busy)) continue;
      const p = partsInTz(new Date(slot.start), TIMEZONE);
      free.push(`${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
    }
    if (free.length) days[key] = free;
  }
  return days;
}

/* Comprueba si un hueco concreto (día + HH:MM) es candidato válido y libre. */
export function isSlotBookable(dayYmd, hm, durationMin, busy, now = new Date()) {
  const time = parseHm(hm);
  if (!time) return false;
  const target = zonedToUtc(dayYmd.year, dayYmd.month, dayYmd.day, time.hour, time.minute, TIMEZONE);
  const slot = { start: target.getTime(), end: target.getTime() + durationMin * 60000 };
  if (slot.start < now.getTime() + MIN_NOTICE_MIN * 60000) return false;
  const isCandidate = candidatesForDay(dayYmd, durationMin).some((c) => c.start === slot.start);
  if (!isCandidate) return false;
  return !overlapsBusy(slot, busy);
}
