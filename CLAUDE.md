# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static, no-build website for "Una oveja feliz" (a small zumería/studio). Spanish-language (`<html lang="es">`), aesthetic and minimalist. No package manager, bundler, or tests. Frontend deps load from CDNs at runtime. Deployed on **Cloudflare Pages**; the internal booking flow is backed by **Cloudflare Pages Functions** (Workers on the edge) that talk to the Google Calendar API. `PRD.md` is the v1 spec; `PRD-google-calendar.md` specs the Calendar integration; the source-of-truth design lives in a Pencil file (`una oveja feliz.pen`, not in this repo).

## Structure

- `index.html` — markup for the hero (landing) and the hidden booking flow (Paso 1 calendar, Paso 2 form, Paso 3 confirmation). The sheep logo is an inline SVG `<symbol id="sheep">` reused via `<use>`. Icons use Lucide (`<i data-lucide="…">`).
- `styles.css` — all styling. Design tokens are CSS custom properties in `:root` (colors `--bg/--surface/--ink/…`, fonts Dancing Script / Fraunces / Inter, radii, shadow).
- `app.js` — classic script (no static `import`/`export`, so it also works over `file://`). Booking state + step navigation + dynamic calendar/slot rendering, calls the backend, and all anime.js v4 animations (loaded lazily via dynamic `import()` from a CDN).
- `functions/api/availability.js`, `functions/api/book.js` — Cloudflare Pages Functions (ESM, Workers runtime) exposing `GET /api/availability` and `POST /api/book`. Shared logic in `functions/_lib/` (`config.js` business hours/services, `time.js` timezone/DST helpers, `google.js` Calendar auth+API, `slots.js` availability math).
- `images/logo-full.png`, `images/logo-mark.png` — brand logo assets (hero + confirmation).
- `favicon-32.png`, `favicon.png`, `apple-touch-icon.png` — icon assets referenced by `index.html`.
- `wrangler.toml`, `.dev.vars.example` — Cloudflare Pages config and local-secrets template.

## Key behaviors

- **`BOOKING_MODE` (top of `app.js`)** is the switch for the "Reservar una cita" CTA: `'external'` (default) opens the Google booking link `GOOGLE_BOOKING_URL` in a new tab; `'internal'` reveals the maquetado booking flow instead. Flip only this constant to change behavior.
- **Internal flow is wired to the backend.** `app.js` fetches real availability from `GET /api/availability` (dynamic calendar/month nav) and submits via `POST /api/book`. `API_BASE`/`TURNSTILE_SITE_KEY` are the client config constants.
- **Backend = Google Calendar.** `freebusy.query` gives only busy intervals; available slots are computed in `functions/_lib/slots.js` as `working-hours (config.js) − busy`. Auth is a service-account JWT signed with Web Crypto (`google.js`). Booking re-checks the slot before `events.insert` to avoid double-booking; Cloudflare Turnstile guards spam.
- **Multi-calendar (privacy).** `BUSY_CALENDAR_IDS` (comma-separated) are the calendars READ for availability — typically the owner's primary (shared "free/busy only", details hidden) plus a dedicated "Reservas" calendar. `BOOKING_CALENDAR_ID` is where events are WRITTEN ("Reservas"). `freebusy` unions busy across all read calendars and never exposes event details. Falls back to `CALENDAR_ID` if the split vars are unset.
- **Secrets never touch the client.** Google keys, calendar IDs, `TURNSTILE_SECRET` live only as Cloudflare Pages secrets (local: `.dev.vars`, git-ignored). Only the Turnstile *site key* is public in the frontend. Never use `VITE_`/`PUBLIC_`-style bundled env for secrets.
- The "¿Qué te gustaría hacer?" dropdown options are `Zumeria`, `Valor`, `Otros` (mirrored in `functions/_lib/config.js` `SERVICES`).
- `functions/_lib/config.js` business hours/durations are **placeholders** — confirm with the owner (see `PRD-google-calendar.md` §6/§11).
- Animations respect `prefers-reduced-motion`; if anime.js fails to load, `revealAll()` unhides `.reveal` elements so the site stays functional.

## Working with this repo

- Preview static UI by opening `index.html` (`file://`) or `python3 -m http.server` (booking API returns errors without the backend; the flow degrades to an error state).
- Full stack locally: `npx wrangler pages dev .` with a `.dev.vars` file (copy from `.dev.vars.example`).
- Sanity-check frontend JS: `node --check app.js`. Functions are ESM: `node --input-type=module --check < functions/api/book.js`.
