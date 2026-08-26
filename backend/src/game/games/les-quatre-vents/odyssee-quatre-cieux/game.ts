import {
  clockwise,
  defineGame,
  diceKit,
  playerView,
  victoryWhen,
} from '../../../core/application/public-api';
import { ODYSSEE_CONTENT } from './content';
import { applyMove, endMove, ODYSSEE_ACTIONS, type OdysseeMove } from './rules';
import type { OdysseePlayerView, OdysseeState } from './state';

export default defineGame<
  OdysseeState,
  typeof ODYSSEE_ACTIONS,
  OdysseePlayerView
>({
  id: 'odyssee-quatre-cieux',
  displayName: 'L’Odyssée des Quatre Cieux',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course galactique de pions.',
  players: { min: 2, max: 4 },
  components: [diceKit({ id: 'main', count: 1, sides: 6 })],
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'E', type: 'interface', id: 'stable' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  setup: ({ players }) => ({
    trackLength: ODYSSEE_CONTENT.trackLength,
    homeLength: ODYSSEE_CONTENT.homeLength,
    offsets: Object.fromEntries(
      players.map((player, index) => [
        player.id,
        (index * 14) % ODYSSEE_CONTENT.trackLength,
      ]),
    ),
    pawnsByPlayer: Object.fromEntries(
      players.map((player) => [
        player.id,
        Array.from(
          { length: ODYSSEE_CONTENT.pawnsPerPlayer },
          (_, pawnIndex) => ({
            pawnIndex,
            progress: -1,
          }),
        ),
      ]),
    ),
    lastRoll: null,
    winnerId: null,
  }),
  turn: clockwise(),
  actions: ODYSSEE_ACTIONS,
  choices: {
    'odyssee.move': {
      resolve: ({ state, actor, value, ctx }) => {
        const move = value as OdysseeMove;
        applyMove(state, actor.id, move, ctx.history.add);
        endMove(ctx, move.roll);
      },
    },
  },
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'all-pawns-arrived' },
  ),
  view: ({ state, actor, ctx }) => {
    const players = ctx.players.all();
    const arrival = state.trackLength + state.homeLength - 1;
    const myPawns = actor ? (state.pawnsByPlayer[actor.id] ?? []) : [];
    const stableLines = [
      `Base: ${myPawns.filter((pawn) => pawn.progress < 0).length}/4.`,
      `Hangar: ${myPawns.filter((pawn) => pawn.progress >= state.trackLength && pawn.progress < arrival).length}/4.`,
      `Arrivée: ${myPawns.filter((pawn) => pawn.progress >= arrival).length}/4.`,
    ];
    const scoreLines = players.map((player) => {
      const finished = (state.pawnsByPlayer[player.id] ?? []).filter(
        (pawn) => pawn.progress >= arrival,
      ).length;
      return `${player.username} : ${finished} arrivée${finished > 1 ? 's' : ''}`;
    });
    return playerView({
      game: structuredClone(state),
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        ui: {
          panels: {
            stable: { title: 'État', message: stableLines.join(' ') },
            score: { title: 'Scores', message: scoreLines.join('\n') },
          },
        },
      },
      board: {
        trackLength: state.trackLength,
        homeLength: state.homeLength,
        offsets: structuredClone(state.offsets),
        pawnsByPlayer: structuredClone(state.pawnsByPlayer),
      },
    });
  },
  bot: {
    choose: () => ({ type: 'roll', payload: {} }),
  },
});
