import {
  rejectRule,
  defineAction,
  drawEvent,
  gameEffects,
  gameInput,
} from '../../../engine/sdk/public-api';
import type {
  GameContext,
  GameEffectInstruction,
} from '../../../engine/sdk/public-api';
import {
  ENTRE_RITES_CARD_BY_ID,
  ENTRE_RITES_FAMILY_CARDS,
  ENTRE_RITES_FAMILY_IDS,
  type RiteFamilyCard,
} from './content';
import type { EntreRitesState, RitesPendingChoice } from './state';

const DECK = 'rites';
const HANDS = 'players';
const FAMILIES = 'rite-families';
const TOTAL_FAMILIES = 5;
export const RITES_SPECIALS = 'rites-specials-played';
export const RITES_PEACE = 'rites.peace';
export const RITES_SILENCE = 'rites.silence';
type RuleContext = GameContext<EntreRitesState>;
export type RitesStealChoice = { targetPlayerId: number; cardId: string };

export const askCard = defineAction<
  EntreRitesState,
  { cardId: string; targetPlayerId: number }
>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.playerId(),
  }),
  documentation: 'Demande une carte précise dans une famille déjà représentée.',
  available: ({ ctx }) => peaceTurnsRemaining(ctx) === 0,
  validate: ({ actor, input, ctx }) =>
    enumerateRequests(actor.id, ctx).some(
      (request) =>
        request.cardId === input.cardId &&
        request.targetPlayerId === input.targetPlayerId,
    ),
  enumerate: ({ actor, ctx }) => enumerateRequests(actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    const targetHand = ctx.cards.hand<string>(HANDS, input.targetPlayerId);
    if (targetHand.includes(input.cardId)) {
      transfer(input.targetPlayerId, actor.id, input.cardId, ctx);
      completeFamilies(state, actor.id, ctx);
      determineVictory(state, ctx);
      return;
    }
    drawRitesCardForPlayer(state, actor.id, ctx);
    determineVictory(state, ctx);
    if (ctx.match.lifecycle() !== 'finished' && ctx.choice.current() == null)
      ctx.turn.complete();
  },
});

export const pass = defineAction<EntreRitesState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Passe volontairement le tour.',
  execute: ({ state: _state, actor, ctx }) => {
    ctx.events.message('game.player.passed', { playerId: actor.id });
    ctx.turn.complete();
  },
});

export const ENTRE_RITES_ACTIONS = { ask_card: askCard, pass };

export function enumerateRequests(
  playerId: number,
  ctx: RuleContext,
): Array<{ cardId: string; targetPlayerId: number }> {
  const families = new Set(
    ctx.cards
      .hand<string>(HANDS, playerId)
      .map((cardId) => ENTRE_RITES_CARD_BY_ID[cardId])
      .filter((card): card is RiteFamilyCard => card?.type === 'family')
      .map((card) => card.familyId),
  );
  return ctx.players
    .all()
    .filter((target) => target.id !== playerId)
    .flatMap((target) =>
      ENTRE_RITES_FAMILY_CARDS.filter((card) =>
        families.has(card.familyId),
      ).map((card) => ({ cardId: card.id, targetPlayerId: target.id })),
    );
}

export function dealFamilyHands(
  playerIds: readonly number[],
  ctx: RuleContext,
): void {
  const specialBuffer: string[] = [];
  const queue = [...playerIds];
  while (queue.length > 0 && ctx.cards.deckCount(DECK) > 0) {
    const playerId = queue.shift();
    if (playerId == null) return;
    const cardId = ctx.cards.draw<string>(DECK);
    if (!cardId) return;
    if (ENTRE_RITES_CARD_BY_ID[cardId]?.type === 'special') {
      specialBuffer.push(cardId);
      queue.unshift(playerId);
      continue;
    }
    ctx.cards.give(HANDS, playerId, cardId);
    if (ctx.cards.hand(HANDS, playerId).length < 5) queue.push(playerId);
  }
  ctx.cards.putOnTop(DECK, specialBuffer);
}

export function resolveRitesCardChoice(
  state: EntreRitesState,
  cardId: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<RitesPendingChoice>();
  if (!pending) rejectRule('Choix rituel introuvable');
  if (pending.kind === 'draw-one') {
    resolveDrawOne(state, pending, cardId, ctx);
  } else if (pending.kind === 'resurrection') {
    ctx.cards.takeDiscard(DECK, cardId);
    handleDrawnCard(state, pending.playerId, cardId, ctx);
  } else {
    rejectRule('Type de choix de carte rituel invalide');
  }
  finishChoiceResolution(state, ctx);
}

