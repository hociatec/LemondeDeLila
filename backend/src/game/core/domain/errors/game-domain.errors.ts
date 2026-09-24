import {
  GameDomainError,
  GamePayloadValidationError,
  GameNotFoundError,
} from '../../../engine/runtime/contracts/game-domain.errors';

export class GameRoomNotFoundError extends GameDomainError {
  constructor(message = 'Table introuvable') {
    super('GAME_ROOM_NOT_FOUND', message);
  }
}

export class GameStateConflictError extends GameDomainError {
  constructor(message = 'État modifié par une commande concurrente') {
    super('GAME_STATE_CONFLICT', message);
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
