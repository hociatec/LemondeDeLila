import {
  rejectRule,
  defineAction,
  gameInput,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import { CONTES_DECKS } from './content';
import {
  applyCard,
  applyRoll,
  CONTES_RESOURCES,
  CONTES_STATUSES,
  blockedPosition,
  drainResolution,
  drawContesCard,
  moveContesAndResolve,
  position,
  requestNumber,
  scheduleContesTarget,
  requirePending,
  rollDie,
  transferToken,
} from './resolution';
import type { ContesState } from './state';

type RuleContext = GameContext<ContesState>;
export const CONTES_PHASES = setupPlayingPhases<ContesState>();

export const roll = defineAction<ContesState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Lance le dé, applique les objets et résout intégralement la case atteinte.',
  available: ({ ctx }) =>
    CONTES_PHASES.is(ctx, 'playing') &&
    ctx.choice.current() == null &&
    ctx.match.lifecycle() !== 'finished',
  execute: ({ state, actor, ctx }) => {
    ctx.turn.flags.set('contes.resolution', {
      playerId: actor.id,
      types: [],
    });
    let value = ctx.status.has(actor.id, CONTES_STATUSES.forcedOne)
      ? 1
      : rollDie(ctx);
    if (
      value === 1 &&
      ctx.status.consume(actor.id, CONTES_STATUSES.replaceOne)
    ) {
      value = 4;
    }
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      total: value,
    });
    if (
      ctx.resources.has(actor.id, CONTES_RESOURCES.reroll, 1) &&
      value !== 1
    ) {
      const pending = {
        kind: 'reroll' as const,
        actorId: actor.id,
        roll: value,
      };
      ctx.choice.one({
        id: 'contes.reroll',
        player: actor.id,
        options: ['keep', 'reroll'],
        data: pending,
        label: (choice) =>
          choice === 'keep' ? `Garder ${value}` : 'Utiliser le parchemin',
      });
      return;
    }
    applyRoll(state, actor.id, value, ctx);
    drainResolution(state, ctx);
  },
});

export const CONTES_ACTIONS = { roll };

const pawnSelection = sequentialPawnSelection<ContesState>({
  setId: 'contes',
  choiceId: 'contes.pawn',
  complete: ({ ctx }) => {
    CONTES_PHASES.transition(ctx, 'playing');
    const starterId = ctx.round.starter();
    if (starterId != null) ctx.turn.to(starterId);
  },
});

export const requestPawn = pawnSelection.request;
export const resolvePawn = pawnSelection.resolve;

export function resolveReroll(
  state: ContesState,
  actorId: number,
  value: string,
  ctx: RuleContext,
): void {
  const pending = requirePending(ctx, 'reroll', actorId);
  let rollValue = pending.roll;
  if (value === 'reroll') {
    ctx.resources.remove(actorId, CONTES_RESOURCES.reroll, 1);
    rollValue = rollDie(ctx);
    if (
      rollValue === 1 &&
      ctx.status.consume(actorId, CONTES_STATUSES.replaceOne)
    ) {
      rollValue = 4;
    }
    ctx.events.message('contes.reroll.used', {
      playerId: actorId,
      total: rollValue,
    });
  }
  applyRoll(state, actorId, rollValue, ctx);
  drainResolution(state, ctx);
}

export function resolveOption(
  state: ContesState,
  actorId: number,
  value: string,
  ctx: RuleContext,
): void {
  const pending = requirePending(ctx, 'option', actorId);
  if (pending.effect === 'song') {
    if (value === 'move-three') moveContesAndResolve(state, actorId, 3, 0, ctx);
    else scheduleContesTarget(actorId, 'song-steal', ctx);
  } else if (pending.effect === 'wish') {
    if (value === 'move-two') moveContesAndResolve(state, actorId, 2, 0, ctx);
    else if (value === 'swap') scheduleContesTarget(actorId, 'wish-swap', ctx);
    else drawContesCard(state, actorId, 'bonus', 0, ctx);
  } else {
    const targetId = pending.targetId;
    if (targetId == null) rejectRule('Cible de la Clé d’or absente');
    ctx.status.remove(actorId, CONTES_STATUSES.keyOfGold);
    drawContesCard(
      state,
      targetId,
      value === 'bonus' ? 'bonus' : 'malus',
      0,
      ctx,
    );
  }
  drainResolution(state, ctx);
}

export function resolveLaughter(
  state: ContesState,
  actorId: number,
  value: number,
  ctx: RuleContext,
): void {
  const pending = requirePending(ctx, 'laughter', actorId);
  pending.picks[actorId] = value;
  const nextId = pending.order.find((id) => pending.picks[id] == null);
  if (nextId != null) {
    pending.actorId = nextId;
    requestNumber(nextId, ctx, pending);
    return;
  }
  const maximum = Math.max(...Object.values(pending.picks));
  for (const [id, pick] of Object.entries(pending.picks))
    if (pick === maximum) moveContesAndResolve(state, Number(id), 1, 0, ctx);
  drainResolution(state, ctx);
}

export function resolveCard(
  state: ContesState,
  actorId: number,
  cardId: number,
  ctx: RuleContext,
): void {
  const pending = requirePending(ctx, 'abundance', actorId);
  const card = pending.cardIds.includes(cardId)
    ? CONTES_DECKS.bonus.find((candidate) => candidate.id === cardId)
    : null;
  if (!card) rejectRule('Carte Contes invalide');
  applyCard(state, actorId, card, 0, ctx);
  drainResolution(state, ctx);
}

export function resolveToken(
  state: ContesState,
  actorId: number,
  token: string,
  ctx: RuleContext,
): void {
  const pending = requirePending(ctx, 'token', actorId);
  if (!pending.tokens.includes(token)) rejectRule('Objet Contes invalide');
  transferToken(pending.targetId, actorId, token, ctx);
  ctx.events.message('contes.token.stolen', {
    playerId: actorId,
    targetId: pending.targetId,
    token,
  });
  drainResolution(state, ctx);
}

export function skipBlockedContesPlayer(
  _state: ContesState,
  ctx: RuleContext,
): void {
  const player = ctx.players.current();
  if (!player) return;
  ctx.events.message('game.player.passed', { playerId: player.id });
  ctx.turn.complete();
}

export function unblockPassedPlayers(
  _state: ContesState,
  ctx: RuleContext,
): void {
  const current = ctx.players.current();
  if (!current) return;
  const blocker = blockedPosition(ctx, current.id);
  if (blocker == null) return;
  const passed = ctx.players
    .all()
    .some(
      (player) =>
        player.id !== current.id && position(player.id, ctx) >= blocker,
    );
  if (passed) ctx.status.remove(current.id, CONTES_STATUSES.blocked);
}

export { CONTES_CONTENT_COUNTS } from './resolution';