export function resolveRitesFamilyChoice(
  state: EntreRitesState,
  cardIds: string[],
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<RitesPendingChoice>();
  if (!pending || pending.kind !== 'free-family') {
    rejectRule('Choix de famille rituel invalide');
  }
  resolveFreeFamily(pending.playerId, cardIds, ctx);
  finishChoiceResolution(state, ctx);
}

export function resolveRitesStealChoice(
  state: EntreRitesState,
  selection: RitesStealChoice,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<RitesPendingChoice>();
  if (!pending || pending.kind !== 'reveal-and-steal') {
    rejectRule('Choix de vol rituel invalide');
  }
  transfer(selection.targetPlayerId, pending.playerId, selection.cardId, ctx);
  completeFamilies(state, pending.playerId, ctx);
  finishChoiceResolution(state, ctx);
}

function finishChoiceResolution(
  state: EntreRitesState,
  ctx: RuleContext,
): void {
  determineVictory(state, ctx);
  if (ctx.match.lifecycle() !== 'finished' && ctx.choice.current() == null)
    ctx.turn.complete();
}

export function drawRitesCardForPlayer(
  state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const cardId = drawEvent<EntreRitesState, string>(ctx, {
    deckId: DECK,
    playerId,
    recycle: true,
  });
  if (cardId) handleDrawnCard(state, playerId, cardId, ctx);
}

function handleDrawnCard(
  state: EntreRitesState,
  playerId: number,
  cardId: string,
  ctx: RuleContext,
): void {
  const card = ENTRE_RITES_CARD_BY_ID[cardId];
  if (!card) return;
  if (card.type === 'family') {
    ctx.cards.give(HANDS, playerId, cardId);
    completeFamilies(state, playerId, ctx);
    return;
  }
  ctx.cards.discard(DECK, cardId);
  ctx.inventory.add(RITES_SPECIALS, playerId, cardId);
  const silenceOwnerId = statusOwner(RITES_SILENCE, ctx);
  if (silenceOwnerId != null && silenceOwnerId !== playerId) return;
  ctx.effects.schedule(
    ...card.effects.map((effect) => retargetRiteEffect(effect, playerId)),
  );
}

function retargetRiteEffect(
  effect: GameEffectInstruction,
  playerId: number,
): GameEffectInstruction {
  if (effect.kind === 'swap-hands') {
    return {
      ...effect,
      left:
        effect.left.kind === 'self'
          ? gameEffects.target.player(playerId)
          : effect.left,
      right:
        effect.right.kind === 'chosen-opponent'
          ? { ...effect.right, chooserPlayerId: playerId }
          : effect.right,
    };
  }
  if (
    effect.kind === 'custom' ||
    effect.kind === 'add-status' ||
    effect.kind === 'remove-status' ||
    effect.kind === 'gain-resource' ||
    effect.kind === 'lose-resource' ||
    effect.kind === 'skip-turn'
  ) {
    return effect.target?.kind === 'self'
      ? { ...effect, target: gameEffects.target.player(playerId) }
      : effect;
  }
  return effect;
}

export function drawTwoChoice(
  state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const cardIds = [
    ctx.cards.drawOrRecycle<string>(DECK),
    ctx.cards.drawOrRecycle<string>(DECK),
  ].filter((cardId): cardId is string => cardId != null);
  if (cardIds.length === 0) return;
  if (cardIds.length === 1) {
    handleDrawnCard(state, playerId, cardIds[0], ctx);
    return;
  }
  const pending: RitesPendingChoice = {
    kind: 'draw-one',
    playerId,
    cardIds,
  };
  ctx.choice.one({
    id: 'rites.card',
    player: playerId,
    options: cardIds,
    data: pending,
    label: cardName,
  });
}

function resolveDrawOne(
  state: EntreRitesState,
  pending: Extract<RitesPendingChoice, { kind: 'draw-one' }>,
  selected: string,
  ctx: RuleContext,
): void {
  for (const cardId of pending.cardIds) {
    if (cardId === selected)
      handleDrawnCard(state, pending.playerId, cardId, ctx);
    else ctx.cards.discard(DECK, cardId);
  }
}

export function resurrectionChoice(
  _state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const options = ctx.cards
    .discardPile<string>(DECK)
    .filter((cardId) => ENTRE_RITES_CARD_BY_ID[cardId]?.type === 'family');
  if (options.length === 0) return;
  const pending: RitesPendingChoice = { kind: 'resurrection', playerId };
  ctx.choice.one({
    id: 'rites.card',
    player: playerId,
    options,
    data: pending,
    label: cardName,
  });
}

