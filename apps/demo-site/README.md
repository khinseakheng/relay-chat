# Northstar authenticated customer demo

This demo is a small Express website that shows the complete authenticated Relay integration. It has two fake customers, an in-memory HTTP-only login session, and a protected backend endpoint that calls `POST /v1/widget-sessions` with a private API key.

The launcher follows the selected Relay widget mode after a page refresh:

- **Public:** visible before login; anonymous chat is allowed.
- **Hybrid:** visible before login and upgraded to the verified customer after login.
- **Authenticated:** hidden until login; anonymous chat is unavailable.

Signing out clears the Relay visitor session and reloads the page using the current mode.

## Configure

In the Relay dashboard:

1. Open **Widgets → Security**.
2. Set visitor authentication to **Authenticated**. This ensures Relay also rejects anonymous conversation creation, independently of the demo UI.
3. Add `localhost` to allowed domains if domain restrictions are enabled.
4. Generate a backend API key and copy it immediately.

Add these values to the repository root `.env`:

```env
RELAY_API_URL=http://localhost:3000
RELAY_SITE_ID=your-widget-site-id
RELAY_API_KEY=rly_live_your_private_key
DEMO_PORT=5174
```

The API key is read only by `server.mjs`; it is never returned to browser code.

## Run

Run all three applications from the repository root:

```bash
pnpm dev
```

- Customer demo: http://localhost:5174
- Operator dashboard: http://localhost:5173
- Relay API and Swagger: http://localhost:3000/docs

## Fake accounts

| Email | Password | External ID |
| --- | --- | --- |
| `alex@northstar.test` | `demo123` | `northstar_user_1001` |
| `maya@northstar.test` | `demo123` | `northstar_user_1002` |

Sessions are intentionally stored in memory and disappear when Express restarts. This authentication is for local integration testing only, not a production login implementation.
