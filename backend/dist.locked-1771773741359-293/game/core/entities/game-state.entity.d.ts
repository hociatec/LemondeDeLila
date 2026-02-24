export type GameLogEntry = {
    message: string;
    timestamp?: string;
};
export type TurnStateEntity = {
    currentPlayerId: number | null;
    direction: 1 | -1;
    skippedPlayerIds?: number[];
    label?: string;
};
export type PlayerStateEntity = {
    id: number;
    username: string;
    isBot?: boolean;
    basket?: unknown[];
    inventory?: unknown[];
    shoppingList?: unknown[];
    pawn?: string;
};
export type PendingState = {
    type: string;
    label?: string | null;
    playerId?: number | null;
    targetPlayerId?: number | null;
    blocking?: boolean;
    question?: string | null;
    choices?: string[];
    data?: Record<string, unknown>;
    step?: string | null;
    initiatorPlayerId?: number | null;
};
export type GameStateEntity = {
    status: string;
    phase: string;
    round: number;
    turnIndex: number;
    lastRoll: number | null;
    lastDraw?: {
        playerId: number | null;
        at: string;
    } | null;
    log: GameLogEntry[];
    players?: PlayerStateEntity[];
    turn?: TurnStateEntity;
    metadata?: unknown;
    pending?: PendingState | null;
    extras?: Record<string, unknown>;
    board?: unknown;
    botThinking?: boolean;
    botThinkingSince?: number | null;
};
