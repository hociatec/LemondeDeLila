import {
  RoomAdminMaintenanceService,
  type RoomAdminContext,
} from './room-admin-maintenance.service';

it.each([false, true])(
  'publishes deletion only after successful persistence (failure: %s)',
  async (failure) => {
    const calls: string[] = [];
    const service = new RoomAdminMaintenanceService(
      {
        exists: async () => true,
        delete: async () => {
          if (failure) throw new Error('database unavailable');
          calls.push('deleted');
        },
        save: async (room) => room,
        listForAdmin: async () => [],
        listCleanupCandidateIds: async () => [],
      },
      { countActivePlayers: () => 0, hasActivePlayers: () => false },
      {
        clearRoomBans: () => {
          calls.push('bans');
        },
      },
      {
        publishRoomDeleted: async () => {
          calls.push('event');
        },
        publishLobbyChanged: async () => {
          calls.push('lobby');
        },
        publishRoomStateUpdated: async () => undefined,
      },
    );
    const context: RoomAdminContext = {
      invalidateRoomPayloadCache: async () => {
        calls.push('cache');
      },
      broadcastPresence: () => {
        calls.push('presence');
      },
      ensureOwner: () => undefined,
      requireRoom: async () => {
        throw new Error('Unexpected room read');
      },
      requireUser: async () => {
        throw new Error('Unexpected user read');
      },
    };
    if (failure) {
      await expect(service.adminDestroyRoom(context, 1)).rejects.toThrow(
        'database unavailable',
      );
      expect(calls).toEqual([]);
    } else {
      await expect(service.adminDestroyRoom(context, 1)).resolves.toEqual({
        ok: true,
        roomId: 1,
      });
      expect(calls).toEqual([
        'deleted',
        'event',
        'bans',
        'cache',
        'lobby',
        'presence',
      ]);
    }
  },
);
