import { useCallback, useEffect, useState } from 'react';
import { App, Button, Checkbox, InputNumber, Table, Tag } from 'antd';
import { FileLock2, ScrollText, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { AttachmentCategory, AttachmentPolicy } from '../types';

type AuditItem = {
  id: string;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
type AuditPage = {
  items: AuditItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

const TYPE_OPTIONS: Array<{ value: AttachmentCategory; label: string; description: string }> = [
  { value: 'images', label: 'Images', description: 'PNG, JPEG, GIF, WebP, AVIF' },
  { value: 'pdf', label: 'PDF', description: 'PDF documents' },
  { value: 'documents', label: 'Documents', description: 'Microsoft Word documents' },
  { value: 'spreadsheets', label: 'Spreadsheets', description: 'Microsoft Excel spreadsheets' },
  { value: 'archives', label: 'Archives', description: 'ZIP archives' },
  { value: 'text', label: 'Text and CSV', description: 'Plain text and CSV files' },
];

export function AdministrationPage() {
  const { message } = App.useApp();
  const { agent } = useAuth();
  const canAdmin = agent?.role === 'owner' || agent?.role === 'admin';
  const [policy, setPolicy] = useState<AttachmentPolicy>({ maxSizeMb: 5, allowedTypes: [] });
  const [audit, setAudit] = useState<AuditPage>({ items: [], page: 1, limit: 20, total: 0, hasMore: false });
  const [saving, setSaving] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAudit = useCallback(
    async (page = 1) => {
      if (!canAdmin) return;
      setLoadingAudit(true);
      try {
        setAudit(await apiRequest<AuditPage>(`/workspace/audit-log?page=${page}&limit=20`));
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Could not load audit log');
      } finally {
        setLoadingAudit(false);
      }
    },
    [canAdmin, message],
  );

  useEffect(() => {
    if (!canAdmin) return;
    apiRequest<AttachmentPolicy>('/workspace/attachment-policy')
      .then(setPolicy)
      .catch((error: Error) => message.error(error.message));
    void loadAudit();
  }, [canAdmin, loadAudit, message]);

  const savePolicy = async () => {
    setSaving(true);
    try {
      const updated = await apiRequest<AttachmentPolicy>('/workspace/attachment-policy', {
        method: 'PATCH',
        body: JSON.stringify(policy),
      });
      setPolicy(updated);
      message.success('Attachment policy saved');
      void loadAudit();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not save attachment policy');
    } finally {
      setSaving(false);
    }
  };

  if (!canAdmin) {
    return (
      <main className="grid flex-1 place-items-center bg-slate-50 p-8">
        <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto text-slate-400" size={30} />
          <h1 className="mt-4 text-xl font-bold">Administrator access required</h1>
          <p className="mt-2 text-sm text-slate-500">
            Only workspace owners and administrators can manage security controls or view audit events.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="WORKSPACE"
          title="Security and administration"
          description="Control file sharing, review sensitive activity, and protect workspace access."
        />

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex gap-3">
            <FileLock2 className="text-brand" size={20} />
            <div>
              <h2 className="font-bold">Attachment policy</h2>
              <p className="text-xs text-slate-500">
                Applied to files sent by both team members and website visitors.
              </p>
            </div>
          </div>
          <label className="mt-6 block text-xs font-semibold">
            Maximum file size
            <span className="mt-2 flex items-center gap-2">
              <InputNumber
                className="w-32"
                min={1}
                max={25}
                value={policy.maxSizeMb}
                onChange={(maxSizeMb) => setPolicy({ ...policy, maxSizeMb: maxSizeMb ?? 1 })}
              />
              <span className="text-sm text-slate-500">MB per attachment</span>
            </span>
          </label>
          <div className="mt-6">
            <h3 className="text-xs font-semibold">Allowed file types</h3>
            <p className="mt-1 text-xs text-slate-400">Leave all unchecked to disable attachments.</p>
            <Checkbox.Group
              className="mt-3 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3"
              value={policy.allowedTypes}
              onChange={(values) => setPolicy({ ...policy, allowedTypes: values as AttachmentCategory[] })}
            >
              {TYPE_OPTIONS.map((option) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"
                  key={option.value}
                >
                  <Checkbox value={option.value} />
                  <span>
                    <b className="block text-sm">{option.label}</b>
                    <small className="text-slate-400">{option.description}</small>
                  </span>
                </label>
              ))}
            </Checkbox.Group>
          </div>
          <Button className="mt-6" type="primary" loading={saving} onClick={() => void savePolicy()}>
            Save attachment policy
          </Button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex gap-3">
            <ScrollText className="text-brand" size={20} />
            <div>
              <h2 className="font-bold">Workspace audit log</h2>
              <p className="text-xs text-slate-500">A permanent record of security and team changes.</p>
            </div>
          </div>
          <Table
            rowKey="id"
            loading={loadingAudit}
            dataSource={audit.items}
            pagination={{
              current: audit.page,
              pageSize: audit.limit,
              total: audit.total,
              showSizeChanger: false,
              onChange: (page) => void loadAudit(page),
            }}
            locale={{ emptyText: 'No audit events recorded yet' }}
            columns={[
              {
                title: 'Event',
                render: (_, row: AuditItem) => (
                  <div>
                    <b className="block text-sm">{actionLabel(row.action)}</b>
                    <span className="text-xs text-slate-400">by {row.actorName}</span>
                  </div>
                ),
              },
              {
                title: 'Details',
                render: (_, row: AuditItem) => (
                  <div className="flex max-w-md flex-wrap gap-1">
                    {Object.entries(row.metadata).map(([key, value]) => (
                      <Tag key={key}>
                        {humanize(key)}: {Array.isArray(value) ? value.join(', ') : String(value ?? '—')}
                      </Tag>
                    ))}
                  </div>
                ),
              },
              {
                title: 'Time',
                dataIndex: 'createdAt',
                width: 190,
                render: (value: string) => (
                  <span className="text-xs text-slate-500">{formatDateTime(value)}</span>
                ),
              },
            ]}
          />
        </section>
      </div>
    </main>
  );
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    'invitation.created': 'Invitation created',
    'invitation.canceled': 'Invitation canceled',
    'invitation.accepted': 'Invitation accepted',
    'member.role_changed': 'Member role changed',
    'member.removed': 'Member removed',
    'member.sessions_revoked': 'Member sessions revoked',
    'attachment_policy.updated': 'Attachment policy updated',
  };
  return labels[action] || humanize(action);
}

function humanize(value: string) {
  return value
    .replace(/[._]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (text) => text.toUpperCase());
}
