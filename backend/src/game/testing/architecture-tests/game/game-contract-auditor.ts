import type { GameSingleActionDto } from '../../../core/application/contracts/game-action.model';
import type { GameRuntime } from '../../../core/application/contracts/game-runtime.interface';
import { FixedGameClock } from '../../../core/application/contracts/game-execution-context.model';
import type { GameStateEntity } from '../../../core/application/contracts/game-state.model';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import type {
  CompiledGameDefinition,
  GameActionMap,
} from '../../../engine/runtime/definitions/game-definition';
import { GameCommandExecutorService } from '../../../core/application/services/game-command-executor.service';
import { GameEngineService } from '../../../core/application/services/game-engine.service';
import { InMemoryGameSessionStore } from '../../../core/infrastructure/persistence/memory/in-memory-game-session.store';
import { GameExecutionScopeService } from '../../../core/application/services/game-execution-scope.service';

const PROPERTY_SEEDS = [0, 1, 2, 7, 17, 42, 255, 65_535] as const;
const FORBIDDEN_VIEW_KEYS = new Set([
  'engine',
  'rng',
  'rngState',
  'secret',
  'secrets',
  'solution',
  'correctAnswer',
  'answerKey',
  'pendingEvents',
]);

export type GameContractViolation = {
  gameId: string;
  criterion: string;
  seed: number;
  message: string;
};

export async function auditGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
>(
  definition: CompiledGameDefinition<TState, TActions, TPlayerView>,
): Promise<GameContractViolation[]> {
  const violations: GameContractViolation[] = [];
  for (const seed of PROPERTY_SEEDS) {
    try {
      await auditSeed(definition, seed);
    } catch (error) {
      violations.push({
        gameId: definition.id,
        criterion: 'runtime-property-contract',
        seed,
        message:
          error instanceof Error
            ? `${error.message}${errorDetails(error)}`
            : String(error),
      });
    }
  }
  return violations;
}

async function auditSeed<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
>(
  definition: CompiledGameDefinition<TState, TActions, TPlayerView>,
  seed: number,
): Promise<void> {
  const adapter = new DeclarativeGameRuntime(definition);
  const scope = new GameExecutionScopeService();
  const executor = new GameCommandExecutorService(scope);
  const clock = new FixedGameClock(1_700_000_000_000 + seed);
  const firstBase = baseState(definition, seed);
  const secondBase = baseState(definition, seed);
  const firstContext = scope.create(firstBase, null, clock);
  const secondContext = scope.create(secondBase, null, clock);
  const state = scope.run(firstContext, () =>
    adapter.hydrateInitialState(firstBase, firstContext),
  );
  const duplicate = scope.run(secondContext, () =>
    adapter.hydrateInitialState(secondBase, secondContext),
  );
  invariant(
    stableJson(state) === stableJson(duplicate),
    'setup/RNG non reproductible',
  );
  invariant(isValidState(state), 'setup a produit un état invalide');
  invariant(
    stableJson(JSON.parse(stableJson(state))) === stableJson(state),
    'sérialisation instable',
  );

  auditViews(adapter, state);

  const actorId =
    state.pending?.playerId ??
    state.turn?.currentPlayerId ??
    state.players?.[0]?.id ??
    null;
  invariant(actorId != null, 'aucun acteur initial résolu');
  const available = adapter.getAvailableActions(state, actorId);
  for (const action of available) {
    const before = stableJson(state);
    adapter.validateAction(state, action, actorId);
    invariant(
      stableJson(state) === before,
      'validateAction mute InternalState',
    );
  }
  auditInvalidAction(adapter, state, actorId);
  auditPendingIsolation(adapter, state);
  auditBotActions(adapter, state);

  const candidate = available[seed % Math.max(1, available.length)];
  if (candidate) {
    await auditCommand(adapter, executor, state, candidate, actorId, clock);
  }

  auditFinishedState(
    adapter,
    executor,
    state,
    candidate ?? firstAction(definition),
    actorId,
    clock,
  );
}

function auditViews(adapter: GameRuntime, state: GameStateEntity): void {
  for (const player of state.players ?? []) {
    const view = adapter.exposeStateForUser(state, player.id);
    const leaked = findForbiddenKey(view);
    invariant(!leaked, `PlayerView expose une clé interne: ${leaked ?? ''}`);
  }
}

function auditInvalidAction(
  adapter: GameRuntime,
  state: GameStateEntity,
  actorId: number,
): void {
  const before = stableJson(state);
  let rejected = false;
  try {
    adapter.validateAction(
      state,
      { type: '__invalid_contract_action__', payload: {} },
      actorId,
    );
  } catch {
    rejected = true;
  }
  invariant(rejected, 'une action inconnue est validée');
  invariant(stableJson(state) === before, 'une action invalide mute l’état');
}

