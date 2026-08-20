import { useEffect, useMemo, useState } from 'react';
import { App, Button, Select, Spin, Tag } from 'antd';
import { CheckCircle2, Clipboard, KeyRound, LockKeyhole, Server, TerminalSquare } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { API_URL, apiRequest } from '../lib/api';
import type { ChatWidget } from '../types';

function CodeBlock({ code, label }: { code: string; label: string }) {
  const { message } = App.useApp();
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    message.success(`${label} copied`);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <Button
          type="text"
          size="small"
          className="!text-slate-300"
          icon={<Clipboard size={13} />}
          onClick={() => void copy()}
        >
          Copy
        </Button>
      </div>
      <pre className="max-h-[430px] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-6 text-slate-200">
        {code}
      </pre>
    </div>
  );
}

export function DeveloperDocsPage() {
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [widgets, setWidgets] = useState<ChatWidget[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiRequest<ChatWidget[]>('/workspace/widgets')
      .then(setWidgets)
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [message]);
  const selected = widgets.find((widget) => widget.id === searchParams.get('widgetId')) || widgets[0];
  const examples = useMemo(() => {
    const siteId = selected?.siteId || 'your-site-id';
    const install = `<script src="${API_URL}/widget.js" data-site-id="${siteId}" async></script>`;
    const backend = `// Runs on YOUR backend. RELAY_API_KEY must never reach the browser.
app.get('/api/support/chat-session', requireLogin, async (req, res) => {
  const relayResponse = await fetch('${API_URL}/v1/widget-sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RELAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      siteId: '${siteId}',
      externalUserId: String(req.user.id),
      name: req.user.name,
      email: req.user.email,
      metadata: { plan: req.user.plan }
    })
  });

  const payload = await relayResponse.json();
  if (!relayResponse.ok) {
    return res.status(relayResponse.status).json({ error: 'Chat unavailable' });
  }

  // Relay responses use { success, data, meta } envelopes.
  res.set('Cache-Control', 'no-store');
  res.json({ token: payload.data.token });
});`;
    const browser = `<script>
  // Define the queue before loading widget.js, so async loading is safe.
  window.RelayChat = window.RelayChat || function () {
    (window.RelayChat.q = window.RelayChat.q || []).push(arguments);
  };

  async function authenticateSupportChat() {
    const response = await fetch('/api/support/chat-session', {
      credentials: 'include'
    });
    if (!response.ok) return;
    const { token } = await response.json();
    window.RelayChat('authenticate', { token });
  }

  authenticateSupportChat();
</script>
${install}`;
    const react = `import { useEffect } from 'react';

export function RelayChat() {
  useEffect(() => {
    window.RelayChat = window.RelayChat || function (...args) {
      (window.RelayChat.q = window.RelayChat.q || []).push(args);
    };

    const script = document.createElement('script');
    script.src = '${API_URL}/widget.js';
    script.dataset.siteId = '${siteId}';
    script.async = true;
    document.body.appendChild(script);

    fetch('/api/support/chat-session', { credentials: 'include' })
      .then((response) => response.json())
      .then(({ token }) => window.RelayChat('authenticate', { token }));

    return () => {
      window.RelayChat?.('logout');
    };
  }, []);

  return null;
}`;
    return { install, backend, browser, react };
  }, [selected]);

  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="DEVELOPER DOCUMENTATION"
          title="Authenticated widget integration"
          description="Connect Relay to your website login without exposing private API credentials in the browser."
        />
        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <Spin />
          </div>
        ) : !selected ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-bold">Create a widget first</h2>
            <p className="mt-2 text-sm text-slate-500">
              Integration examples are generated from a widget site ID.
            </p>
            <Button className="mt-5" type="primary" href="/widgets">
              Go to widgets
            </Button>
          </section>
        ) : (
          <div className="grid gap-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-bold">Integration target</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Examples below update when you select another widget.
                  </p>
                </div>
                <Select
                  className="w-full sm:w-80"
                  value={selected.id}
                  options={widgets.map((widget) => ({ value: widget.id, label: widget.name }))}
                  onChange={(widgetId) => setSearchParams({ widgetId })}
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <Tag>{selected.siteId}</Tag>
                <Tag color={selected.authenticationMode === 'authenticated' ? 'purple' : 'default'}>
                  {selected.authenticationMode} mode
                </Tag>
              </div>
              {selected.authenticationMode === 'public' && (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  This widget is currently public. Change it to Hybrid or Authenticated under Widget Security
                  before using identity tokens.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-6">
              <div className="flex gap-3">
                <LockKeyhole className="mt-0.5 shrink-0 text-brand" size={20} />
                <div>
                  <h2 className="font-bold text-slate-900">How authentication works</h2>
                  <ol className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                    <li>1. Your website authenticates the customer using its existing login.</li>
                    <li>
                      2. Your backend sends that verified identity to Relay using a private widget API key.
                    </li>
                    <li>3. Relay returns a single-use token that expires after 60 seconds.</li>
                    <li>
                      4. Your browser passes that token to the widget; Relay issues a conversation-scoped
                      visitor session.
                    </li>
                  </ol>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex gap-3">
                <TerminalSquare className="text-brand" size={20} />
                <div>
                  <h2 className="font-bold">1. Install the widget</h2>
                  <p className="text-xs text-slate-500">Add this once, before the closing body tag.</p>
                </div>
              </div>
              <CodeBlock label="HTML" code={examples.install} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex gap-3">
                <KeyRound className="text-brand" size={20} />
                <div>
                  <h2 className="font-bold">2. Create a backend API key</h2>
                  <p className="text-xs text-slate-500">
                    Open Widgets → Security → Backend API keys. Store the secret as RELAY_API_KEY.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Never place this key in JavaScript, HTML, mobile application code, a URL, or source control.
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex gap-3">
                <Server className="text-brand" size={20} />
                <div>
                  <h2 className="font-bold">3. Add your session endpoint</h2>
                  <p className="text-xs text-slate-500">
                    This example uses Node and Express; the same request works from any backend language.
                  </p>
                </div>
              </div>
              <CodeBlock label="Node.js backend" code={examples.backend} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold">4. Authenticate from the browser</h2>
              <p className="mb-5 mt-1 text-xs text-slate-500">
                The browser calls only your backend. It never receives the Relay API key.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <CodeBlock label="HTML / JavaScript" code={examples.browser} />
                <CodeBlock label="React" code={examples.react} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold">Widget commands</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 text-sm">
                {[
                  [
                    "RelayChat('authenticate', { token })",
                    'Exchange a one-time token and identify the visitor',
                  ],
                  ["RelayChat('open')", 'Open the chat panel'],
                  ["RelayChat('close')", 'Close the chat panel'],
                  ["RelayChat('logout')", 'Clear visitor credentials when your website user signs out'],
                ].map(([command, purpose]) => (
                  <div
                    key={command}
                    className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-0 md:grid-cols-[310px_1fr]"
                  >
                    <code className="text-xs font-semibold text-brand">{command}</code>
                    <span className="text-slate-500">{purpose}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold">Production checklist</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  'Use HTTPS for the website and Relay API',
                  'Keep API keys in backend environment variables',
                  'Use a stable account ID instead of email as externalUserId',
                  'Call RelayChat logout during website logout',
                  'Return Cache-Control: no-store from your session endpoint',
                  'Revoke and rotate keys from Widget Security',
                ].map((item) => (
                  <span key={item} className="flex gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={16} />
                    {item}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
