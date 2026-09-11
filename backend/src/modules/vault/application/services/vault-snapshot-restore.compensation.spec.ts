import { VaultSnapshotRestoreService } from './vault-snapshot-restore.service';

describe('VaultSnapshotRestoreService compensation', () => {
  it.each(['join', 'game', 'notification'] as const)(
    'compensates before commit and preserves committed state on %s failure',
    async (stage) => {
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
          players: [
            { id: 1, username: 'Owner' },
            { id: 2, username: 'Guest' },
          ],
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
        joinRoom: jest.fn().mockResolvedValue(undefined),
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
      if (stage === 'join') rooms.joinRoom.mockRejectedValue(restoreFailure);
      const game = {
        restoreState: jest.fn().mockResolvedValue(undefined),
      };
      if (stage === 'game') game.restoreState.mockRejectedValue(restoreFailure);
      const notifier = {
        notifyRoomRestoreReady: jest.fn().mockRejectedValue(restoreFailure),
      };
      const service = new VaultSnapshotRestoreService(
        snapshots as never,
        rooms as never,
        {} as never,
        notifier as never,
        game as never,
        { isUserInTavern: () => true } as never,
      );

      if (stage === 'notification') {
        await expect(service.restore(1, 'snapshot-1')).resolves.toEqual({
          roomId: 77,
        });
        expect(rooms.adminDestroyRoom).not.toHaveBeenCalled();
        expect(notifier.notifyRoomRestoreReady).toHaveBeenCalledTimes(2);
        return;
      }
      await expect(service.restore(1, 'snapshot-1')).rejects.toBe(
        restoreFailure,
      );
      expect(rooms.adminDestroyRoom).toHaveBeenCalledWith(77);
      if (stage === 'join') expect(game.restoreState).not.toHaveBeenCalled();
    },
  );
});
