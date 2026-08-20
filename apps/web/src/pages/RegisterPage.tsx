import { useState } from 'react';
import { App, Button, Input } from 'antd';
import { Mail, Sparkles, UserRound } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { message } = App.useApp();
  const { agent, initializing, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  if (initializing) return <main className="grid min-h-screen place-items-center">Loading…</main>;
  if (agent) return <Navigate to={agent.workspaceId ? '/inbox' : '/workspaces'} replace />;

  const submit = async () => {
    setLoading(true);
    try {
      await register(form);
      navigate('/workspaces', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-violet-100 via-white to-cyan-50 p-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-9 shadow-soft">
        <div className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
          <Sparkles size={20} fill="currentColor" />
        </div>
        <span className="text-[10px] font-bold tracking-[.14em] text-slate-400">GET STARTED</span>
        <h1 className="mt-2 text-3xl font-bold">Create your account</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">You can create or join workspaces next.</p>
        <div className="space-y-4">
          <Input
            size="large"
            prefix={<UserRound size={16} />}
            placeholder="Your name"
            value={form.name}
            onChange={(e) => field('name', e.target.value)}
          />
          <Input
            size="large"
            prefix={<Mail size={16} />}
            placeholder="Work email"
            value={form.email}
            onChange={(e) => field('email', e.target.value)}
          />
          <Input.Password
            size="large"
            placeholder="Password (8+ characters)"
            value={form.password}
            onChange={(e) => field('password', e.target.value)}
            onPressEnter={submit}
          />
        </div>
        <Button className="mt-6" type="primary" block size="large" loading={loading} onClick={submit}>
          Create account
        </Button>
        <p className="mt-5 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link className="text-brand" to="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
