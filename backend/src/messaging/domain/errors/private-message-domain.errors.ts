export class PrivateMessageDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class PrivateMessageNotFoundError extends PrivateMessageDomainError {
  constructor(message = 'Private message introuvable.') {
    super('PRIVATE_MESSAGE_NOT_FOUND', message);
  }
}
