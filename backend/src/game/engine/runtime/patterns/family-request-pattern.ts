import { requestCardFromPlayer } from './pattern-capabilities';
import type { GameContext } from '../definitions/game-author-context';
import { defineEmptyAction } from '../actions/action-builders';
import { definePattern } from './gameplay-pattern-core';

export type FamilyRequestCard =
  | {
      id: string;
      type: 'family';
      familyId: string;
      familyName: string;
      memberName: string;
    }
  | {
      id: string;
      type: 'quiz';
      question: string;
      choices: readonly string[];
      answerIndex: number;
    }
  | { id: string; type: 'nature'; description: string; delta: number };

export type FamilyRequestOptions = {
  askRecipe: string;
  passRecipe: string;
  askAction: string;
  passAction: string;
  deckId: string;
  handId: string;
  setsId: string;
  cards: readonly FamilyRequestCard[];
  pollutionCounter: string;
  pollutionLimit: number;
  familiesToWin: number;
  pollutionFinishReason: string;
  familyFinishReason: string;
  eventNamespace: string;
};

type State = Record<string, never>;
type Context = GameContext<State>;

export function familyRequest(source: FamilyRequestOptions) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const familyIds = program.cards
    .filter((card) => card.type === 'family')
    .map((card) => card.id);
  const ask = requestCardFromPlayer<State>({
    handId: program.handId,
    requests: ({ playerId, ctx }) =>
      ctx.players.others(playerId).flatMap((player) =>
        familyIds.map((cardId) => ({
          cardId,
          targetPlayerId: player.id,
        })),
      ),
    onReceived: ({ playerId, cardId, ctx }) => {
      ctx.events.message(`${program.eventNamespace}.family-card.received`, {
        playerId,
        cardId,
      });
      finishIfComplete(program, playerId, ctx);
    },
    onMiss: ({ playerId, ctx }) => drawAfterMiss(program, cards, playerId, ctx),
  });
  const pass = defineEmptyAction<State>({
    execute: ({ ctx }) => ctx.turn.end(),
    documentation: 'Passe volontairement le tour.',
  });
  return definePattern({
    id: `family-request:${program.deckId}`,
    mechanics: ['cards', 'collection', 'requests', 'counters'],
    actions: { [program.askRecipe]: ask, [program.passRecipe]: pass },
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const target = ctx.players.others(actor.id)[0];
        const cardId = familyIds[ctx.random.int(familyIds.length)];
        const action =
          target && cardId ? program.askAction : program.passAction;
        return availableActions.includes(action)
          ? {
              type: action,
              payload:
                target && cardId ? { targetPlayerId: target.id, cardId } : {},
            }
          : null;
      },
    },
  });
}
function drawAfterMiss(
  program: FamilyRequestOptions,
  cards: ReadonlyMap<string, FamilyRequestCard>,
  playerId: number,
  ctx: Context,
): void {
  const cardId = ctx.cards.drawOrRecycle<string>(program.deckId);
  if (!cardId) return;
  const card = cards.get(cardId);
  if (!card) return ctx.reject('UNKNOWN_NATURE_CARD', { cardId });
  if (card.type === 'family') {
    ctx.cards.give(program.handId, playerId, card.id);
    finishIfComplete(program, playerId, ctx);
  } else {
    ctx.cards.discard(program.deckId, card.id);
    if (card.type === 'nature') applyPollution(program, playerId, card, ctx);
  }
}

function applyPollution(
  program: FamilyRequestOptions,
  playerId: number,
  card: Extract<FamilyRequestCard, { type: 'nature' }>,
  ctx: Context,
): void {
  const total = Math.min(
    program.pollutionLimit,
    Math.max(0, ctx.counters.get(program.pollutionCounter) + card.delta),
  );
  ctx.counters.set(program.pollutionCounter, total);
  ctx.events.message(`${program.eventNamespace}.pollution.changed`, {
    cardId: card.id,
    delta: card.delta,
    total,
  });
  if (total >= program.pollutionLimit)
    ctx.match.finish({
      winners: ctx.players.others(playerId).map((player) => player.id),
      reason: program.pollutionFinishReason,
    });
}

function finishIfComplete(
  program: FamilyRequestOptions,
  playerId: number,
  ctx: Context,
): void {
  for (const family of ctx.cards.completableSets(program.setsId, playerId))
    ctx.cards.completeSet(program.setsId, playerId, family, { consume: false });
  if (
    ctx.cards.playerCompletedSets(program.setsId, playerId).length >=
    program.familiesToWin
  )
    ctx.match.finish({
      winners: [playerId],
      reason: program.familyFinishReason,
    });
}
