import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { CONTES_PAWNS } from './content';
import {
  applyCard,
  applyRoll,
  applyTarget,
  completeResolution,
  decrementTurnStatuses,
  drawAndApply,
  endResolvedTurn,
  moveAndLand,
  position,
  requestNumber,
  requestTarget,
  requirePending,
  rollDie,
  transferToken,
} from './resolution';
import type { ContesState } from './state';

type RuleContext = GameRuleContext<ContesState>;

export const roll = defineAction<ContesState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Lance le dé, applique les objets et résout intégralement la case atteinte.',
  available: ({ state }) =>
    state.setupComplete &&
    state.pendingEffect == null &&
    state.winnerId == null,
  execute: ({ state, actor, ctx }) => {
    state.resolvingPlayerId = actor.id;
    let value = state.forcedOneTurns[actor.id] > 0 ? 1 : rollDie(ctx);
    if (state.forcedOneTurns[actor.id] > 0) state.forcedOneTurns[actor.id] -= 1;
    if (value === 1 && state.replaceOne[actor.id]) {
      value = 4;
      state.replaceOne[actor.id] = false;
    }
    ctx.history.add(`${actor.username} obtient ${value}.`);
    if (state.rerollTokens[actor.id] > 0 && value !== 1) {
      state.pendingEffect = { kind: 'reroll', actorId: actor.id, roll: value };
      ctx.choice.one({
        id: 'contes.reroll',
        player: actor.id,
        options: ['keep', 'reroll'],
        label: (choice) =>
          choice === 'keep' ? `Garder ${value}` : 'Utiliser le parchemin',
      });
      return;
    }
    applyRoll(state, actor.id, value, ctx);
    completeResolution(state, ctx);
  },
});

export const CONTES_ACTIONS = { roll };

export function requestPawn(
  state: ContesState,
  actorId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const available = CONTES_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'contes.pawn',
    player: actorId,
    options: available.map((pawn) => pawn.id),
    label: (id) => available.find((pawn) => pawn.id === id)?.label ?? id,
  });
}

export function resolvePawn(
  state: ContesState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!CONTES_PAWNS.some((pawn) => pawn.id === pawnId))
    throw new Error('Pion Contes invalide');
  if (Object.values(state.pawnByPlayerId).includes(pawnId))
    throw new Error('Pion Contes déjà choisi');
  state.pawnByPlayerId[actorId] = pawnId;
  const next = ctx.players
    .all()
    .find((player) => state.pawnByPlayerId[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestPawn(state, next.id, ctx);
    return;
  }
  state.setupComplete = true;
  ctx.transitionTo('playing');
  ctx.turn.to(state.starterId);
}

export function resolveReroll(
  state: ContesState,
  actorId: number,
  value: string,
  ctx: RuleContext,
): void {
  const pending = requirePending(state, 'reroll', actorId);
  let rollValue = pending.roll;
  if (value === 'reroll') {
    state.rerollTokens[actorId] -= 1;
    rollValue = rollDie(ctx);
    if (rollValue === 1 && state.replaceOne[actorId]) {
      rollValue = 4;
      state.replaceOne[actorId] = false;
    }
    ctx.history.add(`Le parchemin donne ${rollValue}.`);
  }
  state.pendingEffect = null;
  applyRoll(state, actorId, rollValue, ctx);
  completeResolution(state, ctx);
}

export function resolveTarget(
  state: ContesState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const pending = requirePending(state, 'target', actorId);
  if (targetId === actorId || !ctx.players.get(targetId))
    throw new Error('Cible Contes invalide');
  state.pendingEffect = null;
  applyTarget(state, pending, targetId, ctx);
  completeResolution(state, ctx);
}

export function resolveOption(
  state: ContesState,
  actorId: number,
  value: string,
  ctx: RuleContext,
): void {
  const pending = requirePending(state, 'option', actorId);
  state.pendingEffect = null;
  if (pending.effect === 'song') {
    if (value === 'move-three') moveAndLand(state, actorId, 3, 0, ctx);
    else requestTarget(state, actorId, 'song-steal', ctx);
  } else if (pending.effect === 'wish') {
    if (value === 'move-two') moveAndLand(state, actorId, 2, 0, ctx);
    else if (value === 'swap') requestTarget(state, actorId, 'wish-swap', ctx);
    else drawAndApply(state, actorId, 'bonus', 0, ctx);
  } else {
    const targetId = pending.targetId;
    if (targetId == null) throw new Error('Cible de la Clé d’or absente');
    state.keyOfGold[actorId] = false;
    drawAndApply(
      state,
      targetId,
      value === 'bonus' ? 'bonus' : 'malus',
      0,
      ctx,
    );
  }
  completeResolution(state, ctx);
}

export function resolveLaughter(
  state: ContesState,
  actorId: number,
  value: number,
  ctx: RuleContext,
): void {
  const pending = requirePending(state, 'laughter', actorId);
  pending.picks[actorId] = value;
  const nextId = pending.order.find((id) => pending.picks[id] == null);
  if (nextId != null) {
    pending.actorId = nextId;
    requestNumber(nextId, ctx);
    return;
  }
  state.pendingEffect = null;
  const maximum = Math.max(...Object.values(pending.picks));
  for (const [id, pick] of Object.entries(pending.picks))
    if (pick === maximum) moveAndLand(state, Number(id), 1, 0, ctx);
  completeResolution(state, ctx);
}

export function resolveCard(
  state: ContesState,
  actorId: number,
  cardId: number,
  ctx: RuleContext,
): void {
  const pending = requirePending(state, 'abundance', actorId);
  const card = pending.cards.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error('Carte Contes invalide');
  state.pendingEffect = null;
  applyCard(state, actorId, card, 0, ctx);
  completeResolution(state, ctx);
}

export function resolveToken(
  state: ContesState,
  actorId: number,
  token: string,
  ctx: RuleContext,
): void {
  const pending = requirePending(state, 'token', actorId);
  if (!pending.tokens.includes(token)) throw new Error('Objet Contes invalide');
  transferToken(state, pending.targetId, actorId, token);
  state.pendingEffect = null;
  ctx.history.add(`${ctx.players.get(actorId)?.username} vole ${token}.`);
  completeResolution(state, ctx);
}

export function skipContesPlayer(state: ContesState, ctx: RuleContext): void {
  const player = ctx.players.current();
  if (!player) return;
  state.skipTurns[player.id] = Math.max(0, state.skipTurns[player.id] - 1);
  decrementTurnStatuses(state, player.id);
  ctx.history.add(`${player.username} passe son tour.`);
  endResolvedTurn(state, ctx);
}

export function replaceContesTurn(state: ContesState, ctx: RuleContext): void {
  const player = ctx.players.current();
  if (!player || state.activeSlotOwnerId != null) return;
  const replacementId = state.turnReplacement[player.id];
  if (replacementId == null) return;
  state.turnReplacement[player.id] = null;
  state.activeSlotOwnerId = player.id;
  ctx.turn.to(replacementId);
  ctx.history.add(
    `${ctx.players.get(replacementId)?.username} joue à la place de ${player.username}.`,
  );
}

export function unblockPassedPlayers(
  state: ContesState,
  ctx: RuleContext,
): void {
  const current = ctx.players.current();
  if (!current) return;
  const blocker = state.blockedAt[current.id];
  if (blocker == null) return;
  const passed = ctx.players
    .all()
    .some(
      (player) =>
        player.id !== current.id && position(player.id, ctx) >= blocker,
    );
  if (passed) state.blockedAt[current.id] = null;
}

export { CONTES_CONTENT_COUNTS } from './resolution';
