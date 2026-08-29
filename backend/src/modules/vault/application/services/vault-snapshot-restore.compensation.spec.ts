import { VaultSnapshotRestoreService } from './vault-snapshot-restore.service';

describe('VaultSnapshotRestoreService compensation', () => {
  it('destroys the partially restored room when game restoration fails', async () => {
    const snapshotJson = JSON.stringify({
      version: 1,
      savedAt: new Date(0).toISOString(),
      room: {
        name: 'Table',
        isPrivate: false,
        maxPlayers: 4,
        tableAmbienceSoundId: null,
      },
      roster: {
        ownerUserId: 1,
        players: [{ id: 1, username: 'Owner' }],
        bots: [],
      },
      game: {
        gameType: 'lama',
        state: { status: 'started', phase: 'playing', log: [] },
      },
    });
    const snapshots = {
      findByIdForOwner: jest.fn().mockResolvedValue({ snapshotJson }),
    };
    const rooms = {
      findLatestActiveRoomForUser: jest.fn().mockResolvedValue(null),
      createRoom: jest.fn().mockResolvedValue({ id: 77 }),
      requireRoomForOwnerAction: jest.fn().mockResolvedValue({ id: 77 }),
      saveRoom: jest.fn().mockResolvedValue({ id: 77 }),
      startRoom: jest.fn().mockResolvedValue({
        id: 77,
        startedAt: new Date(0),
        runId: 1,
      }),
      invalidateRoomPayloadCache: jest.fn(),
      adminDestroyRoom: jest.fn().mockResolvedValue({ ok: true, roomId: 77 }),
    };
    const restoreFailure = new Error('database unavailable');
    const game = { restoreState: jest.fn().mockRejectedValue(restoreFailure) };
    const service = new VaultSnapshotRestoreService(
      snapshots as never,
      rooms as never,
      {} as never,
      {} as never,
      game as never,
      { isUserInTavern: () => true } as never,
    );

    await expect(service.restore(1, 'snapshot-1')).rejects.toBe(restoreFailure);
    expect(rooms.adminDestroyRoom).toHaveBeenCalledWith(77);
  });
});
