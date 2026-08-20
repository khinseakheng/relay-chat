import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

try {
  process.loadEnvFile(resolve(fileURLToPath(new URL('../../.env', import.meta.url))));
} catch {
  // The demo also works with environment variables supplied by the shell.
}

const directory = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.DEMO_PORT || 5174);
const relayApiUrl = (process.env.RELAY_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const relaySiteId = process.env.RELAY_SITE_ID || 'heng-44f0c477-f8315f';
const relayApiKey = process.env.RELAY_API_KEY || '';
const sessionCookie = 'northstar_demo_session';
const sessions = new Map();
const users = [
  {
    id: 'northstar_user_1001',
    email: 'alex@northstar.test',
    password: 'demo123',
    name: 'Alex Johnson',
    plan: 'Pro',
    company: 'Northstar Labs',
  },
  {
    id: 'northstar_user_1002',
    email: 'maya@northstar.test',
    password: 'demo123',
    name: 'Maya Chen',
    plan: 'Starter',
    company: 'Northstar Labs',
  },
];

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

function cookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || '')
      .split(';')
      .map((item) => item.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [decodeURIComponent(key), decodeURIComponent(value)]),
  );
}

function currentUser(request) {
  const session = sessions.get(cookies(request)[sessionCookie]);
  if (!session || session.expiresAt <= Date.now()) return null;
  return users.find((user) => user.id === session.userId) || null;
}

function publicUser(user) {
  const { password: _password, ...safe } = user;
  return safe;
}

app.get('/api/config', async (_request, response) => {
  try {
    const relayResponse = await fetch(`${relayApiUrl}/widget-api/config/${encodeURIComponent(relaySiteId)}`);
    const payload = await relayResponse.json();
    if (!relayResponse.ok || !payload.success) throw new Error('Widget configuration is unavailable');
    response.set('Cache-Control', 'no-store').json({
      relayApiUrl,
      relaySiteId,
      enabled: payload.data.enabled,
      authenticationMode: payload.data.authenticationMode,
    });
  } catch {
    response.status(502).json({ error: `Could not load widget configuration from ${relayApiUrl}.` });
  }
});

app.get('/api/me', (request, response) => {
  const user = currentUser(request);
  response.set('Cache-Control', 'no-store').json({ user: user ? publicUser(user) : null });
});

app.post('/api/login', (request, response) => {
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  const user = users.find((candidate) => candidate.email === email && candidate.password === password);
  if (!user) return response.status(401).json({ error: 'Use one of the demo accounts shown below.' });
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 8 * 60 * 60_000 });
  response.setHeader(
    'Set-Cookie',
    `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${8 * 60 * 60}`,
  );
  return response.set('Cache-Control', 'no-store').json({ user: publicUser(user) });
});

app.post('/api/logout', (request, response) => {
  sessions.delete(cookies(request)[sessionCookie]);
  response.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  response.set('Cache-Control', 'no-store').json({ loggedOut: true });
});

app.get('/api/relay-chat-session', async (request, response) => {
  const user = currentUser(request);
  if (!user) return response.status(401).json({ error: 'Sign in before starting authenticated chat.' });
  if (!relayApiKey) {
    return response.status(503).json({ error: 'Set RELAY_API_KEY in the root .env file.' });
  }
  try {
    const relayResponse = await fetch(`${relayApiUrl}/v1/widget-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${relayApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteId: relaySiteId,
        externalUserId: user.id,
        name: user.name,
        email: user.email,
        metadata: { plan: user.plan, company: user.company },
      }),
    });
    const payload = await relayResponse.json();
    if (!relayResponse.ok || !payload.success) {
      return response.status(relayResponse.status).json({
        error: payload.error?.message?.[0] || 'Relay rejected the widget session request.',
      });
    }
    return response
      .set('Cache-Control', 'no-store')
      .json({ token: payload.data.token, expiresAt: payload.data.expiresAt });
  } catch {
    return response.status(502).json({ error: `Could not reach Relay at ${relayApiUrl}.` });
  }
});

if (process.env.NODE_ENV === 'production') {
  const distribution = resolve(directory, 'dist');
  if (!existsSync(distribution)) throw new Error('Run pnpm --filter demo-site build before start');
  app.use(express.static(distribution));
  app.use((_request, response) => response.sendFile(resolve(distribution, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: directory, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`Northstar authenticated demo: http://localhost:${port}`);
  console.log(`Relay widget: ${relayApiUrl} (${relaySiteId})`);
});
