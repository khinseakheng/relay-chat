import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { apiRequest, publicRequest, refreshSession } from '../lib/api';

export type Agent = {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer' | null;
  workspaceId: string | null;
};
type LoginResult = { accessToken: string; user: Agent };
type AuthContextValue = {
  agent: Agent | null;
  initializing: boolean;
  login(email: string, password: string): Promise<void>;
  register(input: { email: string; password: string; name: string }): Promise<void>;
  acceptInvitation(token: string, input: { email: string; password: string; name: string }): Promise<void>;
  switchWorkspace(workspaceId: string): Promise<void>;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('relay-agent-user') || 'null') as Agent | null;
    } catch {
      return null;
    }
  });
  const [initializing, setInitializing] = useState(true);

  const logout = () => {
    void publicRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem('relay-agent-token');
    localStorage.removeItem('relay-agent-user');
    setAgent(null);
  };

  const login = async (email: string, password: string) => {
    const result = await publicRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveSession(result);
  };

  const register = async (input: { email: string; password: string; name: string }) => {
    saveSession(
      await publicRequest<LoginResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    );
  };

  const acceptInvitation = async (
    token: string,
    input: { email: string; password: string; name: string },
  ) => {
    saveSession(
      await publicRequest<LoginResult>(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  };

  const switchWorkspace = async (workspaceId: string) => {
    saveSession(await apiRequest<LoginResult>(`/auth/switch-workspace/${workspaceId}`, { method: 'POST' }));
  };

  const saveSession = (result: LoginResult) => {
    localStorage.setItem('relay-agent-token', result.accessToken);
    localStorage.setItem('relay-agent-user', JSON.stringify(result.user));
    setAgent(result.user);
  };

  useEffect(() => {
    const restore = async () => {
      const storedUser = localStorage.getItem('relay-agent-user');
      const storedToken = localStorage.getItem('relay-agent-token');
      if (storedUser && storedToken) {
        setInitializing(false);
        return;
      }
      if (!storedUser) {
        setInitializing(false);
        return;
      }
      try {
        const session = await refreshSession();
        setAgent(session.user);
      } catch {
        localStorage.removeItem('relay-agent-token');
        localStorage.removeItem('relay-agent-user');
        setAgent(null);
      } finally {
        setInitializing(false);
      }
    };
    void restore();
  }, []);

  useEffect(() => {
    window.addEventListener('relay:unauthorized', logout);
    return () => window.removeEventListener('relay:unauthorized', logout);
  }, []);

  const value = { agent, initializing, login, register, acceptInvitation, switchWorkspace, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
