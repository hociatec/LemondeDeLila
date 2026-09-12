import type { NatureFamiliesCard, NatureFamiliesProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { requestCardFromPlayer } from '../../recipes/gameplay/card-actions.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

export function natureFamiliesRules(source: NatureFamiliesProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const familyIds = program.cards
    .filter((card) => card.type === 'family')
    .map((card) => card.id);
  return {
    ask: requestCardFromPlayer<State>({
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
      onMiss: ({ playerId, ctx }) =>
        drawAfterMiss(program, cards, playerId, ctx),
    }),
    pass: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ ctx }) => ctx.turn.end(),
      documentation: 'Passe volontairement le tour.',
    }),
    familyIds,
  };
}
function drawAfterMiss(
  program: NatureFamiliesProgram,
  cards: ReadonlyMap<string, NatureFamiliesCard>,
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
  program: NatureFamiliesProgram,
  playerId: number,
  card: Extract<NatureFamiliesCard, { type: 'nature' }>,
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
  program: NatureFamiliesProgram,
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
