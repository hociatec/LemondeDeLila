/**
 * Context information for game errors
 */
export interface GameErrorContext {
  gameType?: string;
  roomId?: number;
  playerId?: number;
  turnIndex?: number;
  action?: unknown;
  timestamp: Date;
  [key: string]: unknown;
}

/**
 * Base class for all game-related errors
 */
export class GameError extends Error {
  constructor(
    message: string,
    public readonly context: GameErrorContext,
    public readonly severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      severity: this.severity,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class GameValidationError extends GameError {
  constructor(message: string, context: Partial<GameErrorContext> = {}) {
    super(message, { timestamp: new Date(), ...context }, 'high');
  }
}

export class GameStateError extends GameError {
  constructor(message: string, context: Partial<GameErrorContext> = {}) {
    super(message, { timestamp: new Date(), ...context }, 'critical');
  }
}

export class PlayerActionError extends GameError {
  constructor(message: string, context: Partial<GameErrorContext> = {}) {
    super(message, { timestamp: new Date(), ...context }, 'medium');
  }
}

export class GameContentError extends GameError {
  constructor(message: string, context: Partial<GameErrorContext> = {}) {
    super(message, { timestamp: new Date(), ...context }, 'critical');
  }
}

export class PayloadValidationError extends GameValidationError {
  constructor(
    message: string,
    public readonly validationErrors: unknown[],
    context: Partial<GameErrorContext> = {},
  ) {
    super(message, context);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors,
    };
  }
}
