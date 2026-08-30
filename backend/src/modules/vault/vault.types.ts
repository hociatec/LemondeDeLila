import type { VaultGameState } from './application/contracts/vault-game-state.model';

export type VaultRoomSnapshotV1 = {
  version: 1;
  savedAt: string;
  room: {
    name: string;
    isPrivate: boolean;
    maxPlayers: number;
    tableAmbienceSoundId: string | null;
  };
  roster: {
    ownerUserId: number | null;
    players: Array<{ id: number; username: string }>;
    spectators?: Array<{ id: number; username: string }>;
    bots: Array<{ id: number; name: string }>;
  };
  game: {
    gameType: string;
    state: VaultGameState;
  };
};

export type VaultRoomSnapshot = VaultRoomSnapshotV1;
