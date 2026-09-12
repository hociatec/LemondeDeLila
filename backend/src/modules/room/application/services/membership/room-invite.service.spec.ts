import type { RoomInvite } from '../../models/room-invite.model';
import type { RoomInviteRepository } from '../../ports/room-invite.repository';
import { operationalSettings } from '../../../../../platform/config/public-api';
import { RoomInviteService } from './room-invite.service';

class MemoryInvites implements RoomInviteRepository {
  readonly rows = new Map<string, RoomInvite>();
  async save(invite: RoomInvite) {
    this.rows.set(invite.id, structuredClone(invite));
  }
  async findValidById(id: string, now: number) {
    const row = this.rows.get(id);
    return row && row.expiresAt > now ? structuredClone(row) : null;
  }
  async findActive(roomId: number, toUserId: number, now: number) {
    return structuredClone(
      [...this.rows.values()].find(
        (row) =>
          row.roomId === roomId &&
          row.toUserId === toUserId &&
          row.consumedAt == null &&
          row.expiresAt > now,
      ) ?? null,
    );
  }
  async findActiveRecipientIds(
    roomId: number,
    userIds: readonly number[],
    now: number,
  ) {
    const wanted = new Set(userIds);
    return [
      ...new Set(
        [...this.rows.values()]
          .filter(
            (row) =>
              row.roomId === roomId &&
              wanted.has(row.toUserId) &&
              row.consumedAt == null &&
              row.expiresAt > now,
          )
          .map((row) => row.toUserId),
      ),
    ];
  }
  async consume(id: string, consumedAt: number, now: number, keep: boolean) {
    const row = await this.findValidById(id, now);
    if (!row) return null;
    if (!keep) {
      this.rows.delete(id);
      return row;
    }
    row.consumedAt ??= consumedAt;
    this.rows.set(id, structuredClone(row));
    return structuredClone(row);
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  async deleteExpired(now: number, limit: number) {
    for (const [id, row] of [...this.rows].slice(0, limit))
      if (row.expiresAt <= now) this.rows.delete(id);
  }
  async canSpectate(roomId: number, userId: number, now: number) {
    return [...this.rows.values()].some(
      (row) =>
        row.roomId === roomId &&
        row.toUserId === userId &&
        row.consumedAt != null &&
        row.expiresAt > now,
    );
  }
}

function fixture(now: () => number) {
  const repository = new MemoryInvites();
  return { repository, service: new RoomInviteService({ now }, repository) };
}

it('expires at the exact deadline using the injected clock', async () => {
  let now = 100;
  const { service } = fixture(() => now);
  const invite = await service.create(1, 2, 3);
  expect(invite.expiresAt - invite.createdAt).toBe(
    operationalSettings.roomInviteTtlMs,
  );
  now = invite.expiresAt - 1;
  await expect(service.get(invite.id)).resolves.not.toBeNull();
  now += 1;
  await expect(service.get(invite.id)).resolves.toBeNull();
  await expect(service.consume(invite.id, { keep: true })).resolves.toBeNull();
});

it('shares invitations between instances and persists spectator permission', async () => {
  let now = 0;
  const repository = new MemoryInvites();
  const first = new RoomInviteService({ now: () => now }, repository);
  const second = new RoomInviteService({ now: () => now }, repository);
  const invite = await first.create(1, 2, 3);
  expect((await second.consume(invite.id, { keep: true }))?.consumedAt).toBe(0);
  await expect(first.findActive(1, 3)).resolves.toBeNull();
  await expect(second.canSpectate(1, 3)).resolves.toBe(true);
  await expect(second.canSpectate(1, 4)).resolves.toBe(false);
  now = invite.expiresAt;
  await expect(first.canSpectate(1, 3)).resolves.toBe(false);
});

it('does not expose stored invitations to caller mutation', async () => {
  const { service } = fixture(() => 100);
  const invite = await service.create(1, 2, 3);
  const id = invite.id;
  invite.toUserId = 99;
  invite.expiresAt = 0;
  const active = await service.findActive(1, 3);
  expect(active).not.toBeNull();
  if (active) active.consumedAt = 100;
  const read = await service.get(id);
  if (read) read.consumedAt = 100;
  await expect(service.canSpectate(1, 3)).resolves.toBe(false);
  const consumed = await service.consume(id, { keep: true });
  if (consumed) consumed.toUserId = 99;
  await expect(service.canSpectate(1, 3)).resolves.toBe(true);
  await expect(service.canSpectate(1, 99)).resolves.toBe(false);
});

it('lists pending recipients in one bounded repository read', async () => {
  const { service, repository } = fixture(() => 100);
  await service.create(1, 2, 3);
  await service.create(1, 2, 4);
  const read = jest.spyOn(repository, 'findActiveRecipientIds');
  await expect(service.activeRecipientIds(1, [3, 4, 4, -1])).resolves.toEqual([
    3, 4,
  ]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(1, [3, 4], 100);
});
