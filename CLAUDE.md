# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static, no-build website for "Una oveja feliz" (a small zumería/studio). Spanish-language (`<html lang="es">`), aesthetic and minimalist. No package manager, bundler, or tests. Frontend deps load from CDNs at runtime. Deployed as a **Cloudflare Worker with Static Assets**: `worker.js` serves the static site from `public/` (ASSETS binding) and routes `/api/*` to the booking backend, which talks to the Google Calendar API. `PRD.md` is the v1 spec; `PRD-google-calendar.md` specs the Calendar integration; the source-of-truth design lives in a Pencil file (`una oveja feliz.pen`, not in this repo).

## Structure

- `worker.js` (repo root) — Worker entry. Serves `public/` via `env.ASSETS.fetch()` and dispatches `GET /api/availability` and `POST /api/book` to the handlers in `src/api/`.
- `public/index.html` — markup for the hero (landing) and the hidden booking flow (Paso 1 calendar, Paso 2 form, Paso 3 confirmation). Icons use Lucide (`<i data-lucide="…">`); the Turnstile widget (`.cf-turnstile`) carries the public site key.
- `public/styles.css` — all styling. Design tokens are CSS custom properties in `:root` (colors `--bg/--surface/--ink/…`, fonts Dancing Script / Fraunces / Inter, radii, shadow).
- `public/app.js` — classic script (no static `import`/`export`). Booking state + step navigation + dynamic calendar/slot rendering, calls the backend, and all anime.js v4 animations (loaded lazily via dynamic `import()` from a CDN).
- `src/api/availability.js`, `src/api/book.js` — ESM handlers (Workers runtime) exporting `onRequestGet`/`onRequestPost`, imported by `worker.js`. Shared logic in `src/lib/` (`config.js` business hours/services, `time.js` timezone/DST helpers, `google.js` Calendar auth+API, `slots.js` availability math).
- `public/images/`, `public/favicon-*.png`, `public/apple-touch-icon.png` — brand + icon assets.
- `wrangler.toml`, `.dev.vars.example` — Worker/assets config and local-secrets template.

## Key behaviors

- **`BOOKING_MODE` (top of `app.js`)** is the switch for the "Reservar una cita" CTA: `'external'` (default) opens the Google booking link `GOOGLE_BOOKING_URL` in a new tab; `'internal'` reveals the maquetado booking flow instead. Flip only this constant to change behavior.
- **Internal flow is wired to the backend.** `app.js` fetches real availability from `GET /api/availability` (dynamic calendar/month nav) and submits via `POST /api/book`. `API_BASE` (same-origin) is the client config constant; the Turnstile site key lives in `public/index.html`.
- **Backend = Google Calendar.** `freebusy.query` gives only busy intervals; available slots are computed in `src/lib/slots.js` as `working-hours (config.js) − busy`. Auth is a service-account JWT signed with Web Crypto (`google.js`). Booking re-checks the slot before `events.insert` to avoid double-booking; Cloudflare Turnstile (implicit render) guards spam.
- **Multi-calendar (privacy).** `BUSY_CALENDAR_IDS` (comma-separated) are the calendars READ for availability — typically the owner's primary (shared "free/busy only", details hidden) plus a dedicated "Reservas" calendar. `BOOKING_CALENDAR_ID` is where events are WRITTEN ("Reservas"). `freebusy` unions busy across all read calendars and never exposes event details. Falls back to `CALENDAR_ID` if the split vars are unset.
- **Secrets never touch the client.** Google keys, calendar IDs, `TURNSTILE_SECRET` live only as Worker secrets (local: `.dev.vars`, git-ignored). Only the Turnstile *site key* is public in the frontend. Never use `VITE_`/`PUBLIC_`-style bundled env for secrets.
- The "¿Qué te gustaría hacer?" dropdown options are `Zumeria`, `Valor`, `Otros` (mirrored in `src/lib/config.js` `SERVICES`).
- Animations respect `prefers-reduced-motion`; if anime.js fails to load, `revealAll()` unhides `.reveal` elements so the site stays functional.

## Working with this repo

- Full stack locally: `npx wrangler dev` (serves `public/` + `/api/*`) with a `.dev.vars` file (copy from `.dev.vars.example`).
- Sanity-check frontend JS: `node --check public/app.js`. Backend modules are ESM: `node --input-type=module --check < src/api/book.js`.
- Deploy: `npx wrangler deploy` (or Cloudflare Git build). Set secrets with `npx wrangler secret put <NAME>` or the Worker's Settings → Variables and Secrets.
