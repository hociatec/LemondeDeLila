import {
  cards,
  defineChoice,
  defineGame,
  gameInput,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { VOYAGE_CONTENT } from './content';
import {
  advanceFinishCountdown,
  resolveVoyageQuiz,
  VOYAGE_ACTIONS,
  VOYAGE_FINISH_COUNTDOWN,
  VOYAGE_FINISH_STARTED,
  voyageCollections,
  voyageLastTargets,
} from './rules';
import { VOYAGE_EFFECTS } from './effects';
import type {
  VoyageCollection,
  VoyageCollectionKind,
  VoyagePlayerView,
  VoyageState,
} from './state';

const deckNames: VoyageCollectionKind[] = [
  'legend',
  'farce',
  'treasure',
  'landscape',
];

export default defineGame<VoyageState, typeof VOYAGE_ACTIONS, VoyagePlayerView>(
  {
    id: 'voyage-en-terre-de-brumes',
    displayName: 'Voyage en Terre de Brumes !',
    category: 'JeuxDePlateaux',
    subcategory: 'LesQuatreVents',
    description: 'Parcourez l’Irlande et réunissez légendes et trésors.',
    players: { min: 2, max: 10 },
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
    setup: () => ({}),
    lifecycle: {
      afterTurn: ({ state, ctx }) => advanceFinishCountdown(state, ctx),
    },
    actions: VOYAGE_ACTIONS,
    effects: VOYAGE_EFFECTS,
    choices: {
      'voyage.choice': defineChoice<VoyageState, string>({
        input: gameInput.string({ min: 1, max: 256 }),
        resolve: ({ state, value, ctx }) =>
          resolveVoyageQuiz(state, value, ctx),
      }),
    },
    view: ({ state: _state, actor, ctx }) => {
      const collections = voyageCollections(ctx);
      const lastTargetByActor = voyageLastTargets(ctx);
      const finishCountdown =
        ctx.counters.get(VOYAGE_FINISH_STARTED) > 0
          ? ctx.counters.get(VOYAGE_FINISH_COUNTDOWN)
          : null;
      const positions = ctx.players.byId((player) =>
        ctx.movement.position('ireland', player.id),
      );
      return playerView({
        game: {
          collections,
          lastTargetByActor,
          finishCountdown,
        },
        extras: {
          currentPlayerView: actor
            ? { id: actor.id, username: actor.username }
            : null,
          collections: structuredClone(collections),
          ui: {
            panels: [
              {
                title: 'Cartes',
                lines: ctx.players.all().map((player) => {
                  const collection = collections[player.id];
                  return `${player.username} : ${collectionTotal(collection)} carte(s)`;
                }),
              },
            ],
          },
        },
        board: { tiles: VOYAGE_CONTENT.tiles, positions },
      });
    },
    bot: { choose: () => ({ type: 'roll', payload: {} }) },
  },
);

function collectionTotal(collection: VoyageCollection): number {
  return Object.values(collection).reduce((sum, count) => sum + count, 0);
}
