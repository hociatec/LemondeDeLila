export class BotApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BotNameRequiredError extends BotApplicationError {
  constructor() {
    super('BOT_NAME_REQUIRED', 'Nom requis');
  }
}

export class BotNameAlreadyUsedError extends BotApplicationError {
  constructor() {
    super('BOT_NAME_ALREADY_USED', 'Nom deja utilise');
  }
}

export class BotUnavailableNamesError extends BotApplicationError {
  constructor() {
    super('BOT_UNAVAILABLE_NAMES', 'Plus de noms de bots disponibles');
  }
}

export class BotRoomNotFoundError extends BotApplicationError {
  constructor() {
    super('BOT_ROOM_NOT_FOUND', 'Table introuvable');
  }
}

export class BotNotFoundError extends BotApplicationError {
  constructor() {
    super('BOT_NOT_FOUND', 'Bot introuvable');
  }
}

export class BotRoomAlreadyStartedError extends BotApplicationError {
  constructor() {
    super('BOT_ROOM_ALREADY_STARTED', 'Table deja demarree');
  }
}

export class BotRoomFullError extends BotApplicationError {
  constructor() {
    super('BOT_ROOM_FULL', 'Table pleine');
  }
}

export class BotRoomOwnerRequiredError extends BotApplicationError {
  constructor() {
    super('BOT_ROOM_OWNER_REQUIRED', 'Seul le proprietaire peut gerer les bots');
  }
}

export class BotMinimumParticipantsError extends BotApplicationError {
  constructor() {
    super(
      'BOT_MINIMUM_PARTICIPANTS',
      'Impossible de retirer ce bot : au moins deux participants sont requis',
    );
  }
}
