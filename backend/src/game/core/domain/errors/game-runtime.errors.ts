import { GameDomainError } from './game-domain.errors';

export class GameCorruptedStateError extends GameDomainError {
  constructor(
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super('GAME_CORRUPTED_STATE', message, details);
  }
}

export class GameInvariantViolationError extends GameDomainError {
  constructor(
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super('GAME_INVARIANT_VIOLATION', message, details);
  }
}
