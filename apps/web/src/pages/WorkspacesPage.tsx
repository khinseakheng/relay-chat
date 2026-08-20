import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, Modal, Spin, Tag } from 'antd';
import { ArrowRight, Building2, LogOut, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';

type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
};

export function WorkspacesPage() {
  const { message } = App.useApp();
  const { agent, logout, switchWorkspace } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () =>
      apiRequest<Workspace[]>('/auth/workspaces')
        .then(setWorkspaces)
        .catch((error: Error) => message.error(error.message))
        .finally(() => setLoading(false)),
    [message],
  );

  useEffect(() => void load(), [load]);

  const openWorkspace = async (workspaceId: string) => {
    setSwitchingId(workspaceId);
    try {
      await switchWorkspace(workspaceId);
      navigate('/inbox', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not open workspace');
      setSwitchingId('');
    }
  };

  const createWorkspace = async () => {
    const name = workspaceName.trim();
    if (name.length < 2) return message.error('Enter a workspace name');
    setCreating(true);
    try {
      const created = await apiRequest<{ id: string }>('/workspace', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await switchWorkspace(created.id);
      navigate('/onboarding', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand shadow-lg shadow-violet-500/30">
              <Sparkles size={21} fill="currentColor" />
            </span>
            <div>
              <b className="block text-lg">Relay</b>
              <span className="text-xs text-violet-200">Signed in as {agent?.email}</span>
            </div>
          </div>
          <Button ghost icon={<LogOut size={15} />} onClick={logout}>
            Sign out
          </Button>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/95 p-7 text-ink shadow-2xl shadow-black/30 md:p-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <span className="text-[10px] font-bold tracking-[.18em] text-brand">YOUR WORKSPACES</span>
              <h1 className="mt-2 text-3xl font-bold">Where would you like to work?</h1>
              <p className="mt-2 text-sm text-slate-500">
                Each workspace keeps its team, widgets, and conversations separate.
              </p>
            </div>
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
              New workspace
            </Button>
          </div>

          {loading ? (
            <div className="grid min-h-52 place-items-center">
              <Spin />
            </div>
          ) : workspaces.length ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100"
                  disabled={Boolean(switchingId)}
                  onClick={() => void openWorkspace(workspace.id)}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-brand">
                    <Building2 size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{workspace.name}</b>
                    <span className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <Tag className="m-0">{workspace.role}</Tag>
                      {workspace.slug}
                    </span>
                  </span>
                  {switchingId === workspace.id ? (
                    <Spin size="small" />
                  ) : (
                    <ArrowRight
                      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand"
                      size={18}
                    />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-violet-200 bg-violet-50 p-10 text-center">
              <Building2 className="mx-auto text-brand" size={30} />
              <h2 className="mt-4 font-bold">Create your first workspace</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                You can add more workspaces or join another team through an invitation at any time.
              </p>
              <Button className="mt-5" type="primary" onClick={() => setCreateOpen(true)}>
                Create workspace
              </Button>
            </div>
          )}
        </section>
      </div>

      <Modal
        title="Create a workspace"
        open={createOpen}
        okText="Create workspace"
        confirmLoading={creating}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void createWorkspace()}
      >
        <p className="mb-4 text-sm text-slate-500">
          A workspace includes its own team, chat widgets, and visitor conversations.
        </p>
        <Input
          autoFocus
          size="large"
          value={workspaceName}
          placeholder="e.g. Acme Support"
          onChange={(event) => setWorkspaceName(event.target.value)}
          onPressEnter={() => void createWorkspace()}
        />
      </Modal>
    </main>
  );
}
