import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  ENTRE_RITES_CARD_BY_ID,
  ENTRE_RITES_CUSTOM_FAMILY_SIZE,
  ENTRE_RITES_FAMILY_CARDS,
  type RiteFamilyCard,
  type RiteFamilyId,
  type RiteSpecialCard,
} from './content';
import type { EntreRitesState, RitesPendingChoice } from './state';

const DECK = 'rites';
const HANDS = 'players';
const TOTAL_FAMILIES = 5;
type RuleContext = GameRuleContext<EntreRitesState>;

export const askCard = defineAction<
  EntreRitesState,
  { cardId: string; targetPlayerId: number }
>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.playerId(),
  }),
  documentation: 'Demande une carte précise dans une famille déjà représentée.',
  available: ({ state }) => state.peaceTurnsRemaining === 0,
  availableInputs: ({ actor, ctx }) => enumerateRequests(actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    const targetHand = ctx.cards.hand<string>(HANDS, input.targetPlayerId);
    if (targetHand.includes(input.cardId)) {
      transfer(input.targetPlayerId, actor.id, input.cardId, ctx);
      completeFamilies(state, actor.id, ctx);
      determineVictory(state, ctx);
      return;
    }
    drawForPlayer(state, actor.id, ctx);
    determineVictory(state, ctx);
    if (state.winnerId == null && state.pendingChoice == null)
      endTurn(state, ctx);
  },
});

