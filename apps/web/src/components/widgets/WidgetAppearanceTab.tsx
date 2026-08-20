import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, InputNumber, Select, Switch } from 'antd';
import { ImagePlus, MessageCircle, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { ChatWidget } from '../../types';
import { apiRequest } from '../../lib/api';

type CustomField = ChatWidget['customFields'][number];
type Form = Pick<
  ChatWidget,
  | 'name'
  | 'title'
  | 'color'
  | 'greeting'
  | 'welcomeMessage'
  | 'launcherIcon'
  | 'position'
  | 'offsetX'
  | 'offsetY'
  | 'theme'
  | 'showOnMobile'
  | 'language'
  | 'preChatFields'
  | 'customFields'
>;

export function WidgetAppearanceTab({
  widget,
  canAdmin,
  onUpdate,
}: {
  widget: ChatWidget;
  canAdmin: boolean;
  onUpdate(widget: ChatWidget): void;
}) {
  const { message } = App.useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(() => fromWidget(widget));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setForm(fromWidget(widget)), [widget]);

  const updateCustomField = (id: string, changes: Partial<CustomField>) =>
    setForm((current) => ({
      ...current,
      customFields: current.customFields.map((field) => (field.id === id ? { ...field, ...changes } : field)),
    }));

  const addCustomField = () =>
    setForm((current) => ({
      ...current,
      customFields: [
        ...current.customFields,
        { id: crypto.randomUUID(), label: '', type: 'text', required: false, options: [] },
      ],
    }));

  const save = async () => {
    if (form.customFields.some((field) => !field.label.trim())) {
      message.error('Every custom field needs a label');
      return;
    }
    if (
      form.customFields.some(
        (field) => field.type === 'select' && !field.options.some((option) => option.trim()),
      )
    ) {
      message.error('Every dropdown field needs at least one option');
      return;
    }
    setSaving(true);
    try {
      await apiRequest<ChatWidget>(`/workspace/widgets/${widget.id}/appearance`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name, title: form.title, color: form.color }),
      });
      const updated = await apiRequest<ChatWidget>(`/workspace/widgets/${widget.id}/customization`, {
        method: 'PATCH',
        body: JSON.stringify({
          greeting: form.greeting,
          welcomeMessage: form.welcomeMessage,
          launcherIcon: form.launcherIcon,
          position: form.position,
          offsetX: form.offsetX,
          offsetY: form.offsetY,
          theme: form.theme,
          showOnMobile: form.showOnMobile,
          language: form.language,
          preChatFields: form.preChatFields,
          customFields: form.customFields,
        }),
      });
      onUpdate(updated);
      message.success('Widget customization saved');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not save customization');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('Choose an image file');
      return;
    }
    if (file.size > 2 * 1_024 * 1_024) {
      message.error('Logo images must be 2 MB or smaller');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const updated = await apiRequest<ChatWidget>(`/workspace/widgets/${widget.id}/logo`, {
        method: 'POST',
        body,
      });
      onUpdate(updated);
      message.success('Widget logo updated');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not upload logo');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Identity and welcome" description="Brand the widget and choose what visitors see first.">
        <Field label="Internal name">
          <Input
            disabled={!canAdmin}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Visitor-facing title">
          <Input
            disabled={!canAdmin}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="Greeting">
          <Input
            disabled={!canAdmin}
            maxLength={200}
            value={form.greeting}
            placeholder="Hi there!"
            onChange={(event) => setForm({ ...form, greeting: event.target.value })}
          />
        </Field>
        <Field label="Welcome message">
          <Input.TextArea
            disabled={!canAdmin}
            maxLength={200}
            rows={3}
            value={form.welcomeMessage}
            placeholder="Tell us what you need. We're happy to help."
            onChange={(event) => setForm({ ...form, welcomeMessage: event.target.value })}
          />
        </Field>
      </Card>

      <Card title="Brand and theme" description="Use a recognizable avatar and match your website.">
        <Field label="Logo or avatar">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-violet-100 text-violet-700">
              {widget.logoUrl ? (
                <img className="h-full w-full object-cover" src={widget.logoUrl} alt="Widget logo" />
              ) : (
                <ImagePlus size={20} />
              )}
            </span>
            <span className="min-w-0 flex-1 text-xs text-slate-500">
              PNG, JPEG, GIF, WebP, or AVIF. Maximum 2 MB.
            </span>
            <input
              ref={fileInput}
              className="hidden"
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,.avif"
              disabled={!canAdmin}
              onChange={(event) => void uploadLogo(event.target.files?.[0])}
            />
            <Button disabled={!canAdmin} loading={uploading} onClick={() => fileInput.current?.click()}>
              Upload
            </Button>
          </div>
        </Field>
        <Field label="Brand color">
          <div className="flex gap-2">
            <input
              className="h-8 w-11 rounded-lg border border-slate-200 bg-white p-1"
              disabled={!canAdmin}
              type="color"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
            />
            <Input
              disabled={!canAdmin}
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
            />
          </div>
        </Field>
        <Field label="Launcher icon">
          <div className="flex items-center gap-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full text-white shadow-md"
              style={{ backgroundColor: form.color }}
            >
              {form.launcherIcon === 'logo' && widget.logoUrl ? (
                <img className="h-full w-full object-cover" src={widget.logoUrl} alt="Launcher preview" />
              ) : form.launcherIcon === 'chat' ? (
                <MessageCircle size={22} />
              ) : (
                <Sparkles size={22} fill="currentColor" />
              )}
            </span>
            <Select
              className="flex-1"
              disabled={!canAdmin}
              value={form.launcherIcon}
              onChange={(launcherIcon) => setForm({ ...form, launcherIcon })}
              options={[
                { value: 'sparkle', label: 'Sparkle' },
                { value: 'chat', label: 'Chat bubble' },
                { value: 'logo', label: 'Uploaded logo', disabled: !widget.logoUrl },
              ]}
            />
          </div>
        </Field>
        <Field label="Theme">
          <Select
            className="w-full"
            disabled={!canAdmin}
            value={form.theme}
            onChange={(theme) => setForm({ ...form, theme })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'auto', label: 'Match visitor device' },
            ]}
          />
        </Field>
        <Field label="Language">
          <Select
            className="w-full"
            disabled={!canAdmin}
            value={form.language}
            onChange={(language) => setForm({ ...form, language })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'km', label: 'Khmer' },
              { value: 'th', label: 'Thai' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
            ]}
          />
        </Field>
      </Card>

      <Card
        title="Launcher placement"
        description="Position the widget without editing your install snippet."
      >
        <Field label="Position">
          <Select
            className="w-full"
            disabled={!canAdmin}
            value={form.position}
            onChange={(position) => setForm({ ...form, position })}
            options={[
              { value: 'bottom-right', label: 'Bottom right' },
              { value: 'bottom-left', label: 'Bottom left' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Side spacing (px)">
            <InputNumber
              className="w-full"
              disabled={!canAdmin}
              min={0}
              max={100}
              value={form.offsetX}
              onChange={(offsetX) => setForm({ ...form, offsetX: offsetX ?? 0 })}
            />
          </Field>
          <Field label="Bottom spacing (px)">
            <InputNumber
              className="w-full"
              disabled={!canAdmin}
              min={0}
              max={100}
              value={form.offsetY}
              onChange={(offsetY) => setForm({ ...form, offsetY: offsetY ?? 0 })}
            />
          </Field>
        </div>
        <ToggleRow
          title="Show on mobile"
          description="Display the launcher on screens narrower than 768px"
          checked={form.showOnMobile}
          disabled={!canAdmin}
          onChange={(showOnMobile) => setForm({ ...form, showOnMobile })}
        />
      </Card>

      <Card title="Pre-chat details" description="Choose the visitor details collected before a chat starts.">
        {(['name', 'email'] as const).map((key) => (
          <div className="rounded-xl border border-slate-200 p-3" key={key}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold capitalize">{key}</span>
              <Switch
                disabled={!canAdmin}
                checked={form.preChatFields[key].enabled}
                onChange={(enabled) =>
                  setForm({
                    ...form,
                    preChatFields: {
                      ...form.preChatFields,
                      [key]: {
                        ...form.preChatFields[key],
                        enabled,
                        required: enabled && form.preChatFields[key].required,
                      },
                    },
                  })
                }
              />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              Required before starting a chat
              <Switch
                size="small"
                disabled={!canAdmin || !form.preChatFields[key].enabled}
                checked={form.preChatFields[key].required}
                onChange={(required) =>
                  setForm({
                    ...form,
                    preChatFields: {
                      ...form.preChatFields,
                      [key]: { ...form.preChatFields[key], required },
                    },
                  })
                }
              />
            </div>
          </div>
        ))}
      </Card>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <span>
            <h2 className="font-bold">Custom pre-chat fields</h2>
            <p className="mt-1 text-xs text-slate-500">
              Collect up to 10 extra details and show them in the inbox.
            </p>
          </span>
          <Button
            icon={<Plus size={15} />}
            disabled={!canAdmin || form.customFields.length >= 10}
            onClick={addCustomField}
          >
            Add field
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {form.customFields.length ? (
            form.customFields.map((field) => (
              <div
                className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_160px_110px_36px]"
                key={field.id}
              >
                <Input
                  disabled={!canAdmin}
                  maxLength={80}
                  value={field.label}
                  placeholder="Field label"
                  onChange={(event) => updateCustomField(field.id, { label: event.target.value })}
                />
                <Select
                  disabled={!canAdmin}
                  value={field.type}
                  onChange={(type) =>
                    updateCustomField(field.id, { type, options: type === 'select' ? field.options : [] })
                  }
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'email', label: 'Email' },
                    { value: 'select', label: 'Dropdown' },
                  ]}
                />
                <span className="flex items-center justify-between gap-2 text-xs text-slate-500 md:justify-center">
                  Required
                  <Switch
                    size="small"
                    disabled={!canAdmin}
                    checked={field.required}
                    onChange={(required) => updateCustomField(field.id, { required })}
                  />
                </span>
                <Button
                  aria-label="Remove custom field"
                  danger
                  disabled={!canAdmin}
                  icon={<Trash2 size={15} />}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      customFields: current.customFields.filter((item) => item.id !== field.id),
                    }))
                  }
                />
                {field.type === 'select' && (
                  <Input
                    className="md:col-span-4"
                    disabled={!canAdmin}
                    value={field.options.join(', ')}
                    placeholder="Dropdown options, separated by commas"
                    onChange={(event) =>
                      updateCustomField(field.id, {
                        options: event.target.value.split(',').map((value) => value.trim()),
                      })
                    }
                  />
                )}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No custom fields yet.
            </div>
          )}
        </div>
      </section>

      <div className="lg:col-span-2">
        <Button type="primary" disabled={!canAdmin} loading={saving} onClick={() => void save()}>
          Save customization
        </Button>
      </div>
    </div>
  );
}

function fromWidget(widget: ChatWidget): Form {
  return {
    name: widget.name,
    title: widget.title,
    color: widget.color,
    greeting: widget.greeting,
    welcomeMessage: widget.welcomeMessage,
    launcherIcon: widget.launcherIcon,
    position: widget.position,
    offsetX: widget.offsetX,
    offsetY: widget.offsetY,
    theme: widget.theme,
    showOnMobile: widget.showOnMobile,
    language: widget.language,
    preChatFields: structuredClone(widget.preChatFields),
    customFields: structuredClone(widget.customFields),
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3">
      <span>
        <b className="block text-xs">{title}</b>
        <small className="text-slate-400">{description}</small>
      </span>
      <Switch disabled={disabled} checked={checked} onChange={onChange} />
    </div>
  );
}
