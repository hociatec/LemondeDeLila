import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { GameError } from '../errors/game-errors';
export interface GameLogContext {
    gameType?: string;
    roomId?: number;
    playerId?: number;
    turnIndex?: number;
    action?: unknown;
    [key: string]: unknown;
}
export declare class GameLoggerService {
    private readonly config;
    private logger;
    constructor(config: ConfigService);
    private ensureDirectory;
    error(message: string, error?: Error | GameError, context?: GameLogContext): void;
    warn(message: string, context?: GameLogContext): void;
    info(message: string, context?: GameLogContext): void;
    debug(message: string, context?: GameLogContext): void;
    logPlayerAction(action: {
        type: string;
        payload?: unknown;
    }, context: GameLogContext): void;
    logStateChange(description: string, changes: Record<string, unknown>, context: GameLogContext): void;
    logValidationFailure(message: string, validationErrors: unknown[], context: GameLogContext): void;
    logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context: GameLogContext): void;
    logPerformance(operation: string, durationMs: number, context: GameLogContext): void;
    getLogger(): winston.Logger;
}
