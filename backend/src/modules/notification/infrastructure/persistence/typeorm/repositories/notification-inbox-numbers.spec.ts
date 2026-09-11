import { NotificationInboxTypeormRepository } from './notification-inbox-typeorm.repository';

async function read(row: Record<string, unknown>) {
  const builder = {
    ...Object.fromEntries(
      ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'limit'].map(
        (method) => [method, jest.fn().mockReturnThis()],
      ),
    ),
    getRawMany: jest.fn().mockResolvedValue([row]),
  };
  return new NotificationInboxTypeormRepository(
    {
      createQueryBuilder: () => builder,
    } as never,
    { now: () => Date.now() },
  ).listByContactId('message', 'contact-1');
}
const row = {
  id: 'notification-1',
  userId: '12',
  kind: 'message',
  fromUserId: '2',
  toUserId: null,
  createdAt: '2026-09-09T00:00:00.000Z',
};
it('preserves decimal SQL identifiers and nullable references', async () => {
  expect(await read(row)).toEqual([
    expect.objectContaining({ userId: 12, fromUserId: 2, toUserId: null }),
  ]);
});
it.each(['userId', 'fromUserId', 'toUserId'])(
  'never exposes a coerced SQL %s',
  async (field) => {
    for (const value of [true, '2tail', 1.5, '9007199254740992']) {
      expect(await read({ ...row, [field]: value })).toEqual([]);
    }
  },
);
