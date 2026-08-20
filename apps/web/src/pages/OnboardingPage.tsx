import { Button } from 'antd';
import { Code2, MessageCircle, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export function OnboardingPage() {
  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="WELCOME TO RELAY"
          title="Your support workspace is ready"
          description="Complete these steps to start helping visitors."
        />
        <div className="grid gap-5 md:grid-cols-3">
          <Step
            icon={Code2}
            title="Install your widget"
            text="Copy the generated script into your website."
            to="/widgets"
            action="View install code"
          />
          <Step
            icon={UserPlus}
            title="Invite your team"
            text="Add admins, reply agents, or read-only viewers."
            to="/team"
            action="Manage team"
          />
          <Step
            icon={MessageCircle}
            title="Test a conversation"
            text="Open the widget demo and send your first message."
            to="/inbox"
            action="Open inbox"
          />
        </div>
      </div>
    </main>
  );
}

function Step({
  icon: Icon,
  title,
  text,
  to,
  action,
}: {
  icon: typeof Code2;
  title: string;
  text: string;
  to: string;
  action: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-brand">
        <Icon size={20} />
      </span>
      <h2 className="mt-5 font-bold">{title}</h2>
      <p className="mb-6 mt-2 min-h-10 text-xs leading-relaxed text-slate-500">{text}</p>
      <Link to={to}>
        <Button type="primary">{action}</Button>
      </Link>
    </section>
  );
}
