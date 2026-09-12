import type { EventVisibility } from '../../../core/application/models/game-event.model';
import type { GameContext } from '../definitions/game-author-context';
import type { GameInputSchema } from '../actions/game-input-schema';

export type GameEventDefinition<TType extends string, TData extends object> = {
  readonly type: TType;
  readonly data: GameInputSchema<TData>;
  readonly visibility: EventVisibility;
  emit<TState extends object>(ctx: GameContext<TState>, data: TData): void;
};

export type GameEventMapOf<
  TDefinitions extends readonly GameEventDefinition<string, object>[],
> = {
  [
    TDefinition in TDefinitions[number] as TDefinition['type']
  ]: TDefinition extends GameEventDefinition<string, infer TData>
    ? TData
    : never;
};

/** Canonical typed registry for game-authored events. */
export function defineEvents<
  const TDefinitions extends readonly GameEventDefinition<string, object>[],
>(...definitions: TDefinitions): TDefinitions {
  if (definitions.length > 512) {
    throw new Error('Too many game event definitions');
  }
  if (
    definitions.some(
      (definition) =>
        typeof definition.type !== 'string' ||
        definition.type.length === 0 ||
        definition.type.length > 128,
    )
  ) {
    throw new Error('Invalid game event identifier');
  }
  const ids = definitions.map((definition) => definition.type);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Game event identifiers must be unique');
  }
  return Object.freeze(definitions);
}

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
