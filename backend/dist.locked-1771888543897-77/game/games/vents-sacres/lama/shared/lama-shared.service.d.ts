import type { LamaMetadata } from '../model/lama.model';
export declare class LamaSharedService {
    sanitizePlayerName(raw: unknown): string;
    asNumberOrNull(value: unknown): number | null;
    asBoolean(value: unknown): boolean;
    playerLabel(players: any[], playerId: number): string;
    ensureTurnTracker(meta: LamaMetadata, playerId: number): LamaMetadata;
    getMaxDrawsPerTurn(meta: LamaMetadata): number;
    getCurrentTurnDrawCount(meta: LamaMetadata, playerId: number, turnIndex: number): number;
}
