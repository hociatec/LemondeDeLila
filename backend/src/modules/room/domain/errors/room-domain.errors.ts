export class RoomDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomInvalidRoomIdError extends RoomDomainError {
  constructor() {
    super('roomId invalide');
  }
}

export class RoomInvalidUserIdError extends RoomDomainError {
  constructor() {
    super('userId invalide');
  }
}

export class RoomUserNotOnTableError extends RoomDomainError {
  constructor() {
    super('Utilisateur introuvable sur la table');
  }
}

export class RoomOwnerRequiredError extends RoomDomainError {
  constructor(message: string) {
    super(message);
  }
}
