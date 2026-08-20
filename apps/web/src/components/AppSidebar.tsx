import { useEffect, useState } from 'react';
import { Avatar, Dropdown, Modal, Tooltip } from 'antd';
import {
  CircleHelp,
  Building2,
  BookOpen,
  Code2,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Settings,
  Sparkles,
  UserRoundCog,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useConversations } from '../hooks/useConversations';
import { apiRequest } from '../lib/api';

type WorkspaceOption = { id: string; name: string; slug: string; role: string };

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workspaces', label: 'Workspaces', icon: Building2 },
  { to: '/inbox', label: 'Inbox', icon: MessageCircle },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/team', label: 'Team', icon: UserRoundCog },
  { to: '/widgets', label: 'Widgets', icon: Code2 },
  { to: '/docs', label: 'Developer docs', icon: BookOpen },
  { to: '/administration', label: 'Administration', icon: ShieldCheck },
];

export function AppSidebar() {
  const { agent, logout, switchWorkspace } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const { conversations } = useConversations();
  const unread = conversations.reduce((total, item) => total + item.unread, 0);
  useEffect(() => {
    if (agent) void apiRequest<WorkspaceOption[]>('/auth/workspaces').then(setWorkspaces);
  }, [agent]);
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `grid h-11 w-11 place-items-center rounded-xl transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`;

  return (
    <aside className="flex h-screen w-[72px] shrink-0 flex-col items-center overflow-y-auto bg-[#171b24] py-4">
      <div className="mb-4 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-brand text-white shadow-lg shadow-violet-500/20">
        <Sparkles size={20} fill="currentColor" />
      </div>
      <nav className="flex shrink-0 flex-col gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <Tooltip key={to} title={label} placement="right">
            <NavLink to={to} className={navClass}>
              {label === 'Inbox' ? (
                <span className="relative text-inherit">
                  <Icon color="currentColor" size={20} />
                  {unread > 0 && (
                    <i className="absolute -right-2.5 -top-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold not-italic leading-none text-white ring-2 ring-[#171b24]">
                      {unread > 99 ? '99+' : unread}
                    </i>
                  )}
                </span>
              ) : label === 'Workspaces' ? (
                <span className="relative">
                  <Icon size={20} />
                  <i className="absolute -right-2 -top-2 grid h-3.5 w-3.5 place-items-center rounded-full bg-brand text-[10px] not-italic text-white">
                    +
                  </i>
                </span>
              ) : (
                <Icon size={20} />
              )}
            </NavLink>
          </Tooltip>
        ))}
      </nav>
      <div className="mt-auto flex shrink-0 flex-col items-center gap-1 pt-3">
        <Tooltip title="Help" placement="right">
          <button
            className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() =>
              Modal.info({
                title: 'Relay help',
                content:
                  'Reply in the Inbox, manage visitors in Contacts, and copy your website snippet from Install.',
                okText: 'Got it',
              })
            }
          >
            <CircleHelp size={20} />
          </button>
        </Tooltip>
        <Tooltip title="Settings" placement="right">
          <NavLink to="/settings" className={navClass}>
            <Settings size={20} />
          </NavLink>
        </Tooltip>
        <Dropdown
          placement="topRight"
          menu={{
            items: [
              { key: 'email', label: agent?.email, disabled: true },
              { key: 'role', label: `Role: ${agent?.role}`, disabled: true },
              { type: 'divider' },
              ...workspaces.map((workspace) => ({
                key: workspace.id,
                label: `${workspace.name}${workspace.id === agent?.workspaceId ? ' ✓' : ''}`,
                disabled: workspace.id === agent?.workspaceId,
                onClick: () => switchWorkspace(workspace.id).then(() => window.location.assign('/inbox')),
              })),
              {
                key: 'all-workspaces',
                label: 'All workspaces…',
                onClick: () => window.location.assign('/workspaces'),
              },
              { type: 'divider' },
              { key: 'logout', label: 'Sign out', icon: <LogOut size={14} />, onClick: logout },
            ],
          }}
        >
          <div className="relative mt-1 cursor-pointer">
            <Avatar className="bg-gradient-to-br from-orange-300 to-rose-500 text-xs">
              {agent?.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#171b24] bg-emerald-400" />
          </div>
        </Dropdown>
      </div>
    </aside>
  );
}
