import { UserBadgeCountsService } from './user-badge-counts.service';

describe('notification services', () => {
  it('aggregates notification and message unread counts', async () => {
    const inbox = { countUnread: jest.fn().mockResolvedValue(3) };
    const messages = {
      countUnreadForRecipient: jest.fn().mockResolvedValue(4),
    };
    const service = new UserBadgeCountsService(inbox as any, messages as any);
    await expect(service.getCounts(7)).resolves.toEqual({
      unreadNotifications: 3,
      unreadMessages: 4,
    });
  });

  it('propagates storage failures instead of reporting false zeroes', async () => {
    const failure = new Error('storage unavailable');
    const inbox = { countUnread: jest.fn().mockRejectedValue(failure) };
    const messages = {
      countUnreadForRecipient: jest.fn().mockResolvedValue(0),
    };
    const service = new UserBadgeCountsService(inbox as any, messages as any);
    await expect(service.getCounts(7)).rejects.toBe(failure);
  });
});
