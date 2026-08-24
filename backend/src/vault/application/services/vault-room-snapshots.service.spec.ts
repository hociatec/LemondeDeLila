import { VaultRoomSnapshotsService } from './vault-room-snapshots.service';

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
      listByOwner: jest.fn(async (ownerUserId: number) => {
        return Array.from(snapshotStore.values()).filter(
          (s) => s.ownerUserId === ownerUserId,
        );
      }),
      findByIdForOwner: jest.fn(async (id: string, ownerUserId: number) => {
        const item = snapshotStore.get(id);
        if (!item || item.ownerUserId !== ownerUserId) return null;
        return item;
      }),
      existsByIdForOwner: jest.fn(async (id: string, ownerUserId: number) => {
        const item = snapshotStore.get(id);
        return Boolean(item && item.ownerUserId === ownerUserId);
      }),
      deleteByIdForOwner: jest.fn(async (id: string, ownerUserId: number) => {
        const item = snapshotStore.get(String(id));
        if (!item || item.ownerUserId !== Number(ownerUserId)) {
          return false;
        }
        snapshotStore.delete(String(id));
        return true;
      }),
      create: jest.fn((data: any) => ({
        ...data,
        id: data?.id ?? makeId(),
      })),
      save: jest.fn(async (entity: any) => {
        snapshotStore.set(String(entity.id), entity as SnapshotRecord);
        return entity;
      }),
    } as any;

    const bots = {
      addSystemBot: jest.fn(async () => ({ id: 99 })),
      renameBot: jest.fn(async () => undefined),
    };

    const room10 = { id: 10 };
    const room20 = { id: 20 };
    const room30 = { id: 30 };
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
        })
        .mockResolvedValueOnce({
          room: {
            id: 30,
            status: 'started',
            startedAt: '2026-02-25T20:30:00.000Z',
            owner: { id: 1 },
            players: [{ id: 1, username: 'owner' }],
            spectators: [],
            bots: [],
            gameType: 'panier-express',
            name: 'Autre table du meme jeu',
            isPrivate: false,
            maxPlayers: 4,
            tableAmbienceSoundId: null,
          },
        }),
      requireRoomForOwnerAction: jest.fn(async (roomId: number) => {
        if (roomId === 10) return room10;
        if (roomId === 20) return room20;
        return room30;
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

    const game = {
      exportState: jest
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
        })
        .mockResolvedValueOnce({
          status: 'started',
          metadata: { roomId: 30, roomOwnerId: 1, roomRunId: 30 },
          players: [{ id: 1, username: 'owner', isBot: false }],
          turn: { currentPlayerId: 1 },
        }),
      restoreState: jest.fn(async () => undefined),
      getDisplayName: jest.fn(() => 'Panier Express'),
    };

    const notifier = {
      notifyRoomRestoreReady: jest.fn(async () => undefined),
    };

    const presence = {
      isUserInTavern: jest.fn(() => true),
    };

    const service = new VaultRoomSnapshotsService(
      snapshots,
      rooms as any,
      bots as any,
      notifier as any,
      game as any,
      presence as any,
    );

    const firstSave = await service.save(1, 10);
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
    expect(bots.addSystemBot).toHaveBeenCalledTimes(1);
    expect(game.restoreState).toHaveBeenCalledTimes(1);
    const restoredState = (game.restoreState as jest.Mock).mock
      .calls[0][2];
    expect(restoredState.players.some((p: any) => p.id === -99)).toBe(true);
    expect(restoredState.turn.currentPlayerId).toBe(-99);
    expect(restoredState.metadata.roomId).toBe(20);
    expect(restoredState.metadata.roomRunId).toBe(123);
    expect(notifier.notifyRoomRestoreReady).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, roomId: 20 }),
    );
    expect(notifier.notifyRoomRestoreReady).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, roomId: 20 }),
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

    const independentSave = await service.save(1, 30);
    expect(independentSave.id).not.toBe(firstSave.id);
    expect(snapshotStore.size).toBe(2);
    expect(rooms.adminDestroyRoom).toHaveBeenCalledWith(30);
    expect(rooms.adminDestroyRoom).toHaveBeenCalledTimes(3);
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

    const deleteSnapshot = jest.fn(async function (
      this: void,
      id: string,
      ownerUserId: number,
    ) {
      const item = snapshotStore.get(String(id));
      if (!item || item.ownerUserId !== Number(ownerUserId)) {
        return false;
      }
      snapshotStore.delete(String(id));
      return true;
    });
    const snapshots = {
      listByOwner: jest.fn(async () => []),
      findByIdForOwner: jest.fn(async () => null),
      existsByIdForOwner: jest.fn(async () => false),
      deleteByIdForOwner: deleteSnapshot,
      create: jest.fn((data: any) => data),
      save: jest.fn(async (entity: any) => entity),
    };

    const bots = {
      addSystemBot: jest.fn(async () => ({ id: 99 })),
      renameBot: jest.fn(async () => undefined),
    };

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
      rooms as any,
      bots as any,
      { notifyRoomRestoreReady: jest.fn(async () => undefined) } as any,
      {} as any,
      {} as any,
    );

    const ok = await service.abandonRestoredRoom(1, 20);

    expect(ok).toBe(true);
    expect(rooms.adminDestroyRoom).toHaveBeenCalledWith(20);
    expect(deleteSnapshot).toHaveBeenCalledWith('snap-1', 1);
    expect(snapshotStore.has('snap-1')).toBe(false);
  });
});
