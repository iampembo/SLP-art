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
  const query = new URL(request.url).searchParams;
  // Decap opens /auth?provider=github&site_id=...&scope=repo and waits for an
  // `authorizing:<provider>` message from this page BEFORE it listens for the
  // final token. Skip that handshake and the token is posted to nobody.
  const provider = query.get('provider') || 'github';
  const scope = query.get('scope') || 'repo';
  const params = new URLSearchParams({
    client_id: env.CLIENT_ID,
    redirect_uri: `${workerUrl(request)}/callback`,
    scope,
  });
  const githubUrl = `${GITHUB_AUTHORIZE}?${params}`;
  // provider name is allow-listed to keep the embedded script safe.
  const safeProvider = provider === 'github' ? 'github' : 'github';
  const html = `<!doctype html><html><body><script>
(function () {
  try {
    if (window.opener) window.opener.postMessage('authorizing:${safeProvider}', '*');
  } catch (e) {}
  window.location.href = '${githubUrl}';
})();
<\/script><p>Redirecting to GitHub…</p></body></html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}

/** Post an error back to Decap so it shows on the login screen instead of hanging. */
function errorPage(message: string): Response {
  const safe = message.replace(/[^a-zA-Z0-9 _.:-]/g, '').slice(0, 200);
  const html = `<!doctype html><html><body><script>
(function () {
  var msg = 'authorization:github:error:' + JSON.stringify({ message: '${safe}' });
  try {
    if (window.opener) window.opener.postMessage(msg, '*');
  } catch (e) {}
})();
<\/script><p>Login failed: ${safe}</p></body></html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
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
    return errorPage(`GitHub said: ${err}`);
  }
  if (!code) {
    console.log('oauth callback hit with no code');
    return errorPage('Missing code');
  }
  if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
    return errorPage('Server misconfigured');
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
    return errorPage('Token exchange failed');
  }
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    console.log(`token exchange denied: ${data.error ?? 'unknown'}`);
    return errorPage('Token exchange failed');
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
