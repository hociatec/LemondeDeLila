export interface GameErrorContext {
    gameType?: string;
    roomId?: number;
    playerId?: number;
    turnIndex?: number;
    action?: unknown;
    timestamp: Date;
    [key: string]: unknown;
}
export declare class GameError extends Error {
    readonly context: GameErrorContext;
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    constructor(message: string, context: GameErrorContext, severity?: 'low' | 'medium' | 'high' | 'critical');
    toJSON(): Record<string, unknown>;
}
export declare class GameValidationError extends GameError {
    constructor(message: string, context?: Partial<GameErrorContext>);
}
export declare class GameStateError extends GameError {
    constructor(message: string, context?: Partial<GameErrorContext>);
}
export declare class PlayerActionError extends GameError {
    constructor(message: string, context?: Partial<GameErrorContext>);
}
export declare class GameContentError extends GameError {
    constructor(message: string, context?: Partial<GameErrorContext>);
}
export declare class PayloadValidationError extends GameValidationError {
    readonly validationErrors: unknown[];
    constructor(message: string, validationErrors: unknown[], context?: Partial<GameErrorContext>);
    toJSON(): Record<string, unknown>;
}
