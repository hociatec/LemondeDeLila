/** Versioned capture input consumed by Vault; never a Room aggregate or lobby DTO. */
export type VaultSnapshotCaptureInput = {
  schemaVersion: 1;
  room: {
    id: number;
    name: string;
    gameType: string;
    status: string;
    startedAt: string | null;
    maxPlayers: number;
    isPrivate: boolean;
    tableAmbienceSoundId: string | null;
    owner: { id: number } | null;
    players: Array<{ id: number; username: string }>;
    spectators: Array<{ id: number; username: string }>;
    bots: Array<{ id: number; name: string }>;
  };
};
