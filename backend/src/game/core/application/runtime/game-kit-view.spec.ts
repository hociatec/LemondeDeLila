import { createCardsKitState } from './cards-kit';
import { createDiceKitState } from './dice-kit';
import type { EngineKitsState } from './game-definition';
import { projectGameKits } from './game-kit-view';
import { createGridKitState } from './grid-kit';
import { createMovementKitState } from './movement-kit';
import { createQuizKitState } from './quiz-kit';

describe('projectGameKits', () => {
  it('reveals owner hands and redacts every other private hand', () => {
    const kits = createKits();
    kits.cards.decks.main = ['hidden'];
    kits.cards.discards.main = ['played'];
    kits.cards.handDefinitions.main = {
      component: 'cards.hands',
      id: 'main',
      deck: 'main',
      initial: 1,
      visibility: 'owner',
    };
    kits.cards.hands.main = { '1': ['mine'], '2': ['theirs'] };

    expect(projectGameKits(kits, 1, 3)).toEqual({
      cards: {
        decks: { main: { count: 1 } },
        discards: { main: { count: 1, cards: ['played'] } },
        hands: {
          main: {
            visibility: 'owner',
            byPlayer: { '1': ['mine'], '2': { count: 1 } },
          },
        },
      },
    });
    expect(projectGameKits(kits, null, 3)).toEqual({
      cards: {
        decks: { main: { count: 1 } },
        discards: { main: { count: 1, cards: ['played'] } },
        hands: {
          main: {
            visibility: 'owner',
            byPlayer: { '1': { count: 1 }, '2': { count: 1 } },
          },
        },
      },
    });
  });

  it('reveals public hands to every viewer', () => {
    const kits = createKits();
    kits.cards.decks.main = [];
    kits.cards.handDefinitions.table = {
      component: 'cards.hands',
      id: 'table',
      deck: 'main',
      initial: 0,
      visibility: 'public',
    };
    kits.cards.hands.table = { '1': ['visible'] };

    expect(projectGameKits(kits, null, 0)).toMatchObject({
      cards: {
        hands: {
          table: {
            visibility: 'public',
            byPlayer: { '1': ['visible'] },
          },
        },
      },
    });
  });

  it('projects deterministic dice results without exposing kit internals', () => {
    const kits = createKits();
    kits.dice.sets.main = { id: 'main', count: 2, sides: 6 };
    kits.dice.rolls.main = { values: [2, 5], total: 7 };

    expect(projectGameKits(kits, 1, 4)).toEqual({
      dice: {
        id: 'main',
        label: 'Dés',
        sides: 6,
        dice: [
          { id: 'main-1', label: 'Dé 1', sides: 6, value: 2 },
          { id: 'main-2', label: 'Dé 2', sides: 6, value: 5 },
        ],
        total: 7,
        rollKey: '4:2-5',
      },
    });
  });
});

function createKits(): EngineKitsState {
  return {
    cards: createCardsKitState(),
    movement: createMovementKitState(),
    dice: createDiceKitState(),
    grid: createGridKitState(),
    quiz: createQuizKitState(),
  };
}
