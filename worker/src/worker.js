// ============================================================
// SD System Website — HTTPS Proxy Worker
// ============================================================
// Forwards POST/GET requests from admin.html (HTTPS, GitHub Pages)
// to JSP backend (HTTP, sds-mis.sd.ac.th:8888) since browser
// blocks mixed-content (HTTPS → HTTP) requests directly.
//
// Environment variables (set via `wrangler secret put` or dashboard):
//   BACKEND_URL — full URL of JSP api endpoint
//                 e.g. http://sds-mis.sd.ac.th:8888/school_new_5/jsp/dept/api/index.jsp
//   ALLOWED_ORIGIN — frontend origin allowed for CORS
//                    e.g. https://chanonnicky.github.io
// ============================================================

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://chanonnicky.github.io';

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // ── Health check (GET only) ──
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.pathname === '/health' || url.pathname === '/') {
        return json({ ok: true, backend: env.BACKEND_URL ? 'configured' : 'missing' }, origin);
      }
      return json({ success: false, error: 'use POST for API calls' }, origin, 405);
    }

    // ── Only POST allowed for API ──
    if (request.method !== 'POST') {
      return json({ success: false, error: 'method not allowed' }, origin, 405);
    }

    if (!env.BACKEND_URL) {
      return json({ success: false, error: 'BACKEND_URL not configured' }, origin, 500);
    }

    // ── Forward request body to JSP ──
    let body;
    try {
      body = await request.text();
    } catch (e) {
      return json({ success: false, error: 'invalid request body' }, origin, 400);
    }

    let upstream;
    try {
      upstream = await fetch(env.BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Forwarded-Host': request.headers.get('host') || '',
          'X-Forwarded-For': request.headers.get('cf-connecting-ip') || '',
        },
        body,
      });
    } catch (e) {
      return json({ success: false, error: 'backend unreachable: ' + e.message }, origin, 502);
    }

    const responseText = await upstream.text();
    return new Response(responseText, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  },
};

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(obj, origin, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}
