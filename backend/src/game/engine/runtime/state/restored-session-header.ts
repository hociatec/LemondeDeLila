import type { DeclarativeState } from './declarative-state';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { GameComponentDefinition } from '../definitions/component-kit';
import { componentCapabilities } from '../contracts/compiled-game-plan';

/** Checks persisted identity and control state before any action or projection. */
export function assertRestoredSessionHeader<TState extends object>(
  state: DeclarativeState<TState>,
  phases: Readonly<Record<string, unknown>>,
  components: readonly GameComponentDefinition[],
): void {
  check(Object.hasOwn(phases, state.phase), 'phase');
  check(Array.isArray(state.players) && state.players.length > 0, 'players');
  const ids = new Set<number>();
  for (const player of state.players ?? []) {
    check(
      player != null &&
        Number.isSafeInteger(player.id) &&
        player.id !== 0 &&
        !ids.has(player.id),
      'player identity',
    );
    check(typeof player.username === 'string', 'player username');
    ids.add(player.id);
  }
  check(
    state.game != null &&
      typeof state.game === 'object' &&
      !Array.isArray(state.game),
    'game state',
  );
  check(state.turn != null && [1, -1].includes(state.turn.direction), 'turn');
  playerReference(state.turn?.currentPlayerId, ids, 'turn player');
  assertMatch(state, ids);
  assertRound(state, ids);
  for (const component of components) {
    if (component.component === 'collection.view') continue;
    check(
      state.engine.kits[componentCapabilities[component.component]] != null,
      'missing component state',
    );
  }
  playerReference(state.engine.effects.actorPlayerId, ids, 'effect actor');
  playerReference(state.engine.effects.chosenPlayerId, ids, 'effect target');
  check(Array.isArray(state.engine.commands.receipts), 'command receipts');
  const commandIds = new Set<string>();
  for (const receipt of state.engine.commands.receipts) {
    check(
      typeof receipt.commandId === 'string' &&
        !commandIds.has(receipt.commandId),
      'command identity',
    );
    commandIds.add(receipt.commandId);
    playerReference(receipt.actorId, ids, 'command actor');
    count(receipt.resultVersion, 'command version');
    check(Number.isFinite(receipt.acceptedAtMs), 'command timestamp');
    check(
      receipt.requestFingerprint === undefined ||
        (typeof receipt.requestFingerprint === 'string' &&
          /^v1:[a-f0-9]{64}$/.test(receipt.requestFingerprint)),
      'command fingerprint',
    );
  }
}

function assertMatch<TState extends object>(
  state: DeclarativeState<TState>,
  ids: ReadonlySet<number>,
): void {
  const match = state.engine.match;
  check(
    ['waiting', 'setup', 'playing', 'finished', 'cancelled'].includes(
      match.status,
    ),
    'match status',
  );
  for (const timestamp of [match.startedAtMs, match.finishedAtMs])
    check(timestamp === null || Number.isFinite(timestamp), 'match timestamp');
  for (const [id, status] of Object.entries(match.playerStatuses)) {
    check(ids.has(Number(id)) && String(Number(id)) === id, 'match player');
    check(
      [
        'active',
        'eliminated',
        'left-round',
        'disconnected',
        'finished',
      ].includes(status),
      'player status',
    );
  }
  if (match.result) {
    playerReferences(match.result.winnerPlayerIds, ids, 'match winners');
    if (match.result.ranking)
      playerReferences(match.result.ranking.flat(), ids, 'match ranking');
  }
}

function assertRound<TState extends object>(
  state: DeclarativeState<TState>,
  ids: ReadonlySet<number>,
): void {
  const round = state.engine.round;
  count(round.number, 'round number');
  count(round.completedRounds, 'completed rounds');
  check(['idle', 'playing', 'finished'].includes(round.status), 'round status');
  playerReference(round.starterPlayerId, ids, 'round starter');
  playerReferences(round.participantPlayerIds, ids, 'round participants');
  const participants = new Set(round.participantPlayerIds);
  playerReferences(round.leftPlayerIds, participants, 'round departures');
  playerReferences(round.winnerPlayerIds, ids, 'round winners');
}

function playerReferences(
  values: readonly number[],
  ids: ReadonlySet<number>,
  field: string,
): void {
  check(
    Array.isArray(values) &&
      new Set(values).size === values.length &&
      values.every((id: unknown) => typeof id === 'number' && ids.has(id)),
    field,
  );
}

function playerReference(
  value: number | null | undefined,
  ids: ReadonlySet<number>,
  field: string,
): void {
  check(value === null || (typeof value === 'number' && ids.has(value)), field);
}

function count(value: number, field: string): void {
  check(Number.isSafeInteger(value) && value >= 0, field);
}

function check(condition: boolean, field: string): asserts condition {
  if (!condition)
    throw new GameStateViolationError(`Invalid restored session: ${field}`);
}
