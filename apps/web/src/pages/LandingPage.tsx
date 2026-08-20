import { useState } from 'react';
import { Button, Input } from 'antd';
import { ArrowRight, Check, MessageCircle, Send, Sparkles, Users, X, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

type DemoMessage = { id: number; sender: 'visitor' | 'agent'; text: string };

export function LandingPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DemoMessage[]>([
    { id: 1, sender: 'agent', text: 'Hi! This is a live preview. What would you like to know?' },
  ]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { id: Date.now(), sender: 'visitor', text },
      {
        id: Date.now() + 1,
        sender: 'agent',
        text: 'That is exactly what Relay helps your team handle—together, in real time.',
      },
    ]);
    setDraft('');
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#0d1018] text-white">
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link className="flex items-center gap-3 text-white" to="/">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand shadow-lg shadow-violet-500/30">
            <Sparkles size={19} fill="currentColor" />
          </span>
          <b className="text-lg">Relay Chat</b>
        </Link>
        <div className="flex items-center gap-3">
          <Link className="hidden text-sm text-slate-300 hover:text-white sm:block" to="/login">
            Sign in
          </Link>
          <Link to="/register">
            <Button type="primary">Start free</Button>
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pt-8">
        <div className="pointer-events-none absolute -left-52 top-10 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-200">
            <Zap size={13} fill="currentColor" /> One inbox for every customer conversation
          </span>
          <h1 className="mt-7 max-w-3xl text-5xl font-bold leading-[1.02] tracking-[-.04em] md:text-7xl">
            Support that feels
            <span className="block bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
              human again.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-400">
            Add live chat to your site in minutes. Bring teammates into separate workspaces and help visitors
            together, without losing context.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/register">
              <Button size="large" type="primary">
                Create an account <ArrowRight size={16} />
              </Button>
            </Link>
            <Button size="large" ghost icon={<MessageCircle size={16} />} onClick={() => setChatOpen(true)}>
              Try the chat
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
            {['No credit card', 'Multiple workspaces', 'Invite any teammate'].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <Check className="text-emerald-400" size={14} /> {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-xl">
          <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-violet-500/20 to-cyan-400/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/95 p-4 text-ink shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 font-bold text-brand">
                  A
                </span>
                <span>
                  <b className="block text-sm">Acme Support</b>
                  <small className="text-emerald-500">● 3 agents online</small>
                </span>
              </div>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-500">Live inbox</span>
            </div>
            <div className="grid min-h-[400px] grid-cols-[150px_1fr] pt-4 sm:grid-cols-[190px_1fr]">
              <div className="border-r border-slate-100 pr-3">
                {[
                  ['SK', 'Sokha Khin', 'Need help installing…'],
                  ['ML', 'Mina Lee', 'Thanks, it works!'],
                  ['JD', 'Jordan Doe', 'Can I invite my team?'],
                ].map(([initials, name, text], index) => (
                  <div key={name} className={`mb-2 rounded-xl p-3 ${index === 0 ? 'bg-violet-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-[9px] font-bold text-brand">
                        {initials}
                      </span>
                      <b className="truncate text-xs">{name}</b>
                    </div>
                    <p className="mt-2 truncate text-[10px] text-slate-400">{text}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col px-4">
                <div className="mb-auto space-y-3 pt-7 text-xs">
                  <p className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 p-3">
                    Hi! Could you help me add chat to our website?
                  </p>
                  <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand p-3 text-white">
                    Absolutely—copy one script from the Install page and you are live.
                  </p>
                  <p className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 p-3">
                    Perfect. I can see it now 🎉
                  </p>
                </div>
                <div className="mt-5 flex items-center rounded-xl border border-slate-200 p-2 text-xs text-slate-400">
                  Reply to Sokha…
                  <Send className="ml-auto text-brand" size={15} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-white/[.025] px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            [
              MessageCircle,
              'Real-time conversations',
              'Messages, typing, read receipts, presence, and attachments in one focused inbox.',
            ],
            [
              Users,
              'Workspaces for every team',
              'Create multiple isolated workspaces and invite existing or brand-new users.',
            ],
            [
              Zap,
              'Install in one line',
              'Drop one script onto any website and customize the widget for each workspace.',
            ],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof MessageCircle;
            return (
              <article key={String(title)} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <FeatureIcon className="text-violet-300" size={22} />
                <h2 className="mt-5 font-bold">{String(title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{String(text)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="fixed bottom-6 right-6 z-30">
        {chatOpen && (
          <section className="mb-4 flex h-[440px] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-ink shadow-2xl">
            <header className="flex items-start bg-brand p-5 text-white">
              <div>
                <small>Interactive demo</small>
                <h2 className="mt-1 text-lg font-bold">Chat with Relay</h2>
              </div>
              <button className="ml-auto rounded-full bg-white/10 p-2" onClick={() => setChatOpen(false)}>
                <X size={15} />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-auto bg-slate-50 p-4">
              {messages.map((message) => (
                <p
                  key={message.id}
                  className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.sender === 'visitor' ? 'ml-auto rounded-br-sm bg-brand text-white' : 'rounded-tl-sm bg-white shadow-sm'}`}
                >
                  {message.text}
                </p>
              ))}
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-3">
              <Input
                value={draft}
                placeholder="Ask something…"
                onChange={(event) => setDraft(event.target.value)}
                onPressEnter={send}
              />
              <Button type="primary" icon={<Send size={15} />} onClick={send} />
            </div>
          </section>
        )}
        <button
          className="ml-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-xl shadow-violet-600/30"
          onClick={() => setChatOpen((value) => !value)}
        >
          {chatOpen ? <X size={21} /> : <MessageCircle size={22} />}
        </button>
      </div>
    </main>
  );
}
