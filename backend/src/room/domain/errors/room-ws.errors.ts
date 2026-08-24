export class RoomWsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomWsInvalidRoomIdError extends RoomWsError {
  constructor() {
    super('roomId invalide');
  }
}

export class RoomWsInvalidUserIdError extends RoomWsError {
  constructor() {
    super('userId invalide');
  }
}

export class RoomWsUserNotOnTableError extends RoomWsError {
  constructor() {
    super('Utilisateur introuvable sur la table');
  }
}

export class RoomWsOwnerRequiredError extends RoomWsError {
  constructor(message: string) {
    super(message);
  }
}

export class RoomWsIntentIdRequiredError extends RoomWsError {
  constructor() {
    super('intentId requis');
  }
}

export class RoomWsUnknownIntentError extends RoomWsError {
  constructor(intentId: string) {
    super(`Intent inconnu: ${intentId}`);
  }
}

export class RoomWsNoBotToRemoveError extends RoomWsError {
  constructor() {
    super('Aucun bot a retirer');
  }
}

export class RoomWsCurrentRoomMismatchError extends RoomWsError {
  constructor() {
    super('roomId ne correspond pas a la table courante');
  }
}

export class RoomWsGameAlreadyStartedError extends RoomWsError {
  constructor() {
    super('Partie déjà commencée');
  }
}

export class RoomWsPrivateInvitationRequiredError extends RoomWsError {
  constructor() {
    super('Table privée: invitation requise');
  }
}

export class RoomWsSelfTargetForbiddenError extends RoomWsError {
  constructor() {
    super('Impossible de se cibler soi-meme');
  }
}

export class RoomWsOwnerTargetForbiddenError extends RoomWsError {
  constructor() {
    super('Impossible de cibler le proprietaire');
  }
}
