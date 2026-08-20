export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type SuccessEnvelope<T> = { success: true; data: T };
type ErrorEnvelope = { success: false; error: { message: string[] } };
type SessionResult = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'agent' | 'viewer' | null;
    workspaceId: string | null;
  };
};

let refreshPromise: Promise<SessionResult> | null = null;

export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, false, false);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true, false);
}

export async function refreshSession(): Promise<SessionResult> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (response) => {
        const body = (await response.json()) as SuccessEnvelope<SessionResult> | ErrorEnvelope;
        if (!response.ok || !body.success) {
          throw new Error(!body.success ? body.error.message[0] : 'Session refresh failed');
        }
        localStorage.setItem('relay-agent-token', body.data.accessToken);
        localStorage.setItem('relay-agent-user', JSON.stringify(body.data.user));
        return body.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function ensureAccessToken(): Promise<string> {
  const token = localStorage.getItem('relay-agent-token');
  if (!token || expiresSoon(token)) return (await refreshSession()).accessToken;
  return token;
}

async function request<T>(
  path: string,
  init: RequestInit,
  authenticated: boolean,
  retried: boolean,
): Promise<T> {
  let token = localStorage.getItem('relay-agent-token');
  if (authenticated) {
    try {
      token = await ensureAccessToken();
    } catch {
      clearSession();
      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (authenticated && response.status === 401 && !retried) {
    try {
      await refreshSession();
      return request<T>(path, init, true, true);
    } catch {
      clearSession();
      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  const body = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  if (!response.ok || !body.success) {
    if (authenticated && response.status === 401) clearSession();
    throw new Error(!body.success ? body.error.message[0] : 'Request failed');
  }
  return body.data;
}

function expiresSoon(token: string) {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return true;
    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const payload = JSON.parse(atob(paddedPayload)) as {
      exp?: number;
    };
    return !payload.exp || payload.exp * 1_000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

function clearSession() {
  localStorage.removeItem('relay-agent-token');
  localStorage.removeItem('relay-agent-user');
  window.dispatchEvent(new Event('relay:unauthorized'));
}