export const pass = defineAction<EntreRitesState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Passe volontairement le tour.',
  execute: ({ state, actor, ctx }) => {
    ctx.history.add(`${actor.username} passe son tour.`);
    endTurn(state, ctx);
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

export function resolveRitesChoice(
  state: EntreRitesState,
  value: unknown,
  ctx: RuleContext,
): void {
  const pending = state.pendingChoice;
  if (!pending) throw new Error('Choix rituel introuvable');
  state.pendingChoice = null;
  if (pending.kind === 'draw-one')
    resolveDrawOne(state, pending, String(value), ctx);
  else if (pending.kind === 'resurrection') {
    const cardId = String(value);
    ctx.cards.takeDiscard(DECK, cardId);
    handleDrawnCard(state, pending.playerId, cardId, ctx);
  } else if (pending.kind === 'swap-hands') {
    swapHands(pending.playerId, Number(value), ctx);
  } else if (pending.kind === 'free-family') {
    resolveFreeFamily(state, pending.playerId, value, ctx);
  } else {
    const selection = value as { targetPlayerId: number; cardId: string };
    transfer(selection.targetPlayerId, pending.playerId, selection.cardId, ctx);
    completeFamilies(state, pending.playerId, ctx);
  }
  determineVictory(state, ctx);
  if (state.winnerId == null && state.pendingChoice == null)
    endTurn(state, ctx);
}

function drawForPlayer(
  state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
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
  state.specialsPlayed[playerId].push(cardId);
  if (state.silenceOwnerId != null && state.silenceOwnerId !== playerId) return;
  applySpecial(state, playerId, card, ctx);
}

function applySpecial(
  state: EntreRitesState,
  playerId: number,
  card: RiteSpecialCard,
  ctx: RuleContext,
): void {
  if (card.effect === 'draw_two_choose_one')
    drawTwoChoice(state, playerId, ctx);
  else if (card.effect === 'draw_and_trigger')
    drawForPlayer(state, playerId, ctx);
  else if (card.effect === 'collect_from_others')
    collectFromOthers(state, playerId, ctx);
  else if (card.effect === 'take_from_discard')
    resurrectionChoice(state, playerId, ctx);
  else if (card.effect === 'mute_specials') state.silenceOwnerId = playerId;
  else if (card.effect === 'swap_hands')
    targetPlayerChoice(state, playerId, 'swap-hands', ctx);
  else if (card.effect === 'free_family')
    freeFamilyChoice(state, playerId, ctx);
  else if (card.effect === 'reshuffle_cycle') dawnCycle(state, ctx);
  else if (card.effect === 'peace_turns') state.peaceTurnsRemaining = 2;
  else if (card.effect === 'reveal_and_steal')
    stealChoice(state, playerId, ctx);
}

function drawTwoChoice(
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
  state.pendingChoice = { kind: 'draw-one', playerId, cardIds };
  ctx.choice.one({
    id: 'rites.special',
    player: playerId,
    options: cardIds,
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

function resurrectionChoice(
  state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const options = ctx.cards
    .discardPile<string>(DECK)
    .filter((cardId) => ENTRE_RITES_CARD_BY_ID[cardId]?.type === 'family');
  if (options.length === 0) return;
  state.pendingChoice = { kind: 'resurrection', playerId };
  ctx.choice.one({
    id: 'rites.special',
    player: playerId,
    options,
    label: cardName,
  });
}

function targetPlayerChoice(
  state: EntreRitesState,
  playerId: number,
  kind: 'swap-hands',
  ctx: RuleContext,
): void {
  const options = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .map((player) => player.id);
  if (options.length === 0) return;
  state.pendingChoice = { kind, playerId };
  ctx.choice.one({
    id: 'rites.special',
    player: playerId,
    options,
    label: (targetId) =>
      ctx.players.get(targetId)?.username ?? String(targetId),
  });
}

function freeFamilyChoice(
  state: EntreRitesState,
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
  state.pendingChoice = { kind: 'free-family', playerId };
  ctx.choice.one({
    id: 'rites.special',
    player: playerId,
    options: choices,
    label: (ids) => ids.map(cardName).join(', '),
  });
}

function resolveFreeFamily(
  state: EntreRitesState,
  playerId: number,
  value: unknown,
  ctx: RuleContext,
): void {
  if (!Array.isArray(value)) return;
  for (const cardId of value.map(String))
    ctx.cards.take(HANDS, playerId, cardId);
  const family = (
    Object.keys(ENTRE_RITES_CUSTOM_FAMILY_SIZE) as RiteFamilyId[]
  ).find((candidate) => !state.completedFamilies[playerId].includes(candidate));
  if (family) state.completedFamilies[playerId].push(family);
}

function collectFromOthers(
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

function dawnCycle(state: EntreRitesState, ctx: RuleContext): void {
  for (const player of ctx.players.all()) {
    const cardId = ctx.cards.hand<string>(HANDS, player.id)[0];
    if (cardId) ctx.cards.play(HANDS, DECK, player.id, cardId);
  }
  for (const player of ctx.players.all()) {
    drawForPlayer(state, player.id, ctx);
    if (state.pendingChoice) return;
    drawForPlayer(state, player.id, ctx);
    if (state.pendingChoice) return;
  }
}

function stealChoice(
  state: EntreRitesState,
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
  state.pendingChoice = { kind: 'reveal-and-steal', playerId };
  ctx.choice.one({
    id: 'rites.special',
    player: playerId,
    options,
    label: (choice) => cardName(choice.cardId),
  });
}

function swapHands(playerId: number, targetId: number, ctx: RuleContext): void {
  const own = ctx.cards.hand<string>(HANDS, playerId);
  const target = ctx.cards.hand<string>(HANDS, targetId);
  const copy = [...own];
  own.splice(0, own.length, ...target);
  target.splice(0, target.length, ...copy);
}

function completeFamilies(
  state: EntreRitesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  for (const familyId of Object.keys(
    ENTRE_RITES_CUSTOM_FAMILY_SIZE,
  ) as RiteFamilyId[]) {
    if (state.completedFamilies[playerId].includes(familyId)) continue;
    const familyCards = hand.filter((cardId) => {
      const card = ENTRE_RITES_CARD_BY_ID[cardId];
      return card?.type === 'family' && card.familyId === familyId;
    });
    if (familyCards.length < ENTRE_RITES_CUSTOM_FAMILY_SIZE[familyId]) continue;
    for (const cardId of familyCards) ctx.cards.take(HANDS, playerId, cardId);
    state.completedFamilies[playerId].push(familyId);
  }
}

function determineVictory(state: EntreRitesState, ctx: RuleContext): void {
  const total = Object.values(state.completedFamilies).reduce(
    (sum, families) => sum + families.length,
    0,
  );
  if (total < TOTAL_FAMILIES) return;
  const ranked = ctx.players
    .all()
    .map((player) => ({
      playerId: player.id,
      families: state.completedFamilies[player.id].length,
      specials: state.specialsPlayed[player.id].length,
    }))
    .sort(
      (left, right) =>
        right.families - left.families ||
        right.specials - left.specials ||
        left.playerId - right.playerId,
    );
  state.winnerId = ranked[0]?.playerId ?? null;
}

function endTurn(state: EntreRitesState, ctx: RuleContext): void {
  state.peaceTurnsRemaining = Math.max(0, state.peaceTurnsRemaining - 1);
  ctx.turn.end();
  if (state.silenceOwnerId === ctx.players.current()?.id)
    state.silenceOwnerId = null;
}

function transfer(
  fromId: number,
  toId: number,
  cardId: string,
  ctx: RuleContext,
): void {
  ctx.cards.take(HANDS, fromId, cardId);
  ctx.cards.give(HANDS, toId, cardId);
}

function cardName(cardId: string): string {
  return ENTRE_RITES_CARD_BY_ID[cardId]?.name ?? cardId;
}
