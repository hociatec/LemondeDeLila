import {
  defineGame,
  defineAction,
  gameInput,
  cards,
} from '../../sdk/public-api';
import type { GameContextFor } from '../../sdk/public-api';

const actions = {
  pass: defineAction({
    input: gameInput.object({}),
    execute: ({ ctx }) => ctx.turn.end(),
  }),
};
const empty = defineGame<Record<string, never>>()({
  id: 'no-cards',
  displayName: 'No cards',
  category: 'test',
  players: { min: 1, max: 2 },
  actions,
});
const withCards = defineGame<Record<string, never>>()({
  id: 'with-cards',
  displayName: 'Cards',
  category: 'test',
  players: { min: 1, max: 2 },
  actions,
  components: [cards.deck({ id: 'main', cards: ['a'] })],
});
const direct = defineGame({
  id: 'direct-empty',
  displayName: 'Direct',
  category: 'test',
  players: { min: 1, max: 2 },
  actions,
});
const scheduled = defineGame({
  id: 'scheduled',
  displayName: 'Scheduled',
  category: 'test',
  players: { min: 1, max: 2 },
  actions,
  capabilities: ['scheduler'],
});

function checkAbsent(ctx: GameContextFor<typeof empty>) {
  // @ts-expect-error Cards is absent from the compiled component list.
  void ctx.cards;
  // @ts-expect-error Movement is absent from the compiled component list.
  void ctx.movement;
  // @ts-expect-error Inventory is absent from the compiled component list.
  void ctx.inventory;
  // @ts-expect-error Economy is absent from the compiled component list.
  void ctx.economy;
  // @ts-expect-error Quiz is absent from the compiled component list.
  void ctx.quiz;
  // @ts-expect-error No voting pattern is declared.
  void ctx.voting;
  // @ts-expect-error Scheduler requires an explicit capability declaration.
  void ctx.scheduler;
  // @ts-expect-error Submission kit is optional.
  void ctx.submissions;
  // @ts-expect-error Submission flow is optional.
  void ctx.submissionFlow;
  // @ts-expect-error Judge kit is optional.
  void ctx.judge;
  // @ts-expect-error Ownership requires a registry component.
  void ctx.ownership;
  // @ts-expect-error Grid requires a board component.
  void ctx.grid;
  // @ts-expect-error Pawns require a pawn set.
  void ctx.pawns;
  // @ts-expect-error Dice require a dice set.
  void ctx.dice;
}
function checkDirect(
  ctx: GameContextFor<typeof direct>,
  timer: GameContextFor<typeof scheduled>,
) {
  // @ts-expect-error The direct syntax must preserve absence of components.
  void ctx.cards;
  // @ts-expect-error The direct syntax must preserve absence of scheduler.
  void ctx.scheduler;
  void timer.scheduler;
  // @ts-expect-error Enabling scheduler must not enable voting.
  void timer.voting;
}
void checkDirect;
function checkPresent(ctx: GameContextFor<typeof withCards>) {
  return ctx.cards;
}
void checkAbsent;
void checkPresent;

it('retains the actual component catalogue used to derive optional capabilities', () => {
  expect(empty.components).toEqual([]);
  expect(empty.capabilities).toEqual([]);
  expect(direct.capabilities).toEqual([]);
  expect(scheduled.capabilities).toEqual(['scheduler']);
  expect(withCards.capabilities).toEqual(['cards']);
  expect(withCards.components.map((component) => component.component)).toEqual([
    'cards.deck',
  ]);
});

it('rejects a component capability declared without its required component', () => {
  expect(() =>
    defineGame({
      id: 'invalid-cards',
      displayName: 'Invalid',
      category: 'test',
      players: { min: 1, max: 2 },
      actions,
      capabilities: ['cards'],
    }),
  ).toThrow(/capability/);
});
