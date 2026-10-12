/**
 * Minimal GitHub OAuth proxy for Decap CMS (runs as its own Worker so the
 * shop's secrets and deploys stay untouched).
 *
 *  GET /auth            -> redirect to github.com Authorize page
 *  GET /callback?code=  -> exchange code for token server-side, then
 *                           postMessage the token back to the Decap popup
 *
 * Secrets (Cloudflare dashboard or `wrangler secret put --config ...`):
 *   CLIENT_ID, CLIENT_SECRET  (from a GitHub OAuth App)
 */

interface Env {
  CLIENT_ID?: string;
  CLIENT_SECRET?: string;
}

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';

function workerUrl(request: Request): string {
  return new URL(request.url).origin;
}

async function handleAuth(request: Request, env: Env): Promise<Response> {
  if (!env.CLIENT_ID) return new Response('Missing CLIENT_ID', { status: 500 });
  const redirectUri = `${workerUrl(request)}/callback`;
  const params = new URLSearchParams({
    client_id: env.CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'repo',
  });
  return Response.redirect(`${GITHUB_AUTHORIZE}?${params}`, 302);
}

async function handleCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (err) {
    console.log(`oauth callback error param: ${err}`);
    return new Response(`GitHub said: ${err}`, { status: 400 });
  }
  if (!code) {
    console.log('oauth callback hit with no code');
    return new Response('Missing code', { status: 400 });
  }
  if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
    return new Response('Missing CLIENT_ID/CLIENT_SECRET', { status: 500 });
  }
  const res = await fetch(GITHUB_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
      code,
    }),
  });
  if (!res.ok) {
    console.log(`token exchange HTTP ${res.status}`);
    return new Response('Token exchange failed', { status: 502 });
  }
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    console.log(`token exchange denied: ${data.error ?? 'unknown'}`);
    return new Response(`Token exchange failed: ${data.error ?? 'unknown'}`, {
      status: 502,
    });
  }
  console.log('token exchange ok');
  // Tokens are [a-z0-9_]+ — safe to embed, but escape anyway.
  const token = data.access_token.replace(/[^a-zA-Z0-9_]/g, '');
  const html = `<!doctype html><html><body><script>
(function () {
  var msg = 'authorization:github:success:' + JSON.stringify({ token: '${token}', provider: 'github' });
  function send() {
    if (window.opener) window.opener.postMessage(msg, '*');
    window.close();
  }
  setTimeout(send, 300);
})();
<\/script><p>Logged in — closing…</p></body></html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (path === '/auth') return handleAuth(request, env);
    if (path === '/callback') return handleCallback(request, env);
    return new Response('slp-art Decap OAuth proxy — use /auth', {
      status: 404,
    });
  },
};
