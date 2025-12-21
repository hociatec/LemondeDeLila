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

  /**
   * Returns a JSON representation of the error for logging
   */
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

/**
 * Error thrown when action validation fails
 */
export class GameValidationError extends GameError {
  constructor(
    message: string,
    context: Partial<GameErrorContext> = {},
  ) {
    super(message, { timestamp: new Date(), ...context }, 'high');
  }
}

/**
 * Error thrown when game state is invalid or inconsistent
 */
export class GameStateError extends GameError {
  constructor(
    message: string,
    context: Partial<GameErrorContext> = {},
  ) {
    super(message, { timestamp: new Date(), ...context }, 'critical');
  }
}

/**
 * Error thrown when player action is not allowed
 */
export class PlayerActionError extends GameError {
  constructor(
    message: string,
    context: Partial<GameErrorContext> = {},
  ) {
    super(message, { timestamp: new Date(), ...context }, 'medium');
  }
}

/**
 * Error thrown when game content (JSON files, assets) is invalid
 */
export class GameContentError extends GameError {
  constructor(
    message: string,
    context: Partial<GameErrorContext> = {},
  ) {
    super(message, { timestamp: new Date(), ...context }, 'critical');
  }
}

/**
 * Error thrown when payload validation fails
 */
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
