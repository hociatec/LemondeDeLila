import { AdminBroadcastService } from './admin-broadcast.service';

it('finishes each notification batch before reading the next one', async () => {
  let nextBatchRead = false;
  let unblock!: () => void;
  let firstSent!: () => void;
  const sent = new Promise<void>((resolve) => {
    firstSent = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const users = {
    async *scanIdBatches() {
      yield [1, 2];
      nextBatchRead = true;
      yield [3];
    },
  };
  const notifyUser = jest.fn(async (userId: number) => {
    if (userId === 1) {
      firstSent();
      await blocked;
    }
  });
  const service = new AdminBroadcastService(
    users,
    {
      notifyUser,
      disconnectAll: jest.fn(),
    },
    { now: () => 1000 },
  );
  const result = service.broadcast({
    message: 'maintenance',
    fromUserId: 9,
    fromUsername: 'admin',
    eventType: 'admin.message',
  });
  await sent;
  expect(nextBatchRead).toBe(false);
  unblock();
  await expect(result).resolves.toEqual({ delivered: 3 });
  expect(notifyUser.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);
});
