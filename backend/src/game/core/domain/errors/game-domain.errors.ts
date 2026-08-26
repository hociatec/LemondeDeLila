export class GameDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class GameRoomNotFoundError extends GameDomainError {
  constructor(message = 'Table introuvable') {
    super('GAME_ROOM_NOT_FOUND', message);
  }
}

export class GamePayloadValidationError extends GameDomainError {
  constructor(message = 'Payload invalide') {
    super('GAME_PAYLOAD_VALIDATION', message);
  }
}

export class GameContentValidationError extends GameDomainError {
  constructor(message = 'Contenu de jeu invalide') {
    super('GAME_CONTENT_VALIDATION', message);
  }
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
  constructor(message = 'État de partie invalide') {
    super('GAME_STATE_VIOLATION', message);
  }
}

export class GameStateConflictError extends GameDomainError {
  constructor(message = 'État modifié par une commande concurrente') {
    super('GAME_STATE_CONFLICT', message);
  }
}

export class GameNotFoundError extends GameDomainError {
  constructor(message = 'Élément de jeu introuvable') {
    super('GAME_NOT_FOUND', message);
  }
}

export class MnemoQuizCategoryRequiredError extends GamePayloadValidationError {
  constructor(message = 'Catégorie requise') {
    super(message);
  }
}

export class MnemoQuizCategoryNameRequiredError extends GamePayloadValidationError {
  constructor(message = 'Nom de catégorie requis') {
    super(message);
  }
}

export class MnemoQuizCategoryNotFoundError extends GameNotFoundError {
  constructor(message = 'Catégorie introuvable') {
    super(message);
  }
}

export class MnemoQuizQuestionRequiredError extends GamePayloadValidationError {
  constructor(message = 'Question requise') {
    super(message);
  }
}

export class MnemoQuizQuestionNotFoundError extends GameNotFoundError {
  constructor(message = 'Question introuvable') {
    super(message);
  }
}

export class MnemoQuizAnswerSetRequiredError extends GamePayloadValidationError {
  constructor(message = '3 mauvaises réponses requises') {
    super(message);
  }
}

export class MnemoQuizCorrectAnswerRequiredError extends GamePayloadValidationError {
  constructor(message = 'Bonne réponse requise') {
    super(message);
  }
}

export class MnemoQuizInvalidIdentifierError extends GamePayloadValidationError {
  constructor(message = 'Id invalide') {
    super(message);
  }
}
