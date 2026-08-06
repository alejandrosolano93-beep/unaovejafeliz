/* ============================================================
   Worker de "Una oveja feliz" (Cloudflare Workers + Static Assets).
   - Sirve el sitio estático desde ./public (binding ASSETS).
   - Enruta la API de reservas a los handlers de src/api/*.
   ============================================================ */
import { onRequestGet as availabilityGet } from './src/api/availability.js';
import { onRequestPost as bookPost } from './src/api/book.js';

const json = (obj, status) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/availability') {
      if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
      return availabilityGet({ request, env, ctx });
    }

    if (pathname === '/api/book') {
      if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
      return bookPost({ request, env, ctx });
    }

    // Cualquier otra ruta: archivos estáticos (index.html, app.js, imágenes…)
    return env.ASSETS.fetch(request);
  },
};
