import type { GameState } from '../application/models/game-state.model';

export type TestPlayer = string | { username: string; isBot?: boolean };

/** Deterministic initial fixture, independent of the command test driver. */
export function createTestGameState(input: {
  definition: { id: string; players: { min: number; max: number } };
  players: readonly TestPlayer[];
  seed: number;
  startedAt: string;
}): GameState {
  const players = input.players.map((player, index) => ({
    id: typeof player !== 'string' && player.isBot ? -(index + 1) : index + 1,
    username: typeof player === 'string' ? player : player.username,
    ...(typeof player !== 'string' && player.isBot ? { isBot: true } : {}),
  }));
  if (
    players.length < input.definition.players.min ||
    players.length > input.definition.players.max
  ) {
    throw new Error(
      `Nombre de joueurs hors limites pour ${input.definition.id}: ${players.length}`,
    );
  }
  return {
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players,
    pending: null,
    metadata: {
      gameType: input.definition.id,
      roomId: 1,
      roomRunId: 1,
      roomStartedAt: input.startedAt,
      rng: { seed: input.seed, counter: 0 },
    },
  };
}
