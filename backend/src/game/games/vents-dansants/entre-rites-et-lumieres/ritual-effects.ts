import type { GameContext } from '../../../engine/sdk/public-api';
import { ENTRE_RITES_CARD_BY_ID } from './content';
import type { EntreRitesState, RitesPendingChoice } from './types';
import {
  cardName,
  completeFamilies,
  drawRitesCardForPlayer,
  handleDrawnCard,
  transfer,
} from './rules';

type RuleContext = GameContext<EntreRitesState>;
const DECK = 'rites';
const HANDS = 'players';

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