export function freeFamilyChoice(
  _state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const choices: string[][] = [];
  for (let left = 0; left < hand.length; left += 1) {
    for (let middle = left + 1; middle < hand.length; middle += 1) {
      for (let right = middle + 1; right < hand.length; right += 1) {
        const cardIds = [hand[left], hand[middle], hand[right]];
        const families = new Set(
          cardIds.map((id) => {
            const card = ENTRE_RITES_CARD_BY_ID[id];
            return card?.type === 'family' ? card.familyId : null;
          }),
        );
        if (families.size === 3 && !families.has(null)) choices.push(cardIds);
      }
    }
  }
  if (choices.length === 0) return;
  const pending: RitesPendingChoice = { kind: 'free-family', playerId };
  ctx.choice.one({
    id: 'rites.family',
    player: playerId,
    options: choices,
    data: pending,
    label: (ids) => ids.map(cardName).join(', '),
  });
}

function resolveFreeFamily(
  playerId: number,
  cardIds: string[],
  ctx: RuleContext,
): void {
  for (const cardId of cardIds) ctx.cards.take(HANDS, playerId, cardId);
  const family = ENTRE_RITES_FAMILY_IDS.find(
    (candidate) =>
      !ctx.cards.playerCompletedSets(FAMILIES, playerId).includes(candidate),
  );
  if (family) {
    ctx.cards.completeSet(FAMILIES, playerId, family, {
      allowIncomplete: true,
      consume: false,
    });
  }
}

export function collectFromOthers(
  state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    if (player.id === playerId) continue;
    const cardId = ctx.cards.hand<string>(HANDS, player.id)[0];
    if (cardId) transfer(player.id, playerId, cardId, ctx);
  }
  completeFamilies(state, playerId, ctx);
}

export function dawnCycle(state: EntreRitesState, ctx: RuleContext): void {
  for (const player of ctx.players.all()) {
    const cardId = ctx.cards.hand<string>(HANDS, player.id)[0];
    if (cardId) ctx.cards.play(HANDS, DECK, player.id, cardId);
  }
  for (const player of ctx.players.all()) {
    drawRitesCardForPlayer(state, player.id, ctx);
    if (ctx.choice.current()) return;
    drawRitesCardForPlayer(state, player.id, ctx);
    if (ctx.choice.current()) return;
  }
}

export function stealChoice(
  _state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const options = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .flatMap((player) =>
      ctx.cards.hand<string>(HANDS, player.id).map((cardId) => ({
        targetPlayerId: player.id,
        cardId,
      })),
    );
  if (options.length === 0) return;
  const pending: RitesPendingChoice = {
    kind: 'reveal-and-steal',
    playerId,
  };
  ctx.choice.one({
    id: 'rites.steal',
    player: playerId,
    options,
    data: pending,
    label: (choice) => cardName(choice.cardId),
  });
}

function completeFamilies(
  _state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  for (const familyId of ENTRE_RITES_FAMILY_IDS) {
    ctx.cards.completeSet(FAMILIES, playerId, familyId, { discard: false });
  }
}

function determineVictory(_state: EntreRitesState, ctx: RuleContext): void {
  const completedCounts = ctx.cards.completedSetCounts(FAMILIES);
  const total = Object.values(completedCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (total < TOTAL_FAMILIES) return;
  const ranked = ctx.players
    .all()
    .map((player) => ({
      playerId: player.id,
      families: completedCounts[player.id] ?? 0,
      specials: ctx.inventory.count(RITES_SPECIALS, player.id),
    }))
    .sort(
      (left, right) =>
        right.families - left.families ||
        right.specials - left.specials ||
        left.playerId - right.playerId,
    );
  const winnerId = ranked[0]?.playerId;
  if (winnerId != null) {
    ctx.match.finish({ winners: [winnerId], reason: 'five-families' });
  }
}

function transfer(
  fromId: number,
  toId: number,
  cardId: string,
  ctx: RuleContext,
): void {
  ctx.cards.transfer(HANDS, fromId, toId, cardId);
}

function cardName(cardId: string): string {
  return ENTRE_RITES_CARD_BY_ID[cardId]?.name ?? cardId;
}

export function peaceTurnsRemaining(ctx: RuleContext): number {
  return ctx.players
    .all()
    .reduce(
      (remaining, player) =>
        Math.max(
          remaining,
          ctx.status.get(player.id, RITES_PEACE)?.remaining ?? 0,
        ),
      0,
    );
}

export function statusOwner(statusId: string, ctx: RuleContext): number | null {
  return (
    ctx.players.all().find((player) => ctx.status.has(player.id, statusId))
      ?.id ?? null
  );
}
