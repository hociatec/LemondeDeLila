export class GameDomainError extends Error {
  readonly presentToClient = 'code' as const;

  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class GameRuleViolationError extends GameDomainError {
  constructor(
    code = 'GAME_RULE_VIOLATION',
    details: Readonly<Record<string, unknown>> = {},
    message = 'Règle de jeu non respectée',
  ) {
    super(code, message, details);
  }
}

export function rejectRule(
  message: string,
  details: Readonly<Record<string, unknown>> = {},
  code = 'GAME_RULE_VIOLATION',
): never {
  throw new GameRuleViolationError(code, details, message);
}

export class GamePayloadValidationError extends GameDomainError {
  constructor(message = 'Payload invalide') {
    super('GAME_PAYLOAD_VALIDATION', message);
  }
}

export class GameContentValidationError extends GameDomainError {
  constructor(
    message = 'Contenu de jeu invalide',
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super('GAME_CONTENT_VALIDATION', message, details);
  }
}

export function rejectContent(
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): never {
  throw new GameContentValidationError(message, details);
}

export class GameActionRejectedError extends GameDomainError {
  constructor(message = 'Action refusée') {
    super('GAME_ACTION_REJECTED', message);
  }
}

export class GameUnknownActionError extends GameDomainError {
  constructor(message = 'Action inconnue') {
    super('GAME_UNKNOWN_ACTION', message);
  }
}

export class GameActorRequiredError extends GameDomainError {
  constructor(message = 'Acteur requis.') {
    super('GAME_ACTOR_REQUIRED', message);
  }
}

export class GameTurnViolationError extends GameDomainError {
  constructor(message = "Ce n'est pas votre tour.") {
    super('GAME_TURN_VIOLATION', message);
  }
}

export class GameConfigurationError extends GameDomainError {
  constructor(message = 'Configuration invalide') {
    super('GAME_CONFIGURATION_ERROR', message);
  }
}

export class GameStateViolationError extends GameDomainError {
  constructor(
    message = 'État de partie invalide',
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super('GAME_STATE_VIOLATION', message, details);
  }
}

export class GameNotFoundError extends GameDomainError {
  constructor(message = 'Élément de jeu introuvable') {
    super('GAME_NOT_FOUND', message);
  }
}
