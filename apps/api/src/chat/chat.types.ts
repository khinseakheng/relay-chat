export type Sender = 'visitor' | 'agent';

export interface Message {
  id: string;
  conversationId: string;
  sender: Sender;
  senderName: string;
  senderUserId?: string;
  text: string;
  attachmentName?: string;
  attachmentMime?: string;
  attachmentUrl?: string;
  attachmentKey?: string;
  attachmentSize?: number;
  createdAt: string;
  deletedAt?: string;
}

export interface Conversation {
  id: string;
  visitor: { name: string; email: string; location: string; browser: string; initials: string };
  status: 'open' | 'closed';
  unread: number;
  assignedTo: string;
  page: string;
  startedAt: string;
  messages: Message[];
}
