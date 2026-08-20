import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, Modal, Popconfirm, Select, Table, Tag } from 'antd';
import { LogOut, Trash2, UserPlus, XCircle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';

type Role = 'owner' | 'admin' | 'agent' | 'viewer';
type Member = { id: string; userId: string; name: string; email: string; role: Role; createdAt: string };
type Invitation = {
  id: string;
  email: string | null;
  role: Exclude<Role, 'owner'>;
  expiresAt: string;
  acceptedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
};
type Overview = { workspace: { name: string; slug: string }; members: Member[]; invitations: Invitation[] };

export function TeamPage() {
  const { message } = App.useApp();
  const { agent } = useAuth();
  const [data, setData] = useState<Overview>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [revokingMemberId, setRevokingMemberId] = useState('');
  const [cancelingInvitationId, setCancelingInvitationId] = useState('');
  const [invite, setInvite] = useState<{ email?: string; role: Exclude<Role, 'owner'> }>({ role: 'agent' });
  const canAdmin = agent?.role === 'owner' || agent?.role === 'admin';
  const load = useCallback(
    () =>
      apiRequest<Overview>('/workspace')
        .then(setData)
        .catch((error: Error) => message.error(error.message)),
    [message],
  );
  useEffect(() => void load(), [load]);

  const createInvite = async () => {
    try {
      const result = await apiRequest<{ inviteUrl: string; emailSent: boolean }>('/workspace/invitations', {
        method: 'POST',
        body: JSON.stringify(invite),
      });
      setInviteUrl(result.inviteUrl);
      void navigator.clipboard.writeText(result.inviteUrl).catch(() => undefined);
      message.success(result.emailSent ? 'Invitation emailed' : 'Invitation link created');
      void load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not create invitation');
    }
  };
  const removeMember = async (member: Member) => {
    setRemovingMemberId(member.id);
    try {
      await apiRequest(`/workspace/members/${member.id}`, { method: 'DELETE' });
      message.success(`${member.name} was removed from the workspace`);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not remove member');
    } finally {
      setRemovingMemberId('');
    }
  };
  const revokeSessions = async (member: Member) => {
    setRevokingMemberId(member.id);
    try {
      await apiRequest(`/workspace/members/${member.id}/revoke-sessions`, { method: 'POST' });
      message.success(`${member.name} was signed out of this workspace`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not revoke sessions');
    } finally {
      setRevokingMemberId('');
    }
  };
  const cancelInvitation = async (invitation: Invitation) => {
    setCancelingInvitationId(invitation.id);
    try {
      await apiRequest(`/workspace/invitations/${invitation.id}`, { method: 'DELETE' });
      message.success('Invitation canceled');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not cancel invitation');
    } finally {
      setCancelingInvitationId('');
    }
  };

  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="WORKSPACE"
          title={data?.workspace.name || 'Team'}
          description="Manage workspace members, permissions, and invitations."
        />
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Team members</h2>
              <p className="text-xs text-slate-500">Agents can reply; viewers have read-only access.</p>
            </div>
            {canAdmin && (
              <Button
                type="primary"
                icon={<UserPlus size={15} />}
                onClick={() => {
                  setInviteUrl('');
                  setInviteOpen(true);
                }}
              >
                Invite member
              </Button>
            )}
          </div>
          <Table
            rowKey="id"
            pagination={false}
            dataSource={data?.members || []}
            columns={[
              {
                title: 'Member',
                render: (_, row: Member) => (
                  <div>
                    <b className="block text-sm">{row.name}</b>
                    <span className="text-xs text-slate-400">{row.email}</span>
                  </div>
                ),
              },
              {
                title: 'Role',
                render: (_, row: Member) =>
                  row.role === 'owner' || !canAdmin ? (
                    <Tag>{row.role}</Tag>
                  ) : (
                    <Select
                      className="w-28"
                      value={row.role}
                      options={['admin', 'agent', 'viewer'].map((value) => ({ value, label: value }))}
                      onChange={(role) =>
                        apiRequest<Member[]>(`/workspace/members/${row.id}/role`, {
                          method: 'PATCH',
                          body: JSON.stringify({ role }),
                        }).then(() => load())
                      }
                    />
                  ),
              },
              {
                title: '',
                width: 105,
                align: 'right',
                render: (_, row: Member) =>
                  canAdmin && row.role !== 'owner' && row.userId !== agent?.id ? (
                    <div className="flex justify-end">
                      <Popconfirm
                        title={`Sign out ${row.name}?`}
                        description="All sessions for this workspace will be invalidated."
                        okText="Sign out"
                        onConfirm={() => revokeSessions(row)}
                      >
                        <Button
                          type="text"
                          aria-label={`Revoke sessions for ${row.name}`}
                          title="Revoke sessions"
                          icon={<LogOut size={15} />}
                          loading={revokingMemberId === row.id}
                        />
                      </Popconfirm>
                      <Popconfirm
                        title={`Remove ${row.name}?`}
                        description="They will immediately lose access to this workspace."
                        okText="Remove"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => removeMember(row)}
                      >
                        <Button
                          danger
                          type="text"
                          aria-label={`Remove ${row.name}`}
                          title="Remove member"
                          icon={<Trash2 size={15} />}
                          loading={removingMemberId === row.id}
                        />
                      </Popconfirm>
                    </div>
                  ) : null,
              },
            ]}
          />
        </section>
        {canAdmin && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="font-bold">Pending invitations</h2>
              <p className="text-xs text-slate-500">
                Cancel links that should no longer grant workspace access.
              </p>
            </div>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={(data?.invitations || []).filter(
                (invitation) =>
                  !invitation.acceptedAt &&
                  !invitation.canceledAt &&
                  new Date(invitation.expiresAt) > new Date(),
              )}
              locale={{ emptyText: 'No pending invitations' }}
              columns={[
                {
                  title: 'Invitee',
                  render: (_, row: Invitation) => row.email || 'Shareable invitation link',
                },
                { title: 'Role', dataIndex: 'role', render: (role: string) => <Tag>{role}</Tag> },
                {
                  title: 'Expires',
                  dataIndex: 'expiresAt',
                  render: (value: string) => formatDateTime(value),
                },
                {
                  title: '',
                  width: 60,
                  align: 'right',
                  render: (_, row: Invitation) => (
                    <Popconfirm
                      title="Cancel this invitation?"
                      description="Its link will stop working immediately."
                      okText="Cancel invitation"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => cancelInvitation(row)}
                    >
                      <Button
                        danger
                        type="text"
                        aria-label="Cancel invitation"
                        icon={<XCircle size={16} />}
                        loading={cancelingInvitationId === row.id}
                      />
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </section>
        )}
      </div>
      <Modal
        title="Invite member"
        open={inviteOpen}
        onCancel={() => setInviteOpen(false)}
        onOk={() => (inviteUrl ? setInviteOpen(false) : void createInvite())}
        okText={inviteUrl ? 'Done' : 'Create invitation'}
      >
        <div className="space-y-4">
          {inviteUrl ? (
            <Input
              readOnly
              value={inviteUrl}
              addonAfter={
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(inviteUrl).then(() => message.success('Link copied'))
                  }
                >
                  Copy
                </button>
              }
            />
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Existing Relay users can join with their current account. New users will create an account
                when they accept.
              </p>
              <Input
                placeholder="Email (optional for link invitation)"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value || undefined })}
              />
              <Select
                className="w-full"
                value={invite.role}
                onChange={(role) => setInvite({ ...invite, role })}
                options={[
                  { value: 'admin', label: 'Admin — manage team and reply' },
                  { value: 'agent', label: 'Agent — reply to conversations' },
                  { value: 'viewer', label: 'Viewer — read only' },
                ]}
              />
            </>
          )}
        </div>
      </Modal>
    </main>
  );
}
