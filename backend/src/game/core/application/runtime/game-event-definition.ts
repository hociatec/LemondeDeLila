import type { EventVisibility } from '../models/game-event.model';
import type { GameContext } from './game-rule-context';
import type { GameInputSchema } from './game-input-schema';

export type GameEventDefinition<TType extends string, TData extends object> = {
  readonly type: TType;
  readonly data: GameInputSchema<TData>;
  readonly visibility: EventVisibility;
  emit<TState extends object>(ctx: GameContext<TState>, data: TData): void;
};

export function defineEvent<
  const TType extends string,
  TData extends object,
>(definition: {
  type: TType;
  data: GameInputSchema<TData>;
  visibility?: EventVisibility;
}): GameEventDefinition<TType, TData> {
  const visibility = definition.visibility ?? { kind: 'public' as const };
  return Object.freeze({
    type: definition.type,
    data: definition.data,
    visibility,
    emit: <TState extends object>(ctx: GameContext<TState>, data: TData) => {
      const parsed = definition.data.parse(data, `event.${definition.type}`);
      ctx.events.emit(definition.type, parsed, visibility);
    },
  });
}
