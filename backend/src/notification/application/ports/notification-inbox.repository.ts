import type {
  CreateNotificationInboxItemInput,
  NotificationInboxContactRow,
  NotificationInboxItemRecord,
  NotificationInboxPayload,
} from '../models/notification-inbox-item.model';

export const NOTIFICATION_INBOX_REPOSITORY = Symbol(
  'NOTIFICATION_INBOX_REPOSITORY',
);

export interface NotificationInboxRepository {
  create(
    input: CreateNotificationInboxItemInput,
  ): Promise<NotificationInboxItemRecord>;
  list(userId: number, limit?: number): Promise<NotificationInboxItemRecord[]>;
  getByIdForUser(
    userId: number,
    id: string,
  ): Promise<NotificationInboxItemRecord | null>;
  markRead(userId: number, id: string): Promise<boolean>;
  delete(userId: number, id: string): Promise<boolean>;
  countUnread(userId: number): Promise<number>;
  listByContactId(
    kind: string,
    contactId: string,
  ): Promise<NotificationInboxContactRow[]>;
  updatePayload(id: string, payload: NotificationInboxPayload): Promise<boolean>;
  deleteManyByIds(ids: string[]): Promise<number>;
}
