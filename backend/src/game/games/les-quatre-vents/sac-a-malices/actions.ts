import { defineAction, gameInput } from '../../../core/application/public-api';
import {
  changeMoney,
  currentSacVariant,
  SAC_CONSECUTIVE_DOUBLES,
  SAC_JAIL_CARDS,
  SAC_JAIL_TURNS,
  sendToJail,
} from './economy';
import {
  managementOptions,
  moveForward,
  resolveJailTurn,
  rollPair,
} from './rules';
import type { SacManagementKind, SacState } from './state';

export const roll = defineAction<SacState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance deux dés, déplace le pion et résout la case.',
  available: ({ actor, ctx }) => ctx.match.playerStatus(actor.id) === 'active',
  execute: ({ state, actor, ctx }) => {
    if (ctx.resources.get(actor.id, SAC_JAIL_TURNS) > 0) {
      resolveJailTurn(state, actor.id, ctx);
      return;
    }
    const [first, second] = rollPair(ctx);
    const total = first + second;
    const isDouble = first === second;
    const consecutiveDoubles = isDouble
      ? ctx.resources.add(actor.id, SAC_CONSECUTIVE_DOUBLES, 1)
      : ctx.resources.set(actor.id, SAC_CONSECUTIVE_DOUBLES, 0);
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      values: [first, second],
      total,
    });
    if (consecutiveDoubles >= 3) {
      ctx.resources.set(actor.id, SAC_CONSECUTIVE_DOUBLES, 0);
      sendToJail(state, actor.id, ctx);
      ctx.turn.complete({
        waiting: ctx.choice.current() != null,
      });
      return;
    }
    if (isDouble) ctx.turn.extra();
    moveForward(state, actor.id, total, 0, ctx);
    ctx.turn.complete({ waiting: ctx.choice.current() != null });
  },
});

function managementAction(kind: SacManagementKind) {
  return defineAction<SacState, Record<string, never>>({
    input: gameInput.object({}),
    documentation: `Ouvre le choix de propriété pour l’opération ${kind}.`,
    available: ({ state, actor, ctx }) =>
      managementOptions(state, actor.id, kind, ctx).length > 0,
    execute: ({ state, actor, ctx }) => {
      const options = managementOptions(state, actor.id, kind, ctx);
      ctx.choice.one({
        id: 'sac.management',
        player: actor.id,
        options,
        data: { flow: 'management', playerId: actor.id, kind },
        label: (tileIndex) =>
          currentSacVariant(ctx).tiles[tileIndex]?.title ?? String(tileIndex),
      });
    },
  });
}

export const build = managementAction('build');
export const sellBuilding = managementAction('sell');
export const mortgage = managementAction('mortgage');
export const unmortgage = managementAction('unmortgage');

export const payFine = defineAction<SacState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Paie l’amende de prison lorsque la variante le permet.',
  available: ({ state: _state, actor, ctx }) => {
    const rules = currentSacVariant(ctx).rules;
    return (
      ctx.resources.get(actor.id, SAC_JAIL_TURNS) > 0 &&
      rules.jail.allowPayFine &&
      ctx.resources.has(actor.id, 'money', rules.jail.autoFine)
    );
  },
  execute: ({ state, actor, ctx }) => {
    const fine = currentSacVariant(ctx).rules.jail.autoFine;
    changeMoney(state, actor.id, -fine, true, ctx);
    ctx.resources.set(actor.id, SAC_JAIL_TURNS, 0);
    ctx.events.message('sac.jail.fine-paid', {
      playerId: actor.id,
      amount: fine,
    });
  },
});

export const useJailCard = defineAction<SacState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Utilise une carte de sortie de prison conservée.',
  available: ({ actor, ctx }) =>
    ctx.resources.get(actor.id, SAC_JAIL_TURNS) > 0 &&
    ctx.resources.get(actor.id, SAC_JAIL_CARDS) > 0,
  execute: ({ state: _state, actor, ctx }) => {
    ctx.resources.remove(actor.id, SAC_JAIL_CARDS, 1);
    ctx.resources.set(actor.id, SAC_JAIL_TURNS, 0);
    ctx.events.message('sac.jail.card-used', { playerId: actor.id });
  },
});

export const SAC_ACTIONS = {
  roll,
  build,
  sell_building: sellBuilding,
  mortgage,
  unmortgage,
  pay_fine: payFine,
  use_jail_card: useJailCard,
};
