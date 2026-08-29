import {
  rejectRule,
  defineAction,
  gameInput,
  requestCardFromPlayer,
} from '../../../engine/sdk/public-api';
import type { GameContext, NoGameState } from '../../../engine/sdk/public-api';
import {
  DAME_NATURE_CARD_BY_ID,
  DAME_NATURE_FAMILY_CARD_DEFINITIONS,
} from './content';
import type {
  DameNatureFamilyCardDefinition,
  DameNatureNatureCardDefinition,
} from './content';
type DameNatureState = NoGameState;

const DECK = 'nature';
const HANDS = 'players';
const FAMILIES_TO_WIN = 4;
const FAMILIES = 'nature-families';
export const DAME_NATURE_POLLUTION = 'dame-nature.pollution';
type RuleContext = GameContext<DameNatureState>;

export const askCard = requestCardFromPlayer<DameNatureState>({
  handId: HANDS,
  requests: ({ playerId, ctx }) =>
    ctx.players
      .all()
      .filter((player) => player.id !== playerId)
      .flatMap((player) =>
        DAME_NATURE_FAMILY_CARD_DEFINITIONS.map((card) => ({
          cardId: card.id,
          targetPlayerId: player.id,
        })),
      ),
  onReceived: ({ playerId, cardId, ctx }) => {
    const card = familyCard(cardId);
    ctx.events.message('dame-nature.family-card.received', {
      playerId,
      cardId: card.id,
    });
    finishIfComplete(playerId, ctx);
  },
  onMiss: ({ playerId, ctx }) => {
    ctx.events.message('game.card.request-missed', { playerId });
    drawAfterMiss(playerId, ctx);
  },
});

export const pass = defineAction<DameNatureState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Passe volontairement le tour.',
  execute: ({ ctx }) => ctx.turn.end(),
});

export const DAME_NATURE_ACTIONS = { ask_card: askCard, pass };

function drawAfterMiss(playerId: number, ctx: RuleContext): void {
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  if (!cardId) return;
  const card = DAME_NATURE_CARD_BY_ID[cardId];
  if (!card) rejectRule(`Carte Dame Nature inconnue: ${cardId}`);
  if (card.type === 'family') {
    ctx.cards.give(HANDS, playerId, card.id);
    finishIfComplete(playerId, ctx);
  } else {
    ctx.cards.discard(DECK, card.id);
    if (card.type !== 'quiz') applyPollution(playerId, card, ctx);
  }
}

function applyPollution(
  playerId: number,
  card: DameNatureNatureCardDefinition,
  ctx: RuleContext,
): void {
  const pollutionTokens = Math.min(
    12,
    Math.max(0, ctx.counters.get(DAME_NATURE_POLLUTION) + card.delta),
  );
  ctx.counters.set(DAME_NATURE_POLLUTION, pollutionTokens);
  ctx.events.message('dame-nature.pollution.changed', {
    cardId: card.id,
    delta: card.delta,
    total: pollutionTokens,
  });
  if (pollutionTokens < 12) return;
  const winnerIds = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .map((player) => player.id);
  ctx.match.finish({ winners: winnerIds, reason: 'pollution-limit' });
}

function finishIfComplete(playerId: number, ctx: RuleContext): void {
  for (const family of ctx.cards.completableSets(FAMILIES, playerId)) {
    ctx.cards.completeSet(FAMILIES, playerId, family, { consume: false });
  }
  if (
    ctx.cards.playerCompletedSets(FAMILIES, playerId).length >= FAMILIES_TO_WIN
  ) {
    ctx.match.finish({ winners: [playerId], reason: 'nature-completed' });
  }
}

function familyCard(cardId: string): DameNatureFamilyCardDefinition {
  const card = DAME_NATURE_CARD_BY_ID[cardId];
  if (card?.type !== 'family') rejectRule('Carte famille invalide');
  return card;
}