function auditPendingIsolation(
  adapter: GameRuntime,
  state: GameStateEntity,
): void {
  const pendingPlayerId = state.pending?.playerId;
  if (pendingPlayerId == null) return;
  for (const player of state.players ?? []) {
    const available = adapter.getAvailableActions(state, player.id);
    if (player.id !== pendingPlayerId) {
      invariant(
        available.length === 0,
        'un pending laisse agir un autre joueur',
      );
    } else {
      invariant(
        available.every((action) => action.type === 'choice.resolve'),
        'un pending laisse passer une action de jeu',
      );
    }
  }
}

function auditBotActions(adapter: GameRuntime, state: GameStateEntity): void {
  for (const bot of (state.players ?? []).filter((player) => player.isBot)) {
    const before = stableJson(state);
    const actions = adapter.getBotActions(state, bot.id) ?? [];
    invariant(stableJson(state) === before, 'le bot mute directement l’état');
    for (const action of actions) adapter.validateAction(state, action, bot.id);
  }
}

function auditFinishedState(
  adapter: GameRuntime,
  executor: GameCommandExecutorService,
  state: GameStateEntity,
  fallback: GameSingleActionDto,
  actorId: number,
  clock: FixedGameClock,
): void {
  const finished = structuredClone(state);
  finished.status = 'finished';
  invariant(
    adapter.getAvailableActions(finished, actorId).length === 0,
    'des actions sont annoncées après FINISHED',
  );
  let rejected = false;
  try {
    executor.execute({
      handler: adapter,
      state: finished,
      actions: [fallback],
      actorId,
      clock,
    });
  } catch {
    rejected = true;
  }
  invariant(rejected, 'une commande est acceptée après FINISHED');
}

async function auditCommand<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
>(
  adapter: DeclarativeGameRuntime<TState, TActions, TPlayerView>,
  executor: GameCommandExecutorService,
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number,
  clock: FixedGameClock,
): Promise<void> {
  const before = structuredClone(state);
  const next = executor.execute({
    handler: adapter,
    state,
    actions: [action],
    actorId,
    clock,
  });
  const deterministic = executor.execute({
    handler: adapter,
    state: structuredClone(state),
    actions: [structuredClone(action)],
    actorId,
    clock: new FixedGameClock(clock.nowMs()),
  });
  invariant(
    stableJson(next) === stableJson(deterministic),
    'commande/RNG non reproductible',
  );
  invariant(
    stableJson(state) === stableJson(before),
    'commande mute son entrée',
  );
  const sessionStore = new InMemoryGameSessionStore();
  const engine = new GameEngineService(sessionStore, sessionStore);
  await engine.restoreInternalState(1, adapter.gameType, state);
  const commit = await engine.compareAndSetInternalState(
    1,
    adapter.gameType,
    Number(state.version ?? 1),
    next,
  );
  invariant(commit.committed, 'commit CAS légitime rejeté');
  invariant(
    commit.version === Number(state.version ?? 1) + 1,
    'version non monotone',
  );
  invariant(
    stableJson(await engine.replay(1, adapter.gameType)) ===
      stableJson(commit.state),
    'replay différent de l’état courant',
  );
}

function baseState(
  definition: { id: string; players: { min: number; max: number } },
  seed: number,
): GameStateEntity {
  const count = Math.min(
    definition.players.max,
    Math.max(2, definition.players.min),
  );
  return {
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      username: `Player ${index + 1}`,
      isBot: index === count - 1,
    })),
    pending: null,
    metadata: {
      gameType: definition.id,
      roomId: 1,
      roomRunId: 1,
      roomStartedAt: '2026-01-01T00:00:00.000Z',
      rng: { seed, counter: 0 },
    },
  };
}

function firstAction(definition: {
  actions: Record<string, unknown>;
}): GameSingleActionDto {
  return { type: Object.keys(definition.actions)[0] ?? 'invalid', payload: {} };
}

function isValidState(state: GameStateEntity): boolean {
  return (
    state != null &&
    typeof state === 'object' &&
    Array.isArray(state.log) &&
    Array.isArray(state.players) &&
    typeof state.status === 'string' &&
    typeof state.phase === 'string'
  );
}

function findForbiddenKey(
  value: unknown,
  seen = new Set<object>(),
): string | null {
  if (value == null || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_VIEW_KEYS.has(key)) return key;
    const nested = findForbiddenKey(child, seen);
    if (nested) return nested;
  }
  return null;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function errorDetails(error: Error): string {
  const details = (error as { details?: unknown }).details;
  if (!details || typeof details !== 'object') return '';
  const path =
    'path' in details && typeof details.path === 'string'
      ? ` path=${details.path}`
      : '';
  const type =
    'type' in details && typeof details.type === 'string'
      ? ` type=${details.type}`
      : '';
  return path || type ? ` (${path.trim()}${type})` : '';
}
