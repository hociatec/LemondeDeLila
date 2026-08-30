import {
  cards,
  collection,
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  raceGame,
} from '../../../engine/sdk/public-api';
import { VOYAGE_CONTENT } from './content';
import {
  advanceFinishCountdown,
  resolveVoyageQuiz,
  VOYAGE_ACTIONS,
  VOYAGE_FINISH_COUNTDOWN,
  VOYAGE_FINISH_STARTED,
} from './rules';
import { VOYAGE_EFFECTS } from './effects';
import type { VoyageCollectionKind, VoyageState } from './types';

const deckNames: VoyageCollectionKind[] = [
  'legend',
  'farce',
  'treasure',
  'landscape',
];

export default defineGame<VoyageState>()({
  id: 'voyage-en-terre-de-brumes',
  displayName: 'Voyage en Terre de Brumes !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Parcourez l’Irlande et réunissez légendes et trésors.',
  players: { min: 2, max: 10 },
  content: defineGameContent('voyage-en-terre-de-brumes', VOYAGE_CONTENT),
  patterns: [
    raceGame({
      trackId: 'ireland',
      spaces: VOYAGE_CONTENT.tiles.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    ...deckNames.map((id) =>
      cards.deck({
        id,
        cards: VOYAGE_CONTENT[id],
        shuffle: true,
        empty: 'recycle',
      }),
    ),
    collection.view({
      id: 'voyage',
      groups: Object.fromEntries(
        deckNames.map((kind) => [
          kind,
          { kind: 'resource' as const, id: `voyage.collection.${kind}` },
        ]),
      ),
    }),
  ],
  initialization: {
    counters: {
      [VOYAGE_FINISH_STARTED]: 0,
      [VOYAGE_FINISH_COUNTDOWN]: 0,
    },
    startRound: false,
  },
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'C', type: 'interface', id: 'cards' },
  ],
  lifecycle: {
    afterTurn: ({ state, ctx }) => advanceFinishCountdown(state, ctx),
  },
  actions: VOYAGE_ACTIONS,
  effects: VOYAGE_EFFECTS,
  choices: {
    'voyage.choice': defineChoice<VoyageState, string>({
      input: gameInput.string({ min: 1, max: 256 }),
      resolve: ({ state, value, ctx }) => resolveVoyageQuiz(state, value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
