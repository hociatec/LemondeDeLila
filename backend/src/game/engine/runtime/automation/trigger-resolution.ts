import type { DeclarativeTrigger } from '../contracts/declarative-trigger';
import type { GameContext } from '../definitions/game-author-context';
import type { DomainEvent } from '../events/game-context-events';
import { GameStateViolationError } from '../contracts/game-domain.errors';
import { createEffectEngineState } from '../effects/effects-core';
import { GameEffectEngineController } from '../effects/effect-engine';

type TriggerContext<TState extends object> = GameContext<TState> & {
  consumeEvents(): DomainEvent[];
};

/** Event reactions have their own bounded stack and never replace a pending choice. */
export function resolveTriggers<TState extends object>(options: {
  triggers: readonly DeclarativeTrigger[];
  actionType: string;
  actorId: number | null;
  state: () => TState;
  context: TriggerContext<TState>;
  contextFor: (playerId: number | null) => TriggerContext<TState>;
  stabilize: () => void;
}): DomainEvent[] {
  const { triggers, context } = options;
  const events = context.consumeEvents();
  let executions = 0;
  const run = (rule: DeclarativeTrigger, playerId: number | null): void => {
    if (++executions > 256)
      throw new GameStateViolationError('Trigger resolution budget exceeded');
    const ctx = options.contextFor(playerId);
    const engine = new GameEffectEngineController(
      createEffectEngineState(),
      options.state,
      ctx,
    );
    engine.run(
      ...(rule.condition
        ? [
            {
              kind: 'conditional' as const,
              condition: rule.condition,
              then: rule.effects,
            },
          ]
        : rule.effects),
    );
    events.push(...ctx.consumeEvents());
  };
  for (const rule of triggers)
    if (rule.on.kind === 'action' && rule.on.type === options.actionType)
      run(rule, options.actorId);
  let cursor = 0;
  for (let pass = 0; pass < 256; pass++) {
    while (cursor < events.length) {
      if (cursor >= 512)
        throw new GameStateViolationError('Trigger event budget exceeded');
      const event = events[cursor++];
      const playerId =
        'playerId' in event.data && typeof event.data.playerId === 'number'
          ? event.data.playerId
          : options.actorId;
      for (const rule of triggers) {
        if (rule.on.kind !== 'event' || rule.on.type !== event.type) continue;
        if (
          Object.entries(rule.on.equals ?? {}).some(
            ([field, expected]) =>
              !Object.hasOwn(event.data, field) ||
              Reflect.get(event.data, field) !== expected,
          )
        )
          continue;
        run(rule, playerId);
      }
    }
    options.stabilize();
    events.push(...context.consumeEvents());
    if (cursor === events.length) return events;
  }
  throw new GameStateViolationError('Trigger stabilization budget exceeded');
}
