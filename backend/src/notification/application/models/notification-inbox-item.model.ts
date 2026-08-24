export type NotificationInboxPayload = Record<string, unknown> | null;

export type NotificationInboxItemRecord = {
  id: string;
  userId: number;
  kind: string;
  contactId: string | null;
  fromUserId: number | null;
  fromUsername: string | null;
  toUserId: number | null;
  message: string | null;
  payload: NotificationInboxPayload;
  createdAt: Date;
  readAt: Date | null;
  deletedAt: Date | null;
};

export type CreateNotificationInboxItemInput = {
  id: string;
  userId: number;
  kind: string;
  createdAt: Date;
  contactId?: string | null;
  fromUserId?: number | null;
  fromUsername?: string | null;
  toUserId?: number | null;
  message?: string | null;
  payload?: NotificationInboxPayload;
};

export type NotificationInboxContactRow = {
  id: string;
  userId: number;
  kind: string;
  contactId: string | null;
  fromUserId: number | null;
  fromUsername: string | null;
  toUserId: number | null;
  message: string | null;
  payload: NotificationInboxPayload;
  createdAt: Date;
  readAt: Date | null;
};
