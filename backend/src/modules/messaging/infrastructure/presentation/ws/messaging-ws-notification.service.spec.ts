import { MessagePresenterService } from '../../../application/services/message-presenter.service';
import type { PrivateMessageRecord } from '../../../application/models/private-message.model';
import { MessagingWsNotificationService } from './messaging-ws-notification.service';

describe('MessagingWsNotificationService', () => {
  it('does not report a saved message as failed when notification counters fail', async () => {
    const notifications = {
      notifyUser: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const counts = {
      notifyCounts: jest
        .fn()
        .mockRejectedValue(new Error('counter unavailable')),
    };
    const service = new MessagingWsNotificationService(
      notifications,
      counts,
      new MessagePresenterService(),
    );
    const message = {
      messageId: 'message-1',
      sender: { id: 1, username: 'Alice' },
      recipient: { id: 2, username: 'Bob' },
      message: 'Bonjour',
      subject: 'Sujet',
      createdAt: new Date('2026-09-16T12:00:00Z'),
    } as PrivateMessageRecord;
    await expect(
      service.notifyMessageSent(2, message),
    ).resolves.toBeUndefined();
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(counts.notifyCounts).toHaveBeenCalledWith(2);
  });
});
