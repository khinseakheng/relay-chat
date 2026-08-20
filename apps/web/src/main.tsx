import '@ant-design/v5-patch-for-react-19';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { App as AntdApp, ConfigProvider } from 'antd';
import { AuthProvider } from './hooks/useAuth';
import { ConversationsProvider } from './hooks/useConversations';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#6557e8', borderRadius: 10, fontFamily: 'Inter, ui-sans-serif, system-ui' },
      }}
    >
      <AntdApp>
        <AuthProvider>
          <ConversationsProvider>
            <App />
          </ConversationsProvider>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
