/* ============================================================
   Una oveja feliz — lógica de la web
   ============================================================ */

/* --- Configuración de reserva ---------------------------------
   BOOKING_MODE controla qué hace el CTA "Reservar una cita":
     'external' -> abre la página de citas de Google (por defecto v1)
     'internal' -> muestra el flujo de reserva maquetado (Paso 1→2→3)
   Cambiar solo esta constante para alternar el comportamiento.        */
const BOOKING_MODE = 'external'; // 'external' | 'internal'
const GOOGLE_BOOKING_URL = 'https://calendar.app.google/P8TvSUSSjdqYemP66';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- Iconos ---------------------------------------------------- */
if (window.lucide) window.lucide.createIcons();

/* --- Estado de la reserva (datos maquetados) ------------------- */
const state = {
  dateLabel: 'Jueves 30 jul',
  dateLong: 'Jueves 30 de julio, 2026',
  time: '11:30',
  service: 'Zumeria',
};

/* --- Referencias ----------------------------------------------- */
const booking = document.getElementById('booking');
const cards = Array.from(document.querySelectorAll('.card'));

/* ============================================================
   Calendario (Julio 2026, datos estáticos)
   ============================================================ */
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAYS_IN_MONTH = 31;
const LEADING_EMPTY = 2; // Julio 2026 empieza en miércoles
const AVAILABLE = new Set([3, 4, 10, 11, 17, 18, 24, 25, 30, 31]);
let selectedDay = 30;

