import type { PendingState } from '../../../core/entities/game-state.entity';
type SetupPlayer = {
    id: number;
    username?: string | null;
};
type SetupChoice = {
    id: string;
    label: string;
    [key: string]: unknown;
};
type PawnChoice = {
    id?: unknown;
    label?: unknown;
    description?: unknown;
    [key: string]: unknown;
};
export declare class SetupFlowService {
    createSequentialChoicePending(params: {
        players: SetupPlayer[];
        startPlayerId?: number | null;
        isAssigned: (playerId: number) => boolean;
        pendingType: string;
        choices: SetupChoice[];
        labelForPlayer?: (playerLabel: string) => string;
        dataBuilder?: (choices: SetupChoice[]) => Record<string, unknown>;
    }): {
        pending: PendingState;
        playerId: number;
        turnIndex: number;
    } | null;
    createSequentialPawnPending(params: {
        players: SetupPlayer[];
        startPlayerId?: number | null;
        isAssigned: (playerId: number) => boolean;
        pawns: PawnChoice[];
        pendingType?: string;
        labelForPlayer?: (playerLabel: string) => string;
        choiceLabelBuilder?: (pawn: PawnChoice) => string;
        pawnDataMapper?: (pawn: PawnChoice) => Record<string, unknown>;
        includeChoiceMapData?: boolean;
        extraPendingData?: Record<string, unknown>;
    }): {
        pending: PendingState;
        playerId: number;
        turnIndex: number;
    } | null;
    private toPlayerId;
    resolveChoice<TChoice extends {
        id?: unknown;
        label?: unknown;
    }>(raw: unknown, options: TChoice[]): TChoice | null;
    resolvePawnChoice<TChoice extends PawnChoice>(raw: unknown, options: TChoice[]): TChoice | null;
    normalizeKey(value: unknown): string;
    private normalizeChoices;
    private normalizePawnChoices;
    private defaultPawnData;
    private playerLabel;
}
export {};
