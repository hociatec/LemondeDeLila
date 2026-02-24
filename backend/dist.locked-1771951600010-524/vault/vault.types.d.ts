import type { GameStateEntity } from '../game/core/entities/game-state.entity';
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
        players: Array<{
            id: number;
            username: string;
        }>;
        spectators?: Array<{
            id: number;
            username: string;
        }>;
        bots: Array<{
            id: number;
            name: string;
        }>;
    };
    game: {
        gameType: string;
        state: GameStateEntity;
    };
};
export type VaultRoomSnapshot = VaultRoomSnapshotV1;
