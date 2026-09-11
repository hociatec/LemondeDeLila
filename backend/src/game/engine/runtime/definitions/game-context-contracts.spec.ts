import { defineGame } from './game-definition';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import { cards } from '../cards/cards-kit';
import { movement } from '../kits/movement-kit';
import type { GameContextFor } from '../game-rule-context';
import {
  raceGame,
  pawnRace,
  quizRace,
  cardGame,
} from '../patterns/gameplay-pattern-track-card';
import {
  gridGame,
  marketGame,
  roundScoring,
  simultaneousAnswers,
  submissionJudgeGame,
} from '../patterns/gameplay-pattern-round-economy';
import { defineCardsSchema } from '../cards/typed-cards';

const base = {
  id: 'context-capabilities',
  displayName: 'Context',
  category: 'test',
  players: { min: 1, max: 2 },
  actions: {
    wait: defineAction({ input: gameInput.object({}), execute: () => {} }),
  },
};
const empty = defineGame<object>()(base);
const declaredResources = defineGame<object>()({
  ...base,
  resourceIds: ['tokens'],
});
function declaredResourceContract(
  context: GameContextFor<typeof declaredResources>,
) {
  context.resources.get(1, 'tokens');
  // @ts-expect-error resource catalogue preserves its literal identifiers
  context.resources.get(1, 'token-typo');
}
void declaredResourceContract;
void declaredResources;
const patternResources = defineGame<object>()({
  ...base,
  patterns: [
    { id: 'resource-catalogue', mechanics: [], resourceIds: ['stars'] },
  ],
});
function patternResourceContract(
  context: GameContextFor<typeof patternResources>,
) {
  context.resources.get(1, 'stars');
  // @ts-expect-error The compiled pattern resource catalogue is exact.
  context.resources.get(1, 'missing');
}
void patternResourceContract;
it('retains pattern resource identifiers after removing authoring patterns', () => {
  expect(patternResources.resourceIds).toEqual(['stars']);
  expect(patternResources.patterns).toEqual([
    { id: 'resource-catalogue', mechanics: [] },
  ]);
});
const deck = defineGame<object>()({
  ...base,
  components: [cards.deck({ id: 'deck', cards: ['one'] })],
});

const raceDefinition = defineGame<object>()({
  ...base,
  patterns: [raceGame({ spaces: 10 })],
});
const pawnDefinition = defineGame<object>()({
  ...base,
  patterns: [
    pawnRace({ pawnSetId: 'pawns', pawns: [{ id: 'one', label: 'One' }] }),
  ],
});
const quizDefinition = defineGame<object>()({
  ...base,
  patterns: [quizRace({ spaces: 10, quizId: 'questions', questions: [] })],
});
const gridDefinition = defineGame<object>()({
  ...base,
  patterns: [gridGame({ width: 3, height: 3 })],
});
const marketDefinition = defineGame<object>()({
  ...base,
  patterns: [
    marketGame({
      marketId: 'market',
      inventoryId: 'items',
      items: ['one'],
      currency: 'coins',
      prices: { one: 1 },
    }),
  ],
});
const roundsDefinition = defineGame<object>()({
  ...base,
  patterns: [
    roundScoring({ score: () => {} }),
    simultaneousAnswers(),
    submissionJudgeGame(),
  ],
});
const cardsDefinition = defineGame<object>()({
  ...base,
  patterns: [
    cardGame({
      schema: defineCardsSchema({
        decks: { deck: cards.deck({ id: 'deck', cards: ['one'] }) },
        hands: {
          hand: cards.hands({
            id: 'hand',
            deck: 'deck',
            initial: 0,
            visibility: 'owner',
          }),
        },
      }),
      deckId: 'deck',
      handId: 'hand',
    }),
  ],
});

it('keeps actual pattern factory capabilities through game compilation', () => {
  const check = (
    race: GameContextFor<typeof raceDefinition>,
    pawn: GameContextFor<typeof pawnDefinition>,
    questions: GameContextFor<typeof quizDefinition>,
    board: GameContextFor<typeof gridDefinition>,
    market: GameContextFor<typeof marketDefinition>,
    rounds: GameContextFor<typeof roundsDefinition>,
    hand: GameContextFor<typeof cardsDefinition>,
  ) => {
    void race.movement;
    void race.dice;
    // @ts-expect-error race pattern does not install cards
    void race.cards;
    // @ts-expect-error a race does not declare voting
    void race.voting;
    void pawn.pawns;
    void pawn.dice;
    // @ts-expect-error pawn positions do not install a movement track
    void pawn.movement;
    void questions.quiz;
    void questions.movement;
    // @ts-expect-error quiz race does not install cards
    void questions.cards;
    void board.grid;
    // @ts-expect-error grid pattern does not install movement
    void board.movement;
    void market.economy;
    void market.inventory;
    // @ts-expect-error market pattern does not install cards
    void market.cards;
    // @ts-expect-error round patterns must not widen capabilities
    void rounds.cards;
    // @ts-expect-error round patterns must not widen capabilities
    void rounds.movement;
    void rounds.voting;
    void hand.cards;
    // @ts-expect-error card pattern does not install movement
    void hand.movement;
  };
  void check;
  expect(
    raceDefinition.components.map((value) => value.component).sort(),
  ).toEqual(['dice.set', 'movement.track']);
  expect(roundsDefinition.components).toEqual([]);
  expect(
    pawnDefinition.components.map((value) => value.component).sort(),
  ).toEqual(['dice.set', 'pawn.set']);
  expect(
    quizDefinition.components.map((value) => value.component).sort(),
  ).toEqual(['dice.set', 'movement.track', 'quiz.bank']);
  expect(gridDefinition.components.map((value) => value.component)).toEqual([
    'grid.board',
  ]);
  expect(
    marketDefinition.components.map((value) => value.component).sort(),
  ).toEqual(['economy.market', 'inventory.set']);
  expect(
    cardsDefinition.components.map((value) => value.component).sort(),
  ).toEqual(['cards.deck', 'cards.hands']);
});
const track = defineGame<object>()({
  ...base,
  patterns: [
    {
      id: 'track',
      mechanics: ['movement'],
      components: [movement.track({ id: 'road', spaces: 10 })],
    },
  ],
});

it('derives optional capabilities from concrete components and pattern components', () => {
  const check = (
    none: GameContextFor<typeof empty>,
    withCards: GameContextFor<typeof deck>,
    withTrack: GameContextFor<typeof track>,
  ) => {
    // @ts-expect-error a game with no card component has no cards capability
    void none.cards;
    // @ts-expect-error a game with no movement component has no movement capability
    void none.movement;
    // @ts-expect-error an empty definition does not declare voting
    void none.voting;
    withCards.cards.deckCount('deck');
    // @ts-expect-error a card game does not acquire movement implicitly
    void withCards.movement;
    withTrack.movement.position('road', 1);
    // @ts-expect-error a movement pattern does not acquire cards implicitly
    void withTrack.cards;
  };
  void check;
  expect(empty.components).toEqual([]);
  expect(deck.components[0].component).toBe('cards.deck');
  expect(track.components[0].component).toBe('movement.track');
});
