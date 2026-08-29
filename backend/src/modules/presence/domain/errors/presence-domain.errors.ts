export class PresenceDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class PresenceConfigurationError extends PresenceDomainError {
  constructor(message = 'Configuration presence invalide.') {
    super('PRESENCE_CONFIGURATION_ERROR', message);
  }
}
