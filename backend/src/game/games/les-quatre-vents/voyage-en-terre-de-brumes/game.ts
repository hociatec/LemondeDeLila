import {
  cards,
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { VOYAGE_CONTENT } from './content';
import { resolveVoyageChoice, skipVoyagePlayer, VOYAGE_ACTIONS } from './rules';
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
    components: [
      movement.track({ id: 'ireland', spaces: VOYAGE_CONTENT.tiles.length }),
      diceKit({ id: 'main', count: 1, sides: 6 }),
      ...deckNames.map((id) =>
        cards.deck({ id, cards: VOYAGE_CONTENT[id], shuffle: true }),
      ),
    ],
    shortcuts: [
      { key: 'D', type: 'action', actionType: 'roll' },
      { key: 'P', type: 'interface', id: 'position' },
      { key: 'C', type: 'interface', id: 'cards' },
    ],
    setup: ({ players }) => ({
      collections: Object.fromEntries(
        players.map((player) => [player.id, emptyCollection()]),
      ),
      skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
      lastTargetByActor: {},
      lastRoll: null,
      finishCountdown: null,
      winnerId: null,
      pendingChoice: null,
    }),
    turn: clockwise(),
    actions: VOYAGE_ACTIONS,
    choices: {
      'voyage.choice': {
        resolve: ({ state, value, ctx }) =>
          resolveVoyageChoice(state, value, ctx),
      },
    },
    automatic: [
      when(
        'skip-voyage-player',
        ({ state, ctx }) =>
          (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
        ({ state, ctx }) => skipVoyagePlayer(state, ctx),
      ),
    ],
    victory: victoryWhen(({ state }) =>
      state.winnerId == null
        ? null
        : { winnerPlayerIds: [state.winnerId], reason: 'irish-collection' },
    ),
    view: ({ state, actor, ctx }) => {
      const positions = Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [
            player.id,
            ctx.movement.position('ireland', player.id),
          ]),
      );
      const deckCounts = Object.fromEntries(
        deckNames.map((id) => [
          id,
          ctx.cards.deckCount(id) + ctx.cards.discardCount(id),
        ]),
      ) as Record<VoyageCollectionKind, number>;
      const { pendingChoice: _pendingChoice, ...publicState } = state;
      return playerView({
        game: { ...structuredClone(publicState), positions, deckCounts },
        extras: {
          currentPlayerView: actor
            ? { id: actor.id, username: actor.username }
            : null,
          collections: structuredClone(state.collections),
          ui: {
            panels: [
              {
                title: 'Cartes',
                lines: ctx.players.all().map((player) => {
                  const collection = state.collections[player.id];
                  return `${player.username} : ${collectionTotal(collection)} carte(s)`;
                }),
              },
            ],
          },
        },
        board: { tiles: structuredClone(VOYAGE_CONTENT.tiles), positions },
      });
    },
    bot: { choose: () => ({ type: 'roll', payload: {} }) },
  },
);

function emptyCollection(): VoyageCollection {
  return { legend: 0, farce: 0, treasure: 0, landscape: 0 };
}

function collectionTotal(collection: VoyageCollection): number {
  return Object.values(collection).reduce((sum, count) => sum + count, 0);
}
