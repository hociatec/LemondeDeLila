import type { Repository } from 'typeorm';
import { VaultRoomSnapshotsService } from './vault-room-snapshots.service';
import type { VaultRoomSnapshotEntity } from '../entities/vault-room-snapshot.entity';
import type { RoomBot } from '../../room/entities/room-bot.entity';

type SnapshotRecord = {
  id: string;
  ownerUserId: number;
  name: string;
  gameType: string;
  roomName: string;
  playersLabel: string;
  snapshotJson: string;
  createdAt: Date;
};

describe('VaultRoomSnapshotsService', () => {
  it('supports save -> restore -> save (overwrite restored snapshot)', async () => {
    const snapshotStore = new Map<string, SnapshotRecord>();
    const makeId = (() => {
      let i = 1;
      return () => `snap-${i++}`;
    })();

    const snapshots = {
      find: jest.fn(async ({ where }: any) => {
        const ownerUserId = Number(where?.ownerUserId ?? 0);
        return Array.from(snapshotStore.values()).filter(
          (s) => s.ownerUserId === ownerUserId,
        );
      }),
      findOne: jest.fn(async ({ where }: any) => {
        const id = String(where?.id ?? '');
        const ownerUserId = Number(where?.ownerUserId ?? 0);
        const item = snapshotStore.get(id);
        if (!item || item.ownerUserId !== ownerUserId) return null;
        return item;
      }),
      delete: jest.fn(async ({ id, ownerUserId }: any) => {
        const item = snapshotStore.get(String(id));
        if (!item || item.ownerUserId !== Number(ownerUserId)) {
          return { affected: 0 };
        }
        snapshotStore.delete(String(id));
        return { affected: 1 };
      }),
      create: jest.fn((data: any) => ({
        ...data,
        id: data?.id ?? makeId(),
      })),
      save: jest.fn(async (entity: any) => {
        snapshotStore.set(String(entity.id), entity as SnapshotRecord);
        return entity;
      }),
    } as unknown as Repository<VaultRoomSnapshotEntity>;

    const roomBots = {
      save: jest.fn(async (entity: any) => entity),
    } as unknown as Repository<RoomBot>;

    const room10 = { id: 10 };
    const room20 = { id: 20 };
    let firstSnapshotId = '';
    let ownerActionCalls = 0;
    const rooms = {
      getRoomPayload: jest
        .fn()
        .mockResolvedValueOnce({
          room: {
            id: 10,
            status: 'started',
            startedAt: '2026-02-25T20:10:00.000Z',
            owner: { id: 1 },
            players: [
              { id: 1, username: 'owner' },
              { id: 2, username: 'alice' },
            ],
            spectators: [],
            bots: [{ id: 7, name: 'Bot One' }],
            gameType: 'panier-express',
            name: 'Table test',
            isPrivate: false,
            maxPlayers: 4,
            tableAmbienceSoundId: 'amb-1',
          },
        })
        .mockResolvedValueOnce({
          room: {
            id: 20,
            status: 'started',
            startedAt: '2026-02-25T20:20:00.000Z',
            owner: { id: 1 },
            players: [
              { id: 1, username: 'owner' },
              { id: 2, username: 'alice' },
            ],
            spectators: [],
            bots: [{ id: 99, name: 'Bot One' }],
            gameType: 'panier-express',
            name: 'Table test (restored)',
            isPrivate: false,
            maxPlayers: 4,
            tableAmbienceSoundId: 'amb-1',
          },
        }),
      requireRoomForOwnerAction: jest.fn(async () => {
        ownerActionCalls += 1;
        if (ownerActionCalls === 1) return room10;
        if (ownerActionCalls === 2) return room20;
        if (ownerActionCalls === 3) return room20;
        return {
          id: 20,
          restoredFromSnapshotId: firstSnapshotId,
          restoredOwnerUserId: 1,
        };
      }),
      saveRoom: jest.fn(async (room: any) => room),
      invalidateRoomPayloadCache: jest.fn(async () => undefined),
      adminDestroyRoom: jest.fn(async () => undefined),
      createRoom: jest.fn(async () => ({ id: 20 })),
      joinRoom: jest.fn(async () => undefined),
      startRoom: jest.fn(async () => ({
        startedAt: new Date('2026-02-25T20:21:00.000Z'),
        runId: 123,
      })),
      findLatestActiveRoomForUser: jest.fn(async () => null),
    };

    const bots = {
      addBotSystem: jest.fn(async () => ({ id: 99, name: 'bot-system' })),
    };

    const engine = {
      exportInternalState: jest
        .fn()
        .mockResolvedValueOnce({
          status: 'started',
          metadata: { roomId: 10, roomOwnerId: 1, roomRunId: 11 },
          players: [
            { id: 1, username: 'owner', isBot: false },
            { id: 2, username: 'alice', isBot: false },
            { id: -7, username: 'Bot One', isBot: true },
          ],
          turn: { currentPlayerId: -7 },
        })
        .mockResolvedValueOnce({
          status: 'started',
          metadata: { roomId: 20, roomOwnerId: 1, roomRunId: 123 },
          players: [
            { id: 1, username: 'owner', isBot: false },
            { id: 2, username: 'alice', isBot: false },
            { id: -99, username: 'Bot One', isBot: true },
          ],
          turn: { currentPlayerId: -99 },
        }),
      restoreInternalState: jest.fn(async () => undefined),
    };

    const registry = {
      getHandler: jest.fn(() => ({ displayName: 'Panier Express' })),
    };

    const notifications = {
      notifyUser: jest.fn(async () => undefined),
    };

    const presence = {
      isUserInTavern: jest.fn(() => true),
    };

    const service = new VaultRoomSnapshotsService(
      snapshots,
      roomBots,
      rooms as any,
      bots as any,
      engine as any,
      registry as any,
      notifications as any,
      presence as any,
    );

    const firstSave = await service.save(1, 10);
    firstSnapshotId = firstSave.id;
    expect(typeof firstSave.id).toBe('string');
    expect(firstSave.id.length).toBeGreaterThan(10);
    expect(rooms.adminDestroyRoom).toHaveBeenCalledWith(10);
    const firstSnapshotRaw = snapshotStore.get(firstSave.id);
    expect(firstSnapshotRaw).toBeTruthy();
    const firstSnapshot = JSON.parse(
      String(firstSnapshotRaw?.snapshotJson ?? '{}'),
    );
    expect(firstSnapshot.game?.state?.metadata?.roomId).toBe(10);
    expect(firstSnapshot.game?.state?.turn?.currentPlayerId).toBe(-7);

    const restored = await service.restore(1, firstSave.id);
    expect(restored.roomId).toBe(20);
    expect(bots.addBotSystem).toHaveBeenCalledTimes(1);
    expect(engine.restoreInternalState).toHaveBeenCalledTimes(1);
    const restoredState = (engine.restoreInternalState as jest.Mock).mock
      .calls[0][2];
    expect(restoredState.players.some((p: any) => p.id === -99)).toBe(true);
    expect(restoredState.turn.currentPlayerId).toBe(-99);
    expect(restoredState.metadata.roomId).toBe(20);
    expect(restoredState.metadata.roomRunId).toBe(123);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      1,
      'rooms.restore.ready',
      expect.objectContaining({ roomId: 20 }),
    );
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      2,
      'rooms.restore.ready',
      expect.objectContaining({ roomId: 20 }),
    );

    const secondSave = await service.save(1, 20);
    expect(secondSave.id).toBe(firstSave.id);
    expect(snapshotStore.size).toBe(1);
    const overwrittenRaw = snapshotStore.get(secondSave.id);
    expect(overwrittenRaw).toBeTruthy();
    const overwritten = JSON.parse(
      String(overwrittenRaw?.snapshotJson ?? '{}'),
    );
    expect(overwritten.game?.state?.metadata?.roomId).toBe(20);
    expect(overwritten.game?.state?.turn?.currentPlayerId).toBe(-99);
    expect(overwritten.room?.name).toContain('restored');
    expect(rooms.adminDestroyRoom).toHaveBeenCalledWith(20);
    expect(rooms.adminDestroyRoom).toHaveBeenCalledTimes(2);
  });

  it('abandonRestoredRoom deletes both the restored room and its linked snapshot', async () => {
    const snapshotStore = new Map<string, SnapshotRecord>();
    snapshotStore.set('snap-1', {
      id: 'snap-1',
      ownerUserId: 1,
      name: 'Save 1',
      gameType: 'panier-express',
      roomName: 'Table test',
      playersLabel: 'owner',
      snapshotJson: JSON.stringify({ version: 1 }),
      createdAt: new Date('2026-02-25T20:00:00.000Z'),
    });

    const snapshots = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      delete: jest.fn(async ({ id, ownerUserId }: any) => {
        const item = snapshotStore.get(String(id));
        if (!item || item.ownerUserId !== Number(ownerUserId)) {
          return { affected: 0 };
        }
        snapshotStore.delete(String(id));
        return { affected: 1 };
      }),
      create: jest.fn((data: any) => data),
      save: jest.fn(async (entity: any) => entity),
    } as unknown as Repository<VaultRoomSnapshotEntity>;

    const roomBots = {
      save: jest.fn(async (entity: any) => entity),
    } as unknown as Repository<RoomBot>;

    const rooms = {
      requireRoomForOwnerAction: jest.fn(async () => ({
        id: 20,
        restoredFromSnapshotId: 'snap-1',
        restoredOwnerUserId: 1,
      })),
      adminDestroyRoom: jest.fn(async () => undefined),
    };

    const service = new VaultRoomSnapshotsService(
      snapshots,
      roomBots,
      rooms as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const ok = await service.abandonRestoredRoom(1, 20);

    expect(ok).toBe(true);
    expect(rooms.adminDestroyRoom).toHaveBeenCalledWith(20);
    expect(snapshots.delete).toHaveBeenCalledWith({
      id: 'snap-1',
      ownerUserId: 1,
    });
    expect(snapshotStore.has('snap-1')).toBe(false);
  });
});
