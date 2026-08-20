import { App, Button } from 'antd';
import { Clipboard, ExternalLink } from 'lucide-react';
import type { ChatWidget } from '../../types';
import { API_URL } from '../../lib/api';

export function WidgetInstallTab({ widget }: { widget: ChatWidget }) {
  const { message } = App.useApp();
  const embed = `<script src="${API_URL}/widget.js" data-site-id="${widget.siteId}" async></script>`;
  const authenticatedExample = `// Your backend calls POST ${API_URL}/v1/widget-sessions\n// Then pass its short-lived token to the widget:\nwindow.RelayChat = window.RelayChat || function () {\n  (window.RelayChat.q = window.RelayChat.q || []).push(arguments);\n};\nwindow.RelayChat('authenticate', { token });`;
  const copy = async () => {
    await navigator.clipboard.writeText(embed);
    message.success('Snippet copied');
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold">Copy your code</h2>
        <p className="mt-1 text-xs text-slate-500">Paste it before the closing &lt;/body&gt; tag.</p>
        <pre className="my-5 whitespace-pre-wrap break-all rounded-xl bg-slate-900 p-4 text-xs text-slate-200">
          {embed}
        </pre>
        <Button type="primary" icon={<Clipboard size={15} />} onClick={() => void copy()}>
          Copy snippet
        </Button>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold">Test the widget</h2>
        <p className="mb-5 mt-1 text-xs text-slate-500">Open the live widget and send a test message.</p>
        <Button
          icon={<ExternalLink size={15} />}
          onClick={() => window.open(`${API_URL}/widget/${widget.siteId}`, '_blank')}
        >
          Open widget demo
        </Button>
        <Button className="ml-2" href={`/docs?widgetId=${widget.id}`}>
          Integration docs
        </Button>
        <div className="mt-7 flex flex-wrap gap-2">
          {['HTML', 'React', 'WordPress', 'Shopify'].map((item) => (
            <span key={item} className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-brand">
              {item}
            </span>
          ))}
        </div>
      </section>
      {widget.authenticationMode !== 'public' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="font-bold">Authenticated visitor boot</h2>
          <p className="mt-1 text-xs text-slate-500">
            Fetch the bootstrap token through your own authenticated backend endpoint. Never expose the Relay
            API key in browser code.
          </p>
          <pre className="mt-5 whitespace-pre-wrap break-all rounded-xl bg-slate-900 p-4 text-xs text-slate-200">
            {authenticatedExample}
          </pre>
        </section>
      )}
    </div>
  );
}
