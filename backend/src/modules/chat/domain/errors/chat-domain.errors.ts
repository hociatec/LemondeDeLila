export class ChatDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ChatMessageRequiredError extends ChatDomainError {
  constructor(message = 'MESSAGE_REQUIRED') {
    super('CHAT_MESSAGE_REQUIRED', message);
  }
}

export class ChatMessageTooLongError extends ChatDomainError {
  constructor(message = 'MESSAGE_TOO_LONG') {
    super('CHAT_MESSAGE_TOO_LONG', message);
  }
}

export class ChatMessageNotFoundError extends ChatDomainError {
  constructor(message = 'Message introuvable.') {
    super('CHAT_MESSAGE_NOT_FOUND', message);
  }
}

export class ChatMessageAccessDeniedError extends ChatDomainError {
  constructor(message = 'Accès au message refusé.') {
    super('CHAT_MESSAGE_ACCESS_DENIED', message);
  }
}

export class ChatMessageDeletedError extends ChatDomainError {
  constructor(message = 'Message supprimé.') {
    super('CHAT_MESSAGE_DELETED', message);
  }
}

export class ChatMessageEditWindowExpiredError extends ChatDomainError {
  constructor(message = 'Message trop ancien pour être modifié.') {
    super('CHAT_MESSAGE_EDIT_WINDOW_EXPIRED', message);
  }
}

export class ChatMessageDeleteWindowExpiredError extends ChatDomainError {
  constructor(message = 'Message trop ancien pour être supprimé.') {
    super('CHAT_MESSAGE_DELETE_WINDOW_EXPIRED', message);
  }
}
