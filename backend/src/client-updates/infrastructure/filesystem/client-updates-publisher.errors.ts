export class ClientUpdatesPublisherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ClientUpdatesInvalidArchiveError extends ClientUpdatesPublisherError {
  constructor(message: string) {
    super(message);
  }
}

export class ClientUpdatesMissingDependencyError extends ClientUpdatesPublisherError {
  constructor(message: string) {
    super(message);
  }
}
