# Relay Chat

A Tawk.to-inspired, embeddable live-chat MVP built with React, NestJS, and Socket.IO.

## Run locally

Create a PostgreSQL database, then prepare the local environment and install dependencies:

```bash
cp .env.example .env
pnpm install
```

Update `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `.env` for your database, then start all three applications:

```bash
pnpm dev
```

Pending migrations run automatically at API startup by default. The development command starts the API, operator dashboard, and authenticated customer demo together.

- Operator dashboard: http://localhost:5173
- API: http://localhost:3000
- Swagger docs: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs/openapi.json
- Registration: http://localhost:5173/register
- Authenticated customer demo: http://localhost:5174

## Embed on any website

```html
<script
  src="http://localhost:3000/widget.js"
  data-site-id="your-generated-site-id"
  async
></script>
```

Register a workspace, then copy the complete snippet or open the widget demo from `/widgets`. Configure the widget's title, color, launcher, and other appearance settings in the widget management screen. For production, deploy the API and web apps, set `VITE_API_URL` on the frontend, and replace the script URL with your public API domain.

### Authenticated visitors

Set a widget's visitor authentication mode to `authenticated` or `hybrid`, then create a widget-scoped API key on its Security tab. Your website backend verifies its own user session and requests a one-time Relay bootstrap token:

```http
POST /v1/widget-sessions
Authorization: Bearer rly_live_...
Content-Type: application/json

{
  "siteId": "your-generated-site-id",
  "externalUserId": "account_123",
  "name": "Customer name",
  "email": "customer@example.com",
  "metadata": { "plan": "pro" }
}
```

Return only the response token to your browser and authenticate the already embedded widget:

```js
window.RelayChat = window.RelayChat || function () {
  (window.RelayChat.q = window.RelayChat.q || []).push(arguments);
};
window.RelayChat('authenticate', { token });
```

Call `window.RelayChat('logout')` when the website user signs out. Never send the Relay API key to the browser or put either credential in a URL. Bootstrap tokens expire after 60 seconds and can be exchanged only once; conversation access uses a separate visitor-scoped token.

## Included

- Responsive operator inbox built with React, Ant Design, Tailwind CSS, and Vite
- Persistent conversations and messages with NestJS, TypeORM, and PostgreSQL
- Normalized conversation tags and private notes with foreign keys and cascading cleanup
- Database-backed visitor presence heartbeats, last-seen timestamps, and persisted message read receipts
- Persisted first-seen timestamps from conversation creation; no automatic sample visitor seeding
- Live message delivery, typing-event plumbing, and room isolation with Socket.IO
- Agent assignment, open/closed status, unread counts, visitor metadata, and search
- One-line iframe-isolated widget installer suitable for websites and webviews
- JWT-protected operator endpoints and WebSocket agent messages
- Widget-scoped backend API keys, one-time authenticated visitor bootstrap tokens, and visitor-scoped REST/WebSocket access
- Workspace-scoped conversations and realtime rooms with owner, admin, agent, and viewer authorization
- One-time, seven-day invitation links with optional Resend email delivery and multi-workspace switching
- Central response envelopes and exception handling, plus short-lived inbox caching

Create an account at `/register`, then create or select a workspace at `/workspaces`. Accounts can own or join multiple isolated workspaces, and each newly created workspace receives an owner membership and first widget. Legacy unscoped conversations are never assigned automatically. Passwords are hashed with Node.js scrypt; authentication uses short-lived access JWTs and HTTP-only refresh cookies.

Invitation links work without an email provider. To send invitation emails as well, configure `RESEND_API_KEY`, `INVITE_EMAIL_FROM`, and `WEB_PUBLIC_URL`.

Swagger can be disabled with `SWAGGER_ENABLED=false`, or mounted at a different route with `SWAGGER_PATH`. Authorization entered in Swagger UI is retained across page refreshes.

## Attachment storage

Attachments are uploaded before their realtime message is sent. Messages store the resulting URL and metadata instead of storing Base64 file contents in PostgreSQL.

Local development stores files under `uploads/` and serves them from `/uploads`:

```env
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=uploads
STORAGE_PUBLIC_URL=http://localhost:3000/uploads
MAX_UPLOAD_SIZE_MB=5
VITE_MAX_UPLOAD_SIZE_MB=5
```

To use Cloudflare R2, make the bucket available through an R2 custom domain or public development URL and configure:

```env
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=relay-chat
R2_PUBLIC_URL=https://files.example.com
# Optional override:
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

Run `pnpm --filter api migration:run` when upgrading an existing production database. The migrations preserve existing tag and note data while moving it out of JSON columns into `conversation_tags` and `conversation_notes`. They also add persisted message read receipts and expiring `presence_sessions` used by the widget heartbeat.

`DB_MIGRATIONS_RUN=true` applies pending migrations during API startup. Keep TypeORM schema synchronization disabled in every environment; schema changes belong in versioned migrations.

## Application routes

- `/` — public interactive product landing page
- `/login` — operator authentication
- `/register` — account registration
- `/workspaces` — workspace creation and selection
- `/onboarding` — first-run installation and team checklist
- `/invite/:token` — invitation acceptance for new or existing users
- `/team` — members, roles, invitations, workspace switching, and widgets
- `/dashboard` — workspace metrics and recent conversations
- `/inbox/:conversationId?` — realtime support inbox
- `/contacts` — searchable visitor directory
- `/widgets/:widgetId/:tab` — install, appearance, availability, and security controls
- `/docs` — authenticated widget integration guide with workspace-specific copyable examples
- `/install` — compatibility redirect to widget management
- `/settings` — operator profile and notification preferences
- `/administration` — workspace security, attachment policy, session revocation, and audit log

## Project structure

```text
apps/
├── api/src/
│   ├── auth/           # JWT module, strategy, DTO, controller and service
│   ├── chat/           # REST, WebSocket, widget, caching and persistence
│   ├── common/         # guards, decorators, response interceptor and error filter
│   ├── config/         # Swagger configuration
│   ├── database/       # TypeORM data source and production migrations
│   ├── storage/        # local and Cloudflare R2 attachment storage
│   └── workspace/      # users, memberships, roles, widgets and invitations
├── web/src/
│   ├── components/     # reusable layout and inbox components
│   ├── hooks/          # authentication and conversation providers
│   ├── lib/            # typed API, socket and formatting utilities
│   ├── pages/          # route-level, lazily loaded screens
│   └── router.tsx      # protected application routes
└── demo-site/          # authenticated customer demo and backend token exchange
```

## Quality commands

```bash
pnpm lint
pnpm format:check
pnpm build
pnpm --filter api migration:run
```

## License

Relay Chat is open-source software licensed under the [MIT License](LICENSE).
