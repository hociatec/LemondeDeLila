export class RoomWsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomWsInvalidMessageError extends RoomWsError {
  readonly presentToClient = 'code';
  readonly code = 'ROOM_WS_INVALID_MESSAGE';
  readonly details = {};

  constructor() {
    super('Message WebSocket Room invalide');
  }
}

export class RoomWsUnknownCommandError extends RoomWsError {
  readonly presentToClient = 'code';
  readonly code = 'ROOM_WS_UNKNOWN_COMMAND';

  constructor(command: string) {
    super(`Commande Room inconnue: ${command}`);
  }

  get details(): { command: string } {
    return { command: this.message.slice('Commande Room inconnue: '.length) };
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
