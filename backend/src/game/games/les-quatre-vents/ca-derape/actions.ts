import {
  commonStatuses,
  defineAction,
  gameInput,
  rejectRule,
  type GameContext,
  type NoGameState as CaDerapeState,
} from '../../../engine/sdk/public-api';
import {
  CA_LAST_ROLL,
  CA_MIRROR_ROLL,
  CA_NEXT_PLAYER_DELTA,
  incrementIdleCounters,
  mirrorSource,
  movePlayer,
} from './rules';

type RuleContext = GameContext<CaDerapeState>;

export const roll = defineAction<CaDerapeState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout les cartes Situation en chaîne.',
  execute: ({ state, actor, ctx }) => {
    const mirroredFrom = mirrorSource(actor.id, ctx);
    let value =
      mirroredFrom == null ? 0 : ctx.resources.get(mirroredFrom, CA_LAST_ROLL);
    if (value <= 0) value = ctx.dice.roll('main').total;
    ctx.status.remove(actor.id, CA_MIRROR_ROLL);
    if (ctx.status.consume(actor.id, commonStatuses.doubleRoll)) {
      value *= 2;
    }
    ctx.resources.set(actor.id, CA_LAST_ROLL, value);
    let delta = value + ctx.counters.get(CA_NEXT_PLAYER_DELTA);
    ctx.counters.set(CA_NEXT_PLAYER_DELTA, 0);
    if (ctx.status.consume(actor.id, commonStatuses.doubleMove)) {
      delta *= 2;
    }
    incrementIdleCounters(actor.id, delta, ctx);
    movePlayer(state, actor.id, delta, 0, true, ctx);
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      total: value,
    });
    ctx.turn.complete({ waiting: ctx.choice.current() != null });
  },
});

export const CA_DERAPE_ACTIONS = { roll };

export function resolveDeltaChoice(value: number, ctx: RuleContext): void {
  const pending = ctx.choice.consumeContinuation<{
    kind: 'next-delta';
    actorId: number;
  }>();
  if (pending?.kind !== 'next-delta') {
    rejectRule('Choix Ça Dérape inattendu');
  }
  if (value !== -1 && value !== 1) rejectRule('Delta invalide');
  ctx.counters.set(CA_NEXT_PLAYER_DELTA, value);
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}
