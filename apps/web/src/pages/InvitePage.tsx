import { useEffect, useState } from 'react';
import { App, Button, Input, Spin, Tag } from 'antd';
import { Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { publicRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';

type Invitation = { workspaceName: string; email: string | null; role: string; expiresAt: string };

export function InvitePage() {
  const { token = '' } = useParams();
  const { message } = App.useApp();
  const { agent, acceptInvitation } = useAuth();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation>();
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', name: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicRequest<Invitation>(`/workspace/invitations/${encodeURIComponent(token)}`)
      .then((result) => {
        setInvitation(result);
        setForm((current) => ({
          ...current,
          email: result.email || agent?.email || current.email,
          name: agent?.name || current.name,
        }));
      })
      .catch((reason: Error) => setError(reason.message));
  }, [agent?.email, agent?.name, token]);

  const submit = async () => {
    setLoading(true);
    try {
      await acceptInvitation(token, form);
      navigate('/inbox', { replace: true });
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : 'Could not accept invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-9 shadow-soft">
        <div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
          <Sparkles size={20} />
        </div>
        {!invitation && !error && <Spin />}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {invitation && (
          <>
            <Tag color="purple">{invitation.role}</Tag>
            <h1 className="mt-3 text-2xl font-bold">Join {invitation.workspaceName}</h1>
            <p className="mb-6 mt-1 text-sm text-slate-500">
              Create an account, or enter the password for your existing account.
              <span className="mt-1 block text-xs">
                Invitation expires {formatDateTime(invitation.expiresAt)}.
              </span>
            </p>
            <div className="space-y-4">
              <Input
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                disabled={Boolean(invitation.email)}
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input.Password
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onPressEnter={submit}
              />
            </div>
            <Button className="mt-6" block size="large" type="primary" loading={loading} onClick={submit}>
              Accept invitation
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
