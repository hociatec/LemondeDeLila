export class RealtimeDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class RealtimeConfigurationError extends RealtimeDomainError {
  constructor(message = 'Configuration realtime invalide.') {
    super('REALTIME_CONFIGURATION_ERROR', message);
  }
}
