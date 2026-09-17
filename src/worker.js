// Pit Wall's Cloudflare Worker.
//
// Serves the static site AND proxies the two third-party APIs that need a
// server-side secret (Groq, FIRST's FTC Events API) — those secrets live
// here as Worker secrets (`wrangler secret put GROQ_API_KEY`, etc.) and
// never reach the browser. This replaces the two separate Worker proxies
// this project used to depend on (groq-proxy / ftc-events-proxy), folding
// them into the same deployment as the site itself.
//
// Anything not under /api/ falls through to the static assets binding —
// see wrangler.jsonc's `assets.binding: "ASSETS"`.
//
// Required secrets (set via `wrangler secret put <NAME>` or the
// Cloudflare dashboard → Workers & Pages → this Worker → Settings →
// Variables and Secrets):
//   GROQ_API_KEY
//   FTC_EVENTS_USERNAME
//   FTC_EVENTS_API_KEY

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const FTC_EVENTS_API_BASE = 'https://ftc-api.firstinspires.org/v2.0';

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function handleGroq(request, env) {
  const headers = corsHeaders(request);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  if (!env.GROQ_API_KEY) {
    console.error('Missing GROQ_API_KEY secret');
    return jsonResponse({ error: 'Server misconfigured — GROQ_API_KEY not set.' }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, headers);
  }

  const { messages, model } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "'messages' array is required" }, 400, headers);
  }

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ messages, model: model || DEFAULT_GROQ_MODEL }),
    });

    const data = await groqRes.text();
    return new Response(data, { status: groqRes.status, headers: { 'Content-Type': 'application/json', ...headers } });

  } catch (err) {
    console.error('Groq proxy error:', err.message || err);
    return jsonResponse({ error: 'Failed to reach Groq API' }, 502, headers);
  }
}

async function handleFtcEvents(request, env) {
  const headers = corsHeaders(request);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  if (!env.FTC_EVENTS_USERNAME || !env.FTC_EVENTS_API_KEY) {
    console.error('Missing FTC_EVENTS_USERNAME / FTC_EVENTS_API_KEY secret');
    return jsonResponse({ error: 'Server misconfigured — FTC Events credentials not set.' }, 500, headers);
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) {
    return jsonResponse({ error: "Missing 'path' query param, e.g. ?path=/2026/events&teamNumber=12345" }, 400, headers);
  }

  const targetUrl = `${FTC_EVENTS_API_BASE}${path}`;
  const authHeader = 'Basic ' + btoa(`${env.FTC_EVENTS_USERNAME}:${env.FTC_EVENTS_API_KEY}`);

  try {
    const ftcRes = await fetch(targetUrl, { headers: { 'Authorization': authHeader } });
    const data = await ftcRes.text();
    return new Response(data, { status: ftcRes.status, headers: { 'Content-Type': 'application/json', ...headers } });

  } catch (err) {
    console.error('FTC Events proxy error:', err.message || err);
    return jsonResponse({ error: 'Failed to reach FTC Events API' }, 502, headers);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/groq') return handleGroq(request, env);
    if (url.pathname === '/api/ftc-events') return handleFtcEvents(request, env);

    return env.ASSETS.fetch(request);
  },
};
