import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  DAME_NATURE_CARD_BY_ID,
  DAME_NATURE_FAMILY_CARD_DEFINITIONS,
} from './content';
import type {
  DameNatureFamilyCardDefinition,
  DameNatureNatureCardDefinition,
} from './content';
import type { DameNatureState } from './state';

const DECK = 'nature';
const HANDS = 'players';
const FAMILY_SIZE = 6;
const FAMILIES_TO_WIN = 4;
type RuleContext = GameRuleContext<DameNatureState>;

type AskInput = { cardId: string; targetPlayerId: number };

export const askCard = defineAction<DameNatureState, AskInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.playerId(),
  }),
  documentation:
    'Demande un membre de famille précis à un adversaire, sans révéler sa main.',
  availableInputs: ({ actor, ctx }) =>
    ctx.players
      .all()
      .filter((player) => player.id !== actor.id)
      .flatMap((player) =>
        DAME_NATURE_FAMILY_CARD_DEFINITIONS.map((card) => ({
          cardId: card.id,
          targetPlayerId: player.id,
        })),
      ),
  execute: ({ state, actor, input, ctx }) => {
    if (input.targetPlayerId === actor.id) {
      throw new Error('Impossible de demander une carte à soi-même');
    }
    const card = familyCard(input.cardId);
    if (!ctx.players.get(input.targetPlayerId)) {
      throw new Error('Joueur ciblé introuvable');
    }
    const targetHand = ctx.cards.hand<string>(HANDS, input.targetPlayerId);
    if (targetHand.includes(card.id)) {
      ctx.cards.take(HANDS, input.targetPlayerId, card.id);
      ctx.cards.give(HANDS, actor.id, card.id);
      ctx.history.add(`${actor.username} obtient « ${card.memberName} ».`);
      finishIfComplete(state, actor.id, ctx);
      return;
    }
    ctx.history.add(`${actor.username} ne trouve pas la carte demandée.`);
    drawAfterMiss(state, actor.id, ctx);
    if (state.winnerIds.length === 0) ctx.turn.end();
  },
});

export const pass = defineAction<DameNatureState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Passe volontairement le tour.',
  execute: ({ ctx }) => ctx.turn.end(),
});

export const DAME_NATURE_ACTIONS = { ask_card: askCard, pass };

export function completedFamilyCount(
  playerId: number,
  ctx: RuleContext,
): number {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const counts = new Map<string, number>();
  for (const cardId of hand) {
    const card = DAME_NATURE_CARD_BY_ID[cardId];
    if (card?.type !== 'family') continue;
    counts.set(card.familyId, (counts.get(card.familyId) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count >= FAMILY_SIZE).length;
}

function drawAfterMiss(
  state: DameNatureState,
  playerId: number,
  ctx: RuleContext,
): void {
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  if (!cardId) return;
  const card = DAME_NATURE_CARD_BY_ID[cardId];
  if (!card) throw new Error(`Carte Dame Nature inconnue: ${cardId}`);
  if (card.type === 'family') {
    ctx.cards.give(HANDS, playerId, card.id);
    finishIfComplete(state, playerId, ctx);
  } else {
    ctx.cards.discard(DECK, card.id);
    if (card.type === 'quiz') state.lastQuizCardId = card.id;
    else applyPollution(state, playerId, card, ctx);
  }
}

function applyPollution(
  state: DameNatureState,
  playerId: number,
  card: DameNatureNatureCardDefinition,
  ctx: RuleContext,
): void {
  state.pollutionTokens = Math.min(
    12,
    Math.max(0, state.pollutionTokens + card.delta),
  );
  ctx.history.add(
    `${card.description} (${card.delta >= 0 ? '+' : ''}${card.delta} pollution).`,
  );
  if (state.pollutionTokens < 12) return;
  state.pollutionLoserId = playerId;
  state.winnerIds = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .map((player) => player.id);
}

function finishIfComplete(
  state: DameNatureState,
  playerId: number,
  ctx: RuleContext,
): void {
  if (completedFamilyCount(playerId, ctx) >= FAMILIES_TO_WIN) {
    state.winnerIds = [playerId];
  }
}

function familyCard(cardId: string): DameNatureFamilyCardDefinition {
  const card = DAME_NATURE_CARD_BY_ID[cardId];
  if (card?.type !== 'family') throw new Error('Carte famille invalide');
  return card;
}
