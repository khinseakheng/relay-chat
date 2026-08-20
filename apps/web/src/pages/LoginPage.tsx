import { useState } from 'react';
import { App, Button, Input } from 'antd';
import { Mail, Sparkles } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { message } = App.useApp();
  const { agent, initializing, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  if (initializing) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-400">
        Restoring session…
      </main>
    );
  }
  if (agent) return <Navigate to={agent.workspaceId ? '/inbox' : '/workspaces'} replace />;

  const submit = async () => {
    setLoading(true);
    try {
      await login(email, password);
      navigate('/workspaces', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-violet-100 via-slate-50 to-cyan-50 p-5">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-9 shadow-soft">
        <div className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-brand text-white">
          <Sparkles size={20} fill="currentColor" />
        </div>
        <span className="text-[10px] font-bold tracking-[.14em] text-slate-400">RELAY CHAT</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mb-7 mt-1 text-sm text-slate-500">Sign in to manage customer conversations.</p>
        <label className="mb-4 block text-xs font-semibold text-slate-600">
          Email address
          <Input
            className="mt-2"
            size="large"
            value={email}
            prefix={<Mail size={16} />}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mb-6 block text-xs font-semibold text-slate-600">
          Password
          <Input.Password
            className="mt-2"
            size="large"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onPressEnter={submit}
          />
        </label>
        <Button type="primary" block size="large" loading={loading} onClick={submit}>
          Sign in
        </Button>
        <p className="mt-4 text-center text-xs text-slate-500">
          New to Relay?{' '}
          <Link className="text-brand" to="/register">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
