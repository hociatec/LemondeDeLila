import { AdminClientUpdateSchedulerService } from './admin-client-update-scheduler.service';

describe('AdminClientUpdateSchedulerService lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('cancels its explicitly ephemeral schedule during shutdown', async () => {
    const notifications = { disconnectAll: jest.fn() };
    const dispatch = {
      sendImminentNotification: jest.fn().mockResolvedValue(undefined),
      sendForcedUpdate: jest.fn().mockResolvedValue(2),
    };
    const scheduledAtMs = Date.now() + 1_000;
    const service = new AdminClientUpdateSchedulerService(
      {
        listRecipientIds: jest.fn().mockResolvedValue([1, 2]),
        getNotificationService: () => notifications,
        getClientUpdatesService: () => ({}),
      } as never,
      {
        createPlan: () => ({
          scheduledAtMs,
          warningDelayMs: 500,
          delayMs: 1_000,
          effectiveDelaySeconds: 1,
          imminentMessage: 'imminent',
        }),
      } as never,
      dispatch as never,
    );

    await service.schedule({} as never);
    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2_000);

    expect(dispatch.sendImminentNotification).not.toHaveBeenCalled();
    expect(dispatch.sendForcedUpdate).not.toHaveBeenCalled();
    expect(notifications.disconnectAll).not.toHaveBeenCalled();
  });
});
