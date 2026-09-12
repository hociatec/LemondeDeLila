import type { QueryRunner } from 'typeorm';
import { PersistRoomInvites1771100000000 } from './1771100000000-PersistRoomInvites';

it('creates a reversible invite table with cascade ownership and lookup indexes', async () => {
  const query = jest.fn(async () => undefined);
  const runner = { query } as unknown as QueryRunner;
  const migration = new PersistRoomInvites1771100000000();
  await migration.up(runner);
  const sql = String(query.mock.calls[0]?.[0]);
  expect(sql).toContain('CREATE TABLE `room_invites`');
  expect(sql).toContain('idx_room_invites_active');
  expect(sql.match(/ON DELETE CASCADE/g)).toHaveLength(3);
  expect(sql).not.toContain('UNSIGNED');
  await migration.down(runner);
  expect(query).toHaveBeenLastCalledWith('DROP TABLE `room_invites`');
});
