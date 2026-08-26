import type { GameSingleActionDto } from '../models/game-action.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import { GameActionRejectedError } from '../../domain/errors/game-domain.errors';
import type {
  DeclarativeGameDefinition,
  DeclarativeState,
  GameActionMap,
} from './game-definition';
import type { GameRuleContext } from './game-rule-context';

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
    context: GameRuleContext<TState>,
    timeout: boolean,
  ): void {
    this.ensureActor(runtime, actor, timeout, context.clock.nowMs());
    const data = asRecord(runtime.pending?.data);
    const options = Array.isArray(data.options) ? data.options : [];
    const value = timeout
      ? timeoutValue(data, options)
      : asRecord(action.payload).value;
    ensureValidValue(data, options, value);
    const choiceId = typeof data.choiceId === 'string' ? data.choiceId : '';
    const resolver = this.definition.choices?.[choiceId];
    if (!resolver)
      throw new GameActionRejectedError(`Choix inconnu: ${choiceId}`);
    context.choice.clear();
    const next = resolver.resolve({
      state: runtime.game,
      actor,
      value,
      ctx: context,
    });
    if (next) context.replaceState(next);
  }

  actions(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
  ): GameSingleActionDto[] {
    if (!runtime.pending || runtime.pending.playerId !== actor.id) return [];
    const options = asRecord(runtime.pending.data).options;
    if (!Array.isArray(options)) return [];
    if (asRecord(runtime.pending.data).kind === 'players') {
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
    if (!runtime.pending || runtime.pending.playerId !== actor.id) {
      throw new GameActionRejectedError('Aucun choix pour cet acteur');
    }
    if (!timeout) return;
    const deadline = Number(asRecord(runtime.pending.data).deadlineMs);
    if (!Number.isFinite(deadline) || deadline > nowMs) {
      throw new GameActionRejectedError('Le choix n’a pas expiré');
    }
  }
}

function timeoutValue(
  data: Record<string, unknown>,
  options: unknown[],
): unknown {
  if (data.kind !== 'players') return options[0];
  const minimum = Math.max(0, Number(data.min ?? 0));
  return options.slice(0, minimum);
}

function ensureValidValue(
  data: Record<string, unknown>,
  options: unknown[],
  value: unknown,
): void {
  if (data.kind !== 'players') {
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
}

function sameValue(left: unknown, right: unknown): boolean {
  return (
    Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
