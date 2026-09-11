import { RoomVaultAdapter } from './room-vault.adapter';
import { buildTestRoomPayload } from '../presentation/ws/tests/backend-test-builders';

it('exposes an independent versioned snapshot source without lobby or ORM details', async () => {
  const fixture = buildTestRoomPayload();
  const startedAt = new Date('2026-09-08T10:00:00.000Z');
  const payload = {
    ...fixture,
    room: { ...fixture.room, startedAt, bots: [{ id: 8, name: 'Bot' }] },
  };
  const adapter = new RoomVaultAdapter(
    {} as never,
    {} as never,
    {} as never,
    { getRoomPayload: jest.fn().mockResolvedValue(payload) } as never,
  );
  const source = await adapter.getRoomPayload(10);
  expect(source.schemaVersion).toBe(1);
  expect(source.room.startedAt).toBe(startedAt.toISOString());
  expect(source).not.toHaveProperty('manifest');
  expect(source.room).not.toHaveProperty('counts');
  expect(source.room).not.toHaveProperty('allowedActions');
  source.room.players[0].username = 'changed';
  source.room.bots[0].name = 'changed';
  expect(payload.room.players[0].username).toBe('owner');
  expect(payload.room.bots[0].name).toBe('Bot');
});
