export type AdminContactStatus = 'open' | 'in_progress' | 'handled';

export type AdminContactItem = {
  kind: 'admin_contact';
  contactId: string;
  message: string;
  fromUserId: number;
  fromUsername: string;
  toUserId?: number;
  id: string;
  createdAt: string;
  readAt?: string | null;
  status?: AdminContactStatus;
  handled?: boolean;
  statusAt?: string | null;
  statusByUserId?: number | null;
  statusByUsername?: string | null;
  handledAt?: string | null;
  handledByUserId?: number | null;
  handledByUsername?: string | null;
};

export type AdminContactThreadSummary = {
  kind: 'admin_contact';
  contactId: string;
  latestId: string;
  latestCreatedAt: string;
  latestReadAt?: string | null;
  latestMessage: string;
  fromUserId: number;
  fromUsername: string;
  toUserId?: number | null;
  unreadCount: number;
  status: AdminContactStatus;
  handled: boolean;
  statusAt?: string | null;
  statusByUserId?: number | null;
  statusByUsername?: string | null;
  handledAt?: string | null;
  handledByUserId?: number | null;
  handledByUsername?: string | null;
};
