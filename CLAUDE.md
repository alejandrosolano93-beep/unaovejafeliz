# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static, no-build website for "Una oveja feliz" (a small zumería/studio). Spanish-language (`<html lang="es">`), aesthetic and minimalist. No package manager, bundler, or tests. Dependencies are loaded from CDNs at runtime. `PRD.md` is the product spec; the source-of-truth design lives in a Pencil file (`una oveja feliz.pen`, not in this repo).

## Structure

- `index.html` — markup for the hero (landing) and the hidden booking flow (Paso 1 calendar, Paso 2 form, Paso 3 confirmation). The sheep logo is an inline SVG `<symbol id="sheep">` reused via `<use>`. Icons use Lucide (`<i data-lucide="…">`).
- `styles.css` — all styling. Design tokens are CSS custom properties in `:root` (colors `--bg/--surface/--ink/…`, fonts Dancing Script / Fraunces / Inter, radii, shadow).
- `app.js` — classic script (no static `import`/`export`, so it also works over `file://`). Booking state + step navigation + calendar/slot generation, and all anime.js v4 animations (loaded lazily via dynamic `import()` from a CDN).
- `images/logo.jpg` — original brand logo (sheep + wordmark) shown in the hero with `mix-blend-mode: multiply`.
- `favicon-32.png`, `apple-touch-icon.png` — icon assets referenced by `index.html`.

## Key behaviors

- **`BOOKING_MODE` (top of `app.js`)** is the switch for the "Reservar una cita" CTA: `'external'` (default) opens the Google booking link `GOOGLE_BOOKING_URL` in a new tab; `'internal'` reveals the maquetado booking flow instead. Flip only this constant to change behavior.
- **No real backend / Google Calendar API yet.** The internal flow is UI-only; `onReserve(payload)` in `app.js` is the marked TODO integration point.
- The "¿Qué te gustaría hacer?" dropdown options are `Zumeria`, `Valor`, `Otros`.
- Calendar (July 2026) and time slots are static mock data in `app.js` (`AVAILABLE`, `SLOT_ROWS`).
- Animations respect `prefers-reduced-motion`; if anime.js fails to load, `revealAll()` unhides `.reveal` elements so the site stays functional.

## Working with this repo

- Preview by opening `index.html` directly (`file://`) or by serving statically: `python3 -m http.server`.
- Sanity-check JS with `node --check app.js`.
