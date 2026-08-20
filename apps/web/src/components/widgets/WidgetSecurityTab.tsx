import { useEffect, useState } from 'react';
import { App, Button, Input, Modal, Popconfirm, Select, Switch } from 'antd';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import type { ChatWidget, WorkspaceApiKey } from '../../types';
import { apiRequest } from '../../lib/api';

export function WidgetSecurityTab({
  widget,
  canAdmin,
  onUpdate,
}: {
  widget: ChatWidget;
  canAdmin: boolean;
  onUpdate(widget: ChatWidget): void;
}) {
  const { message } = App.useApp();
  const [enabled, setEnabled] = useState(widget.enabled);
  const [domains, setDomains] = useState(widget.allowedDomains.join('\n'));
  const [authenticationMode, setAuthenticationMode] = useState(widget.authenticationMode || 'public');
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<WorkspaceApiKey[]>([]);
  const [keyName, setKeyName] = useState('Website backend');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  useEffect(() => {
    setEnabled(widget.enabled);
    setDomains(widget.allowedDomains.join('\n'));
    setAuthenticationMode(widget.authenticationMode || 'public');
  }, [widget]);
  useEffect(() => {
    if (!canAdmin) return;
    apiRequest<WorkspaceApiKey[]>('/workspace/api-keys')
      .then((keys) => setApiKeys(keys.filter((key) => key.widgetId === widget.id)))
      .catch((error: Error) => message.error(error.message));
  }, [canAdmin, message, widget.id]);
  const save = async () => {
    setSaving(true);
    try {
      const allowedDomains = domains
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const updated = await apiRequest<ChatWidget>(`/workspace/widgets/${widget.id}/policy`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled, authenticationMode, allowedDomains }),
      });
      onUpdate(updated);
      message.success('Widget security saved');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not save security settings');
    } finally {
      setSaving(false);
    }
  };
  const createKey = async () => {
    setCreatingKey(true);
    try {
      const created = await apiRequest<WorkspaceApiKey & { secret: string }>('/workspace/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName, widgetId: widget.id }),
      });
      const { secret, ...visible } = created;
      setApiKeys((current) => [visible, ...current]);
      setNewSecret(secret);
      message.success('API key created');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not create API key');
    } finally {
      setCreatingKey(false);
    }
  };
  const revokeKey = async (keyId: string) => {
    try {
      await apiRequest(`/workspace/api-keys/${keyId}`, { method: 'DELETE' });
      setApiKeys((current) =>
        current.map((key) => (key.id === keyId ? { ...key, revokedAt: new Date().toISOString() } : key)),
      );
      message.success('API key revoked');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not revoke API key');
    }
  };
  return (
    <div className="grid max-w-3xl gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-5">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-brand">
              <ShieldCheck size={19} />
            </span>
            <div>
              <h2 className="font-bold">Widget access</h2>
              <p className="mt-1 text-xs text-slate-500">Control whether and where this widget can run.</p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            Enabled
            <Switch disabled={!canAdmin} checked={enabled} onChange={setEnabled} />
          </label>
        </div>
        <label className="mt-6 block text-xs font-semibold text-slate-600">
          Visitor authentication
          <Select
            className="mt-2 w-full"
            disabled={!canAdmin}
            value={authenticationMode}
            options={[
              { value: 'public', label: 'Public — anonymous visitors' },
              { value: 'hybrid', label: 'Hybrid — authenticated or anonymous' },
              { value: 'authenticated', label: 'Authenticated — sign-in required' },
            ]}
            onChange={setAuthenticationMode}
          />
        </label>
        <p className="mt-2 text-xs text-slate-400">
          Authenticated mode accepts identities only from a trusted website backend using a widget API key.
        </p>
        <label className="mt-6 block text-xs font-semibold text-slate-600">
          Allowed domains
          <Input.TextArea
            className="mt-2 font-mono text-xs"
            autoSize={{ minRows: 4, maxRows: 9 }}
            disabled={!canAdmin}
            value={domains}
            placeholder={'example.com\n*.example.com\nlocalhost'}
            onChange={(event) => setDomains(event.target.value)}
          />
        </label>
        <p className="mt-2 text-xs text-slate-400">
          One hostname per line. Leave empty to allow all domains. Wildcards apply to subdomains only.
        </p>
        <Button
          className="mt-6"
          type="primary"
          disabled={!canAdmin}
          loading={saving}
          onClick={() => void save()}
        >
          Save security
        </Button>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-brand">
            <KeyRound size={19} />
          </span>
          <div>
            <h2 className="font-bold">Backend API keys</h2>
            <p className="mt-1 text-xs text-slate-500">Create short-lived authenticated widget sessions.</p>
          </div>
        </div>
        <Button className="mt-5" href={`/docs?widgetId=${widget.id}`}>
          View integration guide
        </Button>
        {canAdmin && (
          <div className="mt-5 flex gap-2">
            <Input value={keyName} maxLength={80} onChange={(event) => setKeyName(event.target.value)} />
            <Button
              type="primary"
              loading={creatingKey}
              disabled={keyName.trim().length < 2}
              onClick={() => void createKey()}
            >
              Create key
            </Button>
          </div>
        )}
        <div className="mt-5 grid gap-2">
          {apiKeys.length === 0 && <p className="text-xs text-slate-400">No API keys for this widget.</p>}
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
            >
              <span className="min-w-0">
                <b className="block text-sm">{key.name}</b>
                <code className="text-xs text-slate-400">{key.prefix}…</code>
                <small className="ml-3 text-slate-400">
                  {key.revokedAt
                    ? 'Revoked'
                    : key.lastUsedAt
                      ? `Last used ${new Date(key.lastUsedAt).toLocaleString()}`
                      : 'Never used'}
                </small>
              </span>
              {!key.revokedAt && canAdmin && (
                <Popconfirm title="Revoke this API key?" onConfirm={() => void revokeKey(key.id)}>
                  <Button danger type="text" icon={<Trash2 size={15} />} aria-label="Revoke API key" />
                </Popconfirm>
              )}
            </div>
          ))}
        </div>
      </section>
      <Modal
        title="Copy your API key"
        open={Boolean(newSecret)}
        footer={null}
        onCancel={() => setNewSecret(null)}
      >
        <p className="mb-3 text-sm text-slate-500">
          This secret is shown once. Store it in your backend environment.
        </p>
        <Input.TextArea
          readOnly
          autoSize={{ minRows: 2 }}
          className="font-mono text-xs"
          value={newSecret || ''}
        />
        <Button
          className="mt-3"
          type="primary"
          onClick={() => newSecret && navigator.clipboard.writeText(newSecret)}
        >
          Copy key
        </Button>
      </Modal>
    </div>
  );
}
