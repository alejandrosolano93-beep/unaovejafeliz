/* ============================================================
   Cliente de Google Calendar para Cloudflare Workers.
   Auth: Service Account (JWT RS256 firmado con Web Crypto) →
   intercambio por access_token. Sin SDK de Node.

   Alternativa (no implementada aquí): OAuth refresh token del
   dueño. Ver §4 del PRD. Basta con reemplazar getAccessToken().
   ============================================================ */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlStr(str) {
  return b64url(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function signJwt(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

/* Cache de token en el ámbito del módulo (por instancia del Worker). */
let cachedToken = null; // { token, exp }

export async function getAccessToken(env) {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;

  const clientEmail = env.GOOGLE_SA_CLIENT_EMAIL;
  // La private key suele guardarse con \n escapados; los normalizamos.
  const privateKey = (env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Faltan credenciales de service account');

  const assertion = await signJwt(clientEmail, privateKey);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

/* Devuelve los intervalos ocupados [{start,end}] (ISO) del calendario. */
export async function freeBusy(env, token, timeMinISO, timeMaxISO) {
  const calendarId = env.CALENDAR_ID;
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      timeZone: 'UTC',
      items: [{ id: calendarId }],
    }),
  });
  if (!res.ok) throw new Error(`freeBusy ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const cal = data.calendars && data.calendars[calendarId];
  if (!cal) throw new Error('Calendario no encontrado en la respuesta de freeBusy');
  if (cal.errors && cal.errors.length) throw new Error(`freeBusy cal error: ${JSON.stringify(cal.errors)}`);
  return cal.busy || [];
}

/* Crea el evento de reserva. Devuelve { id, htmlLink }. */
export async function insertEvent(env, token, event, sendUpdates) {
  const calendarId = encodeURIComponent(env.CALENDAR_ID);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=${sendUpdates || 'none'}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`events.insert ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}
