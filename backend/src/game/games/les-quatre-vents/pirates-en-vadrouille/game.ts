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
import { PIRATES_CONTENT } from './content';
import {
  PIRATES_ACTIONS,
  resolveTargetChoice,
  skipPenalizedPlayer,
} from './rules';
import type {
  PirateCollection,
  PiratesPlayerView,
  PiratesState,
} from './state';

const track = movement.track({
  id: 'island',
  spaces: PIRATES_CONTENT.tiles.length,
});
const cardDecks = (['treasure', 'obstacle', 'bonus'] as const).map((id) =>
  cards.deck({ id, cards: PIRATES_CONTENT[id], shuffle: true }),
);

export default defineGame<
  PiratesState,
  typeof PIRATES_ACTIONS,
  PiratesPlayerView
>({
  id: 'pirates-en-vadrouille',
  displayName: 'Pirates en vadrouille !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Explorez Papayousse et ouvrez son coffre légendaire.',
  players: { min: 2, max: 6 },
  components: [
    track,
    diceKit({ id: 'main', count: 1, sides: 6 }),
    ...cardDecks,
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  setup: ({ players }) => ({
    collections: Object.fromEntries(
      players.map((player) => [player.id, emptyCollection()]),
    ),
    skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
    obstacleImmunity: Object.fromEntries(
      players.map((player) => [player.id, 0]),
    ),
    lastRoll: null,
    winnerId: null,
    pendingEffect: null,
  }),
  turn: clockwise(),
  actions: PIRATES_ACTIONS,
  choices: {
    'pirates.target': {
      resolve: ({ state, value, ctx }) =>
        resolveTargetChoice(state, Number(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-penalized-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipPenalizedPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'legendary-chest' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('island', player.id),
        ]),
    );
    const deckCounts = Object.fromEntries(
      (['treasure', 'obstacle', 'bonus'] as const).map((id) => [
        id,
        ctx.cards.deckCount(id) + ctx.cards.discardCount(id),
      ]),
    ) as Record<'treasure' | 'obstacle' | 'bonus', number>;
    const { pendingEffect: _pendingEffect, ...publicGame } = state;
    return playerView({
      game: { ...structuredClone(publicGame), positions, deckCounts },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        collections: structuredClone(state.collections),
        statuses: {
          skipTurn: structuredClone(state.skipTurns),
          obstacleImmunity: structuredClone(state.obstacleImmunity),
        },
        ui: {
          panels: [
            {
              title: 'Butins',
              lines: ctx.players.all().map((player) => {
                const collection = state.collections[player.id];
                return `${player.username} : ${collection.treasures.length} trésor(s), ${collection.goldPieces} pièce(s)`;
              }),
            },
          ],
        },
      },
      board: { tiles: structuredClone(PIRATES_CONTENT.tiles), positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});

function emptyCollection(): PirateCollection {
  return { treasures: [], obstacles: [], bonus: [], goldPieces: 0 };
}
