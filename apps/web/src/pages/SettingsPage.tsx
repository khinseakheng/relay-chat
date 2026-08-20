import { useState } from 'react';
import { App, Button, Switch, Tag } from 'antd';
import { Bell, UserRound } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { playNotificationSound } from '../hooks/useConversations';

export function SettingsPage() {
  const { message } = App.useApp();
  const { agent } = useAuth();
  const [sounds, setSounds] = useState(localStorage.getItem('relay-notification-sounds') !== 'false');
  const save = () => {
    localStorage.setItem('relay-notification-sounds', String(sounds));
    message.success('Preferences saved');
  };
  const testSound = async () => {
    if (!sounds) {
      message.info('Enable notification sounds first');
      return;
    }
    if (!(await playNotificationSound())) {
      message.warning('Your browser blocked audio. Click anywhere on the page and try again.');
    }
  };
  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="YOUR ACCOUNT"
          title="Settings"
          description="Manage your operator profile and personal notification preferences."
        />
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex gap-3">
            <UserRound className="text-brand" size={20} />
            <div>
              <h2 className="font-bold">Profile</h2>
              <p className="text-xs text-slate-500">Your Relay account in the active workspace.</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Name</dt>
              <dd className="mt-1 font-semibold">{agent?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Email</dt>
              <dd className="mt-1 font-semibold">{agent?.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Workspace role</dt>
              <dd className="mt-1">
                <Tag>{agent?.role}</Tag>
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex gap-3">
            <Bell className="text-brand" size={20} />
            <div>
              <h2 className="font-bold">Notifications</h2>
              <p className="text-xs text-slate-500">These preferences apply only to this browser.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-100 p-4">
            <span>
              <b className="block text-sm">Notification sounds</b>
              <small className="text-slate-400">Play a sound when a visitor sends a message</small>
            </span>
            <Switch checked={sounds} onChange={setSounds} />
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="primary" onClick={save}>
              Save preferences
            </Button>
            <Button onClick={() => void testSound()}>Test sound</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
