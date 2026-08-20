import { BadRequestException } from '@nestjs/common';
import { AdminClientUpdateForceLatestService } from './admin-client-update-force-latest.service';

describe('AdminClientUpdateForceLatestService', () => {
  function createSharedMock() {
    const clientUpdates = {
      saveLatest: jest.fn(async () => undefined),
      resolveClientPublicUrl: jest.fn(() => 'https://example.test/client'),
    };
    const notifications = {
      notifyUser: jest.fn(async () => undefined),
    };
    return {
      requirePublishedLatestVersion: jest.fn(),
      listRecipientIds: jest.fn(),
      getClientUpdatesService: jest.fn(() => clientUpdates),
      getNotificationService: jest.fn(() => notifications),
      clientUpdates,
      notifications,
    };
  }

  it('broadcasts the latest required version', async () => {
    const shared = createSharedMock();
    shared.requirePublishedLatestVersion.mockResolvedValue({
      latestVersion: '2.1.0',
      latest: {
        version: '2.1.0',
        publishedAt: '2026-08-20T10:00:00.000Z',
        message: 'meta message',
        publicUrl: '/latest',
      },
    });
    shared.listRecipientIds.mockResolvedValue([1, 2]);
    const service = new AdminClientUpdateForceLatestService(shared as any);

    const result = await service.execute({
      actor: { id: 7, username: 'admin' },
      message: 'force now',
    });

    expect(shared.clientUpdates.saveLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '2.1.0',
        minRequiredVersion: '2.1.0',
      }),
    );
    expect(shared.notifications.notifyUser).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ delivered: 2, minRequiredVersion: '2.1.0' });
  });

  it('propagates the missing published version error', async () => {
    const shared = createSharedMock();
    shared.requirePublishedLatestVersion.mockRejectedValue(
      new BadRequestException('missing'),
    );
    const service = new AdminClientUpdateForceLatestService(shared as any);

    await expect(
      service.execute({ actor: { id: 1, username: 'admin' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
