import { useEffect, useState } from 'react';
import { App, Button, Input, Modal, Select, Spin, Tabs } from 'antd';
import { Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { WidgetAppearanceTab } from '../components/widgets/WidgetAppearanceTab';
import { WidgetAvailabilityTab } from '../components/widgets/WidgetAvailabilityTab';
import { WidgetInstallTab } from '../components/widgets/WidgetInstallTab';
import { WidgetSecurityTab } from '../components/widgets/WidgetSecurityTab';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import type { ChatWidget } from '../types';

type WidgetTab = 'install' | 'appearance' | 'availability' | 'security';
const TABS: WidgetTab[] = ['install', 'appearance', 'availability', 'security'];

export function WidgetsPage() {
  const { message } = App.useApp();
  const { agent } = useAuth();
  const { widgetId, tab } = useParams();
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<ChatWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [widgetName, setWidgetName] = useState('Website chat');
  const [creating, setCreating] = useState(false);
  const canAdmin = agent?.role === 'owner' || agent?.role === 'admin';
  const activeTab: WidgetTab = TABS.includes(tab as WidgetTab) ? (tab as WidgetTab) : 'install';
  const selected = widgets.find((widget) => widget.id === widgetId) || widgets[0];

  useEffect(() => {
    apiRequest<ChatWidget[]>('/workspace/widgets')
      .then(setWidgets)
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => {
    if (!widgets.length) return;
    const validWidget = widgets.some((widget) => widget.id === widgetId);
    if (!validWidget || tab !== activeTab) {
      navigate(`/widgets/${validWidget ? widgetId : widgets[0].id}/${activeTab}`, { replace: true });
    }
  }, [activeTab, navigate, tab, widgetId, widgets]);

  const updateWidget = (updated: ChatWidget) => {
    setWidgets((current) => current.map((widget) => (widget.id === updated.id ? updated : widget)));
  };
  const createWidget = async () => {
    setCreating(true);
    try {
      const created = await apiRequest<ChatWidget>('/workspace/widgets', {
        method: 'POST',
        body: JSON.stringify({ name: widgetName }),
      });
      setWidgets((current) => [...current, created]);
      setCreateOpen(false);
      navigate(`/widgets/${created.id}/install`);
      message.success('Widget created');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not create widget');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="CUSTOMER CHAT"
          title="Widgets"
          description="Install, customize, schedule, and secure each customer-facing chat widget."
        />
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-6 pt-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 pb-4 md:flex-row md:items-center">
            <Select
              className="w-full md:w-80"
              loading={loading}
              value={selected?.id}
              placeholder="Select a widget"
              options={widgets.map((widget) => ({ value: widget.id, label: widget.name }))}
              onChange={(id) => navigate(`/widgets/${id}/${activeTab}`)}
            />
            {canAdmin && (
              <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
                New widget
              </Button>
            )}
          </div>
          <Tabs
            activeKey={activeTab}
            items={TABS.map((key) => ({
              key,
              label: key.charAt(0).toUpperCase() + key.slice(1),
            }))}
            onChange={(key) => selected && navigate(`/widgets/${selected.id}/${key}`)}
          />
        </section>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <Spin />
          </div>
        ) : selected ? (
          <>
            {activeTab === 'install' && <WidgetInstallTab widget={selected} />}
            {activeTab === 'appearance' && (
              <WidgetAppearanceTab widget={selected} canAdmin={canAdmin} onUpdate={updateWidget} />
            )}
            {activeTab === 'availability' && (
              <WidgetAvailabilityTab widget={selected} canAdmin={canAdmin} onUpdate={updateWidget} />
            )}
            {activeTab === 'security' && (
              <WidgetSecurityTab widget={selected} canAdmin={canAdmin} onUpdate={updateWidget} />
            )}
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <h2 className="font-bold">No widgets yet</h2>
            <p className="mt-2 text-sm text-slate-500">Create a widget to start accepting conversations.</p>
            {canAdmin && (
              <Button className="mt-5" type="primary" onClick={() => setCreateOpen(true)}>
                Create widget
              </Button>
            )}
          </section>
        )}
      </div>
      <Modal
        title="Create chat widget"
        open={createOpen}
        confirmLoading={creating}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void createWidget()}
      >
        <Input
          autoFocus
          value={widgetName}
          onChange={(event) => setWidgetName(event.target.value)}
          onPressEnter={() => void createWidget()}
          placeholder="Widget name"
        />
      </Modal>
    </main>
  );
}
