import type { GameSingleActionDto } from '../models/game-action.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import { GameActionRejectedError } from '../../domain/errors/game-domain.errors';
import type {
  DeclarativeGameDefinition,
  DeclarativeState,
  GameActionMap,
} from './game-definition';
import type { GameContext } from './game-rule-context';
import { sameSerializableValue } from './serializable-value';

export class DeclarativeChoiceRuntime<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> {
  constructor(
    private readonly definition: DeclarativeGameDefinition<
      TState,
      TActions,
      TPlayerView
    >,
  ) {}

  resolve(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    action: GameSingleActionDto,
    context: GameContext<TState>,
    timeout: boolean,
  ): void {
    this.ensureActor(runtime, actor, timeout, context.clock.nowMs());
    const data = asRecord(runtime.pending?.data);
    const options = Array.isArray(data.options) ? data.options : [];
    const value = timeout
      ? timeoutValue(data, options, context)
      : asRecord(action.payload).value;
    ensureValidValue(data, options, value, timeout);
    const choiceId = typeof data.choiceId === 'string' ? data.choiceId : '';
    if (context.effects.awaitsChoice(choiceId)) {
      context.choice.clear();
      context.effects.resumeChoice(choiceId, value);
      return;
    }
    const resolver = this.definition.choices?.[choiceId];
    if (!resolver)
      throw new GameActionRejectedError(`Choix inconnu: ${choiceId}`);
    context.choice.resolvePlayer(actor.id);
    resolver.resolveRaw({
      state: runtime.game,
      actor,
      rawValue: value,
      ctx: context,
    });
  }

  actions(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
  ): GameSingleActionDto[] {
    if (!runtime.pending || !isExpectedActor(runtime.pending, actor.id))
      return [];
    const options = asRecord(runtime.pending.data).options;
    if (!isUnknownArray(options)) return [];
    if (isMultiChoice(asRecord(runtime.pending.data).kind)) {
      return [
        {
          type: 'choice.resolve',
          payload: { value: [] },
          meta: { actorId: actor.id },
        },
      ];
    }
    return options.map((value) => ({
      type: 'choice.resolve',
      payload: { value },
      meta: { actorId: actor.id },
    }));
  }

  ensureActor(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    timeout: boolean,
    nowMs: number,
  ): void {
    if (!runtime.pending || !isExpectedActor(runtime.pending, actor.id)) {
      throw new GameActionRejectedError('Aucun choix pour cet acteur');
    }
    if (!timeout) return;
    const deadline = Number(asRecord(runtime.pending.data).deadlineMs);
    if (!Number.isFinite(deadline) || deadline > nowMs) {
      throw new GameActionRejectedError('Le choix n’a pas expiré');
    }
  }
}

function isExpectedActor(
  pending: NonNullable<DeclarativeState<object>['pending']>,
  playerId: number,
): boolean {
  return pending.playerIds?.length
    ? pending.playerIds.includes(playerId) &&
        !(pending.resolvedPlayerIds ?? []).includes(playerId)
    : pending.playerId === playerId;
}

function timeoutValue<TState extends object>(
  data: Record<string, unknown>,
  options: unknown[],
  context: GameContext<TState>,
): unknown {
  if (data.timeoutStrategy === 'pass') return null;
  if (data.timeoutStrategy === 'default') return data.timeoutValue;
  if (data.timeoutStrategy === 'last') return options.at(-1);
  if (data.timeoutStrategy === 'random') return context.random.pick(options);
  if (!isMultiChoice(data.kind)) return options[0];
  const minimum = Math.max(0, Number(data.min ?? 0));
  return options.slice(0, minimum);
}

function ensureValidValue(
  data: Record<string, unknown>,
  options: unknown[],
  value: unknown,
  timeout: boolean,
): void {
  if (timeout && data.timeoutStrategy === 'pass' && value == null) return;
  if (!isMultiChoice(data.kind)) {
    if (!options.some((option) => sameValue(option, value))) {
      throw new GameActionRejectedError('Choix invalide');
    }
    return;
  }
  if (!Array.isArray(value))
    throw new GameActionRejectedError('Liste attendue');
  const unique = [...new Set(value)];
  const minimum = Math.max(0, Number(data.min ?? 0));
  const maximum = Math.max(minimum, Number(data.max ?? minimum));
  if (
    unique.length !== value.length ||
    value.length < minimum ||
    value.length > maximum ||
    value.some(
      (selected) => !options.some((option) => sameValue(option, selected)),
    )
  ) {
    throw new GameActionRejectedError('Sélection de joueurs invalide');
  }
  if (
    data.kind === 'ordering' &&
    (value.length !== options.length ||
      options.some(
        (option) => !value.some((selected) => sameValue(option, selected)),
      ))
  ) {
    throw new GameActionRejectedError('Ordre incomplet');
  }
}

function isMultiChoice(kind: unknown): boolean {
  return kind === 'players' || kind === 'many' || kind === 'ordering';
}

const sameValue = sameSerializableValue;

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
