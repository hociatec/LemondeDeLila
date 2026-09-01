import {
  createCardsKitState,
  type CardZoneDefinition,
  type HandsDefinition,
} from '../cards/cards-kit';
import { createDiceKitState, type DiceDefinition } from '../kits/dice-kit';
import type { EngineKitsState } from '../definitions/game-definition';
import { projectGameKits } from './game-kit-view';
import { createGridKitState } from '../kits/grid-kit';
import { createMovementKitState } from '../kits/movement-kit';
import { createQuizKitState } from '../kits/quiz-kit';

describe('projectGameKits', () => {
  it('reveals owner hands and redacts every other private hand', () => {
    const kits = createKits();
    const handDefinition = {
      component: 'cards.hands',
      id: 'main',
      deck: 'main',
      initial: 1,
      visibility: 'owner',
    } satisfies HandsDefinition;
    kits.cards.decks.main = ['hidden'];
    kits.cards.discards.main = ['played'];
    kits.cards.hands.main = { '1': ['mine'], '2': ['theirs'] };

    expect(projectGameKits(kits, 1, 3, [handDefinition])).toMatchObject({
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
    expect(projectGameKits(kits, null, 3, [handDefinition])).toMatchObject({
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
    const handDefinition = {
      component: 'cards.hands',
      id: 'table',
      deck: 'main',
      initial: 0,
      visibility: 'public',
    } satisfies HandsDefinition;
    kits.cards.decks.main = [];
    kits.cards.hands.table = { '1': ['visible'] };

    expect(projectGameKits(kits, null, 0, [handDefinition])).toMatchObject({
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

  it('redacts an owner hand after the owner leaves an active round', () => {
    const kits = createKits();
    const handDefinition = {
      component: 'cards.hands',
      id: 'main',
      deck: 'main',
      initial: 1,
      visibility: 'owner',
      ownerVisibility: 'active-round',
    } satisfies HandsDefinition;
    kits.cards.decks.main = ['remaining'];
    kits.cards.hands.main = { '1': ['hidden-after-leaving'] };

    expect(projectGameKits(kits, 1, 3, [handDefinition], [1])).toMatchObject({
      cards: {
        hands: {
          main: {
            byPlayer: { '1': { count: 1 } },
          },
        },
      },
    });
  });

  it('projects public zones and redacts hidden zones', () => {
    const kits = createKits();
    const publicZone = {
      component: 'cards.zone',
      id: 'table',
      deck: 'main',
      visibility: 'public',
    } satisfies CardZoneDefinition;
    const hiddenZone = {
      component: 'cards.zone',
      id: 'removed',
      deck: 'main',
      visibility: 'hidden',
    } satisfies CardZoneDefinition;
    kits.cards.decks.main = [];
    kits.cards.zones.table = ['visible'];
    kits.cards.zones.removed = ['secret'];

    expect(
      projectGameKits(kits, null, 0, [publicZone, hiddenZone]),
    ).toMatchObject({
      cards: {
        zones: {
          table: { visibility: 'public', cards: ['visible'] },
          removed: { visibility: 'hidden', cards: { count: 1 } },
        },
      },
    });
  });

  it('projects deterministic dice results without exposing kit internals', () => {
    const kits = createKits();
    const diceDefinition = {
      component: 'dice.set',
      id: 'main',
      count: 2,
      sides: 6,
    } satisfies DiceDefinition;
    kits.dice.rolls.main = { values: [2, 5], total: 7 };

    expect(projectGameKits(kits, 1, 4, [diceDefinition])).toMatchObject({
      dice: {
        id: 'main',
        label: 'Dés',
        sides: 6,
        dice: [
          { id: 'main-1', label: 'Dé 1', sides: 6, value: 2 },
          { id: 'main-2', label: 'Dé 2', sides: 6, value: 5 },
        ],
        total: 7,
        rollKey: '4:0:main',
      },
    });
  });
});

function createKits() {
  return {
    cards: createCardsKitState(),
    movement: createMovementKitState(),
    dice: createDiceKitState(),
    grid: createGridKitState(),
    quiz: createQuizKitState(),
  } satisfies EngineKitsState;
}
