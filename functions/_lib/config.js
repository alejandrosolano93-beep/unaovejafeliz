/* ============================================================
   Configuración de negocio para el cálculo de disponibilidad.
   NO existe en Google: aquí re-declaramos el "horario base" y los
   márgenes. `freebusy` solo resta lo ocupado sobre esta base.

   ⚠️ PLACEHOLDER — confirmar con el negocio (§6 y §11 del PRD):
   horario por día, duración por servicio, buffers y ventanas.
   ============================================================ */

export const TIMEZONE = 'Europe/Madrid';

/* Horario de apertura por día de la semana (getDay: 0=Dom … 6=Sáb).
   Cada día es una lista de tramos [inicio, fin] en hora local (HH:MM).
   Un array vacío = cerrado ese día.                                   */
export const WEEKLY_HOURS = {
  1: [['15:00', '20:00']], // Lunes
  2: [],                    // Martes (cerrado)
  3: [['15:00', '20:00']], // Miércoles
  4: [['15:00', '20:00']], // Jueves
  5: [['15:00', '20:00']], // Viernes
  6: [['09:00', '19:00']], // Sábado
  0: [['09:00', '19:00']], // Domingo
};

/* Servicios ofertados. `durationMin` define la duración de la cita
   (y por tanto el ancho del hueco). `location` va al evento.          */
export const SERVICES = {
  Zumeria: { durationMin: 60, location: 'Zumeria · Calle del mar' },
  Valor:   { durationMin: 60, location: 'Zumeria · Calle del mar' },
  Otros:   { durationMin: 60, location: 'Zumeria · Calle del mar' },
};

export const DEFAULT_SERVICE = 'Zumeria';

/* Márgenes globales. */
export const SLOT_INTERVAL_MIN = 60; // separación entre inicios de hueco
export const BUFFER_MIN = 0;         // colchón antes/después de cada evento ocupado
export const MIN_NOTICE_MIN = 120;   // antelación mínima para reservar (2 h)
export const MAX_ADVANCE_DAYS = 60;  // ventana máxima hacia el futuro

/* Cómo se envía la confirmación al crear el evento:
   'all'  -> Google invita al cliente por email (requiere OAuth/Workspace).
   'none' -> no se envía por Google (service account en Gmail personal).   */
export const SEND_UPDATES = 'none';

export function serviceConfig(name) {
  return SERVICES[name] || SERVICES[DEFAULT_SERVICE];
}
