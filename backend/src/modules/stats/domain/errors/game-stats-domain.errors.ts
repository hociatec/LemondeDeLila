export class GameStatsDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class GameStatsGameTypeRequiredError extends GameStatsDomainError {
  constructor(message = 'gameType requis') {
    super('GAME_STATS_GAME_TYPE_REQUIRED', message);
  }
}
