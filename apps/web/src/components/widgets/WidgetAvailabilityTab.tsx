import { useEffect, useMemo, useState } from 'react';
import { App, Button, Input, InputNumber, Select, Switch, Tag } from 'antd';
import type { BusinessHour, ChatWidget } from '../../types';
import { apiRequest } from '../../lib/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_HOURS: BusinessHour[] = DAYS.map((_, day) => ({
  day,
  enabled: day > 0 && day < 6,
  start: '09:00',
  end: '17:00',
}));
type Form = Pick<
  ChatWidget,
  | 'availabilityMode'
  | 'timezone'
  | 'businessHours'
  | 'offlineFormEnabled'
  | 'offlineMessage'
  | 'expectedResponseTime'
  | 'maxActiveConversationsPerAgent'
> & { holidays: string };

export function WidgetAvailabilityTab({
  widget,
  canAdmin,
  onUpdate,
}: {
  widget: ChatWidget;
  canAdmin: boolean;
  onUpdate(widget: ChatWidget): void;
}) {
  const { message } = App.useApp();
  const [form, setForm] = useState<Form>(() => fromWidget(widget));
  const [saving, setSaving] = useState(false);
  const timezoneOptions = useMemo(() => {
    const current = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] })
      .supportedValuesOf;
    const supported = supportedValuesOf
      ? supportedValuesOf('timeZone')
      : ['Asia/Bangkok', 'Europe/London', 'America/New_York'];
    return [...new Set([current, 'UTC', ...supported])].map((value) => ({ value, label: value }));
  }, []);
  useEffect(() => setForm(fromWidget(widget)), [widget]);
  const updateHour = (day: number, changes: Partial<BusinessHour>) =>
    setForm((current) => ({
      ...current,
      businessHours: current.businessHours.map((item) => (item.day === day ? { ...item, ...changes } : item)),
    }));
  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiRequest<ChatWidget>(`/workspace/widgets/${widget.id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          holidays: form.holidays
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      onUpdate(updated);
      message.success('Availability saved');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not save availability');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Operating mode" description="Override or follow the weekly schedule.">
        <Field label="Mode">
          <Select
            className="w-full"
            disabled={!canAdmin}
            value={form.availabilityMode}
            onChange={(availabilityMode) => setForm({ ...form, availabilityMode })}
            options={[
              { value: 'auto', label: 'Automatic — follow business hours' },
              { value: 'online', label: 'Always online' },
              { value: 'offline', label: 'Always offline' },
            ]}
          />
        </Field>
        <Field label="Timezone">
          <Select
            className="w-full"
            showSearch
            disabled={!canAdmin}
            value={form.timezone}
            options={timezoneOptions}
            onChange={(timezone) => setForm({ ...form, timezone })}
          />
        </Field>
      </Card>
      <Card title="Visitor messaging" description="Set expectations and collect messages while offline.">
        <Field label="Expected response time">
          <Input
            disabled={!canAdmin}
            value={form.expectedResponseTime}
            onChange={(event) => setForm({ ...form, expectedResponseTime: event.target.value })}
          />
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <span>
            <b className="block text-xs">Offline contact form</b>
            <small className="text-slate-400">Create a conversation while away</small>
          </span>
          <Switch
            disabled={!canAdmin}
            checked={form.offlineFormEnabled}
            onChange={(offlineFormEnabled) => setForm({ ...form, offlineFormEnabled })}
          />
        </div>
        <Field label="Offline message">
          <Input.TextArea
            disabled={!canAdmin}
            value={form.offlineMessage}
            maxLength={300}
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={(event) => setForm({ ...form, offlineMessage: event.target.value })}
          />
        </Field>
      </Card>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <h2 className="font-bold">Weekly business hours</h2>
        <p className="mt-1 text-xs text-slate-500">Used in Automatic mode. Overnight ranges are supported.</p>
        <div className="mt-5 divide-y divide-slate-100">
          {form.businessHours.map((hours) => (
            <div
              key={hours.day}
              className="grid grid-cols-[110px_1fr] items-center gap-4 py-3 sm:grid-cols-[130px_1fr_auto]"
            >
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Switch
                  size="small"
                  disabled={!canAdmin}
                  checked={hours.enabled}
                  onChange={(enabled) => updateHour(hours.day, { enabled })}
                />
                {DAYS[hours.day]}
              </label>
              {hours.enabled ? (
                <div className="flex items-center gap-2">
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    disabled={!canAdmin}
                    type="time"
                    value={hours.start}
                    onChange={(event) => updateHour(hours.day, { start: event.target.value })}
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    disabled={!canAdmin}
                    type="time"
                    value={hours.end}
                    onChange={(event) => updateHour(hours.day, { end: event.target.value })}
                  />
                </div>
              ) : (
                <Tag className="w-fit">Closed</Tag>
              )}
            </div>
          ))}
        </div>
      </section>
      <Card
        title="Holiday schedule"
        description="One YYYY-MM-DD date per line; holidays are offline all day."
      >
        <Input.TextArea
          className="font-mono text-xs"
          disabled={!canAdmin}
          value={form.holidays}
          placeholder={'2026-12-25\n2027-01-01'}
          autoSize={{ minRows: 4, maxRows: 8 }}
          onChange={(event) => setForm({ ...form, holidays: event.target.value })}
        />
      </Card>
      <Card title="Agent workload" description="Prevent assigning too many open conversations.">
        <Field label="Maximum active conversations per agent">
          <InputNumber
            className="w-full"
            disabled={!canAdmin}
            min={0}
            max={1000}
            value={form.maxActiveConversationsPerAgent}
            onChange={(value) => setForm({ ...form, maxActiveConversationsPerAgent: value || 0 })}
          />
        </Field>
        <p className="text-xs text-slate-400">
          Use 0 for unlimited. Checked during assignment and reopening.
        </p>
      </Card>
      <div className="flex justify-end lg:col-span-2">
        <Button type="primary" disabled={!canAdmin} loading={saving} onClick={() => void save()}>
          Save availability
        </Button>
      </div>
    </div>
  );
}

function fromWidget(widget: ChatWidget): Form {
  return {
    availabilityMode: widget.availabilityMode || 'auto',
    timezone: widget.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    businessHours: widget.businessHours?.length ? widget.businessHours : DEFAULT_HOURS,
    holidays: (widget.holidays || []).join('\n'),
    offlineFormEnabled: widget.offlineFormEnabled ?? true,
    offlineMessage:
      widget.offlineMessage || 'We are currently offline. Leave a message and we will get back to you.',
    expectedResponseTime: widget.expectedResponseTime || 'Typically replies within a few minutes',
    maxActiveConversationsPerAgent: widget.maxActiveConversationsPerAgent || 0,
  };
}
function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
