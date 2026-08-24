export class NotificationDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotificationAccessDeniedError extends NotificationDomainError {
  constructor(message = 'Accès refusé.') {
    super('NOTIFICATION_ACCESS_DENIED', message);
  }
}

export class NotificationContactIdRequiredError extends NotificationDomainError {
  constructor(message = 'contactId requis.') {
    super('NOTIFICATION_CONTACT_ID_REQUIRED', message);
  }
}

export class NotificationContactNotFoundError extends NotificationDomainError {
  constructor(message = 'contactId introuvable pour cette notification.') {
    super('NOTIFICATION_CONTACT_NOT_FOUND', message);
  }
}

export class NotificationMessageRequiredError extends NotificationDomainError {
  constructor(message = 'Message vide.') {
    super('NOTIFICATION_MESSAGE_REQUIRED', message);
  }
}

export class NotificationMessageTooLongError extends NotificationDomainError {
  constructor(message = 'Message trop long (max 2000 caractères).') {
    super('NOTIFICATION_MESSAGE_TOO_LONG', message);
  }
}

export class NotificationRecipientInvalidError extends NotificationDomainError {
  constructor(message = 'Destinataire invalide.') {
    super('NOTIFICATION_RECIPIENT_INVALID', message);
  }
}

export class NotificationInboxItemNotFoundError extends NotificationDomainError {
  constructor(message = 'Notification inbox item introuvable.') {
    super('NOTIFICATION_INBOX_ITEM_NOT_FOUND', message);
  }
}

export class NotificationIdentifierRequiredError extends NotificationDomainError {
  constructor(message = 'contactId ou id requis.') {
    super('NOTIFICATION_IDENTIFIER_REQUIRED', message);
  }
}

export class NotificationConfigurationError extends NotificationDomainError {
  constructor(message = 'Configuration notifications invalide.') {
    super('NOTIFICATION_CONFIGURATION_ERROR', message);
  }
}
