import { io } from 'socket.io-client';
import { API_URL } from './api';

export const chatSocket = io(API_URL, { autoConnect: false });

export function connectAgentSocket(token: string) {
  const currentToken = (chatSocket.auth as { token?: string } | undefined)?.token;
  if (chatSocket.connected && currentToken !== token) chatSocket.disconnect();
  chatSocket.auth = { token };
  if (!chatSocket.connected) chatSocket.connect();
}
