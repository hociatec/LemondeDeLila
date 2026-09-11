import { Injectable } from '@nestjs/common';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import type { AdminContactItem } from '../../../application/models/admin-contact.model';
import { NotificationDispatchService } from '../../system/notification-dispatch.service';

@Injectable()
export class NotificationWsInboxNotifierService {
  constructor(private readonly notifications: NotificationDispatchService) {}

  notifyInboxItem(userId: number, item: AdminContactItem): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.notify.inbox.item,
      item,
    );
  }

  notifyInboxRemoved(
    userId: number,
    payload: { ids: string[]; contactId: string },
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.notify.inbox.removed,
      payload,
    );
  }
}
