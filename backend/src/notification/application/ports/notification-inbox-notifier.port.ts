import type { AdminContactItem } from '../services/admin-contact.service';

export const NOTIFICATION_INBOX_NOTIFIER = Symbol('NOTIFICATION_INBOX_NOTIFIER');

export interface NotificationInboxNotifier {
  notifyInboxItem(userId: number, item: AdminContactItem): Promise<void>;
  notifyInboxRemoved(
    userId: number,
    payload: { ids: string[]; contactId: string },
  ): Promise<void>;
}