function buildCalendar() {
  const cal = document.getElementById('calendar');
  cal.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'cal-row';
  for (const wd of WEEKDAYS) {
    const c = document.createElement('div');
    c.className = 'cal-wd';
    c.textContent = wd;
    head.appendChild(c);
  }
  cal.appendChild(head);

  const cells = [];
  for (let i = 0; i < LEADING_EMPTY; i++) cells.push(null);
  for (let d = 1; d <= DAYS_IN_MONTH; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  for (let r = 0; r < cells.length / 7; r++) {
    const row = document.createElement('div');
    row.className = 'cal-row';
    for (let c = 0; c < 7; c++) {
      const day = cells[r * 7 + c];
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      if (day === null) {
        cell.classList.add('is-empty');
      } else {
        cell.textContent = day;
        if (!AVAILABLE.has(day)) {
          cell.classList.add('is-disabled');
        } else {
          if (day === selectedDay) cell.classList.add('is-selected');
          cell.addEventListener('click', () => selectDay(day, cell));
        }
      }
      row.appendChild(cell);
    }
    cal.appendChild(row);
  }
}

function selectDay(day, cell) {
  selectedDay = day;
  document.querySelectorAll('.cal-day.is-selected').forEach((el) => el.classList.remove('is-selected'));
  cell.classList.add('is-selected');
  const weekday = WEEKDAYS_LONG(day);
  state.dateLabel = `${weekday} ${day} jul`;
  state.dateLong = `${weekday} ${day} de julio, 2026`;
  document.getElementById('slotsLabel').textContent = `Horas disponibles · ${abbr(state.dateLabel)}`;
  pop(cell);
}

function WEEKDAYS_LONG(day) {
  const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const idx = (LEADING_EMPTY + day - 1) % 7;
  return names[idx];
}
function abbr(label) {
  return label.replace('lunes', 'lun').replace('martes', 'mar').replace('miércoles', 'mié')
    .replace('jueves', 'jue').replace('viernes', 'vie').replace('sábado', 'sáb').replace('domingo', 'dom');
}

/* ============================================================
   Slots de hora
   ============================================================ */
const SLOT_ROWS = [['10:00', '11:30', '13:00'], ['16:00', '17:30', '']];

function buildSlots() {
  const wrap = document.getElementById('slots');
  wrap.innerHTML = '';
  for (const row of SLOT_ROWS) {
    const r = document.createElement('div');
    r.className = 'slot-row';
    for (const t of row) {
      const s = document.createElement('div');
      if (t === '') {
        s.style.visibility = 'hidden';
      } else {
        s.className = 'slot';
        s.textContent = t;
        if (t === state.time) s.classList.add('is-selected');
        s.addEventListener('click', () => selectSlot(t, s));
      }
      r.appendChild(s);
    }
    wrap.appendChild(r);
  }
}

function selectSlot(t, el) {
  state.time = t;
  document.querySelectorAll('.slot.is-selected').forEach((s) => s.classList.remove('is-selected'));
  el.classList.add('is-selected');
  pop(el);
}

/* ============================================================
   Navegación entre pasos
   ============================================================ */
function activateOnly(id) {
  cards.forEach((c) => {
    c.classList.toggle('is-active', c.id === id);
    if (c.id !== id) { c.style.opacity = ''; c.style.transform = ''; }
  });
}

function goToStep(toId) {
  const current = document.querySelector('.card.is-active');
  const target = document.getElementById(toId);
  if (reduceMotion || !anime || !current || current === target) {
    activateOnly(toId);
    return;
  }
  anime.animate(current, {
    opacity: [1, 0], translateY: [0, -12], duration: 240, ease: 'in(2)',
    onComplete: () => {
      activateOnly(toId);
      anime.animate(target, { opacity: [0, 1], translateY: [16, 0], duration: 360, ease: 'out(3)' });
    },
  });
}

/* --- Apertura/cierre del panel (una sola pantalla, transición FLIP) --- */
const STAGE_MS = 2500;          // desplazamiento del logo
const APPEAR_MS = 500;          // aparición del formulario (fade-in)
const STAGE_EASE = 'inOut(3)';  // easing suave (aceleración/desaceleración)
// conjunto de la transición ≈ STAGE_MS + APPEAR_MS = 3s
let stageOpen = false;
const heroLogo = document.querySelector('.hero-logo');

function openStage() {
  if (stageOpen) return;
  stageOpen = true;
  activateOnly('step1');

  // FLIP: medir el logo antes y después de mostrar el panel
  const first = heroLogo.getBoundingClientRect();
  booking.hidden = false;
  const last = heroLogo.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;

  if (reduceMotion || !anime) return;

  // el formulario permanece oculto hasta que el logo termine
  booking.style.opacity = '0';

  // el logo se desliza muy suavemente a su nueva posición (izquierda), en 4s
  anime.animate(heroLogo, { translateX: [dx, 0], translateY: [dy, 0], duration: STAGE_MS, ease: STAGE_EASE });

  // el formulario entra solapando el tramo final del logo (0.5s antes) para evitar la pausa
  anime.animate(booking, { opacity: [0, 1], translateY: [16, 0], duration: APPEAR_MS, delay: STAGE_MS - 500, ease: 'out(3)' });
}

function closeStage() {
  if (!stageOpen) return;
  const finish = () => {
    booking.hidden = true;
    booking.style.opacity = '';
    booking.style.transform = '';
    booking.style.filter = '';
    activateOnly('step1');
    stageOpen = false;
  };
  if (reduceMotion || !anime) { finish(); heroLogo.style.transform = ''; return; }

  const first = heroLogo.getBoundingClientRect();
  // el formulario se desvanece con fade-out + leve desplazamiento (0.5s)
  anime.animate(booking, {
    opacity: [1, 0], translateY: [0, 16], duration: APPEAR_MS, ease: 'in(2)',
    onComplete: () => {
      booking.hidden = true;
      const last = heroLogo.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      // y el logo regresa suavemente al centro
      anime.animate(heroLogo, { translateX: [dx, 0], translateY: [dy, 0], duration: STAGE_MS, ease: STAGE_EASE });
      booking.style.opacity = '';
      booking.style.transform = '';
      activateOnly('step1');
      stageOpen = false;
    },
  });
}

/* ============================================================
   Wiring de eventos
   ============================================================ */
document.getElementById('reserveCta').addEventListener('click', () => {
  if (BOOKING_MODE === 'external') {
    window.open(GOOGLE_BOOKING_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  openStage();
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeStage));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => goToStep('step1')));

document.getElementById('continueBtn').addEventListener('click', () => {
  document.getElementById('summaryChip').textContent = `${cap(state.dateLabel)} · ${state.time}`;
  goToStep('step2');
});

document.getElementById('f-service').addEventListener('change', (e) => {
  state.service = e.target.value;
  document.getElementById('serviceValue').textContent = e.target.value;
});

document.getElementById('reserveBtn').addEventListener('click', () => {
  // NOTA: la integración con la API de Google Calendar aún no existe.
  // Aquí se conectaría en el futuro. Por ahora solo mostramos la confirmación maquetada.
  onReserve(collectForm());
  document.getElementById('sumDate').textContent = cap(state.dateLong);
  document.getElementById('sumTime').textContent = `${state.time} · 60 minutos`;
  document.getElementById('sumService').textContent = state.service;
  const email = document.getElementById('f-email').value.trim();
  document.getElementById('confirmMail').textContent = email
    ? `Confirmación enviada a ${email}`
    : 'Confirmación enviada a tu correo';
  goToStep('step3');
});

document.getElementById('gcalBtn').addEventListener('click', () => {
  window.open(GOOGLE_BOOKING_URL, '_blank', 'noopener,noreferrer');
});

function collectForm() {
  return {
    name: document.getElementById('f-name').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    service: state.service,
    notes: document.getElementById('f-notes').value.trim(),
    day: selectedDay,
    time: state.time,
  };
}

// eslint-disable-next-line no-unused-vars
function onReserve(payload) {
  /* TODO: Google Calendar API — crear el evento de reserva con `payload`. */
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ============================================================
   Animaciones (anime.js v4)
   ============================================================ */
let anime = null;

function revealAll() {
  document.querySelectorAll('.reveal').forEach((el) => { el.style.opacity = '1'; });
}

// micro-interacción de "pop" reutilizable
function pop(el) {
  if (reduceMotion || !anime) return;
  anime.animate(el, { scale: [0.94, 1], duration: 260, ease: 'out(3)' });
}

// pulsación de botones
function bindPress() {
  document.querySelectorAll('.btn-primary, .btn-outline').forEach((btn) => {
    btn.addEventListener('pointerdown', () => { if (anime) anime.animate(btn, { scale: 0.97, duration: 120, ease: 'out(2)' }); });
    btn.addEventListener('pointerup', () => { if (anime) anime.animate(btn, { scale: 1, duration: 160, ease: 'out(3)' }); });
    btn.addEventListener('pointerleave', () => { if (anime) anime.animate(btn, { scale: 1, duration: 160, ease: 'out(3)' }); });
  });
}

async function initMotion() {
  if (reduceMotion) { revealAll(); return; }
  try {
    anime = await import('https://cdn.jsdelivr.net/npm/animejs@4/+esm');
  } catch (e) {
    revealAll();
    return;
  }

  const { createTimeline } = anime;

  // Entrada del hero
  const tl = createTimeline({ defaults: { ease: 'out(3)', duration: 800 } });
  tl.add('.brand', { opacity: [0, 1], translateY: [16, 0] }, 0)
    .add('.cta', { opacity: [0, 1], translateY: [12, 0] }, 120)
    .add('.hero-logo', { opacity: [0, 1], scale: [0.92, 1], translateY: [12, 0], duration: 1000 }, 200);

  bindPress();
}

/* ============================================================
   Init
   ============================================================ */
buildCalendar();
buildSlots();
initMotion();
