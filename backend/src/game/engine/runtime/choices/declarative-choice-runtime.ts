import type { GameSingleActionDto } from '../../../core/application/models/game-action.model';
import type { PlayerState } from '../../../core/application/models/game-state.model';
import { GameActionRejectedError } from '../../../core/domain/errors/game-domain.errors';
import type { CompiledGameDefinition } from '../contracts/compiled-game-definition';
import type { DeclarativeState } from '../state/declarative-state';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameContext } from '../game-rule-context';
import { sameSerializableValue } from '../state/serializable-value';
import { parseStrictInteger } from '../../../../shared/utils/public-api';

export class DeclarativeChoiceRuntime<
  TState extends object,
  TActions extends GameActionMap<TState>,
> {
  constructor(
    private readonly definition: CompiledGameDefinition<TState, TActions>,
  ) {}

  resolve(
    runtime: DeclarativeState<TState>,
    actor: PlayerState,
    action: GameSingleActionDto,
    context: GameContext<TState>,
    timeout: boolean,
  ): void {
    this.ensureActor(runtime, actor, timeout, context.clock.nowMs());
    const data = asRecord(runtime.pending?.data);
    const options = Array.isArray(data.options)
      ? data.options.slice(0, 10_000)
      : [];
    const value = timeout
      ? timeoutValue(data, options, context)
      : asRecord(action.payload).value;
    ensureValidValue(data, options, value, timeout);
    const choiceId =
      typeof data.choiceId === 'string' ? data.choiceId.slice(0, 128) : '';
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
    actor: PlayerState,
  ): GameSingleActionDto[] {
    if (!runtime.pending || !isExpectedActor(runtime.pending, actor.id))
      return [];
    const options = asRecord(runtime.pending.data).options;
    if (!isUnknownArray(options)) return [];
    if (isMultiChoice(asRecord(runtime.pending.data).kind)) {
      const { minimum } = choiceBounds(asRecord(runtime.pending.data));
      return [
        {
          type: 'choice.resolve',
          payload: { value: options.slice(0, minimum) },
          meta: { actorId: actor.id },
        },
      ];
    }
    return options.slice(0, 128).map((value) => ({
      type: 'choice.resolve',
      payload: { value },
      meta: { actorId: actor.id },
    }));
  }

  ensureActor(
    runtime: DeclarativeState<TState>,
    actor: PlayerState,
    timeout: boolean,
    nowMs: number,
  ): void {
    if (!runtime.pending || !isExpectedActor(runtime.pending, actor.id)) {
      throw new GameActionRejectedError('Aucun choix pour cet acteur');
    }
    if (!timeout) return;
    const deadline = parseStrictInteger(
      asRecord(runtime.pending.data).deadlineMs,
      { min: 0 },
    );
    if (deadline === null || deadline > nowMs) {
      throw new GameActionRejectedError('Le choix n’a pas expiré');
    }
  }
}

function isExpectedActor(
  pending: NonNullable<DeclarativeState<object>['pending']>,
  playerId: number,
): boolean {
  return pending.playerIds?.length
    ? pending.playerIds.some((id) => Number(id) === playerId) &&
        !(pending.resolvedPlayerIds ?? []).some((id) => Number(id) === playerId)
    : Number(pending.playerId) === playerId;
}

function timeoutValue<TState extends object>(
  data: Record<string, unknown>,
  options: unknown[],
  context: GameContext<TState>,
): unknown {
  if (data.timeoutStrategy === 'pass') return null;
  if (data.timeoutStrategy === 'default') return data.timeoutValue;
  if (isMultiChoice(data.kind)) {
    const { minimum } = choiceBounds(data);
    if (minimum === 0) return [];
    if (data.timeoutStrategy === 'random')
      return context.random.shuffle(options).slice(0, minimum);
    if (data.timeoutStrategy === 'last') return options.slice(-minimum);
    return options.slice(0, minimum);
  }
  if (data.timeoutStrategy === 'last') return options.at(-1);
  if (data.timeoutStrategy === 'random') return context.random.pick(options);
  return options[0];
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
  const { minimum, maximum } = choiceBounds(data);
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

function choiceBounds(data: Record<string, unknown>): {
  minimum: number;
  maximum: number;
} {
  const minimum = parseStrictInteger(data.min ?? 0, { min: 0 });
  const maximum = parseStrictInteger(data.max ?? minimum, {
    min: minimum ?? 0,
  });
  if (minimum === null || maximum === null) {
    throw new GameActionRejectedError('Bornes de choix invalides');
  }
  if (maximum > 10_000) {
    throw new GameActionRejectedError('Bornes de choix excessives');
  }
  return { minimum, maximum };
}

function isMultiChoice(kind: unknown): boolean {
  return kind === 'players' || kind === 'many' || kind === 'ordering';
}

const sameValue = sameSerializableValue;

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length <= 10_000;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
