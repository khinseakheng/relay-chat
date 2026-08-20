const { WidgetService } = require('../dist/chat/widget.service.js');

const widget = new WidgetService({ sign: () => 'test-token' });
const page = widget.page({
  siteId: 'demo',
  title: 'Chat with Relay',
  color: '#6557e8',
  widgetToken: 'test-token',
  available: true,
  offlineFormEnabled: true,
  offlineMessage: 'Leave a message',
  expectedResponseTime: 'Typically replies within a few minutes',
  greeting: 'Tell us what you need.',
  welcomeMessage: 'Hi there!',
  launcherIcon: 'sparkle',
  position: 'bottom-right',
  offsetX: 18,
  offsetY: 18,
  theme: 'light',
  showOnMobile: true,
  language: 'en',
  preChatFields: {
    name: { enabled: true, required: true },
    email: { enabled: true, required: false },
  },
  customFields: [],
  attachmentMaxSizeMb: 5,
  attachmentAllowedTypes: ['images', 'pdf'],
});
const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1].trim())
  .filter(Boolean);

new Function(widget.loader());
for (const script of scripts) new Function(script);

console.log(`Widget syntax check passed (${scripts.length + 1} scripts).`);
