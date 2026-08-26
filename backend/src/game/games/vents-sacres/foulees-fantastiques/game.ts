import {
  defineGame,
  diceKit,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import { FOULEES_BOARD, FOULEES_FAMILIES } from './content';
import {
  FOULEES_ACTIONS,
  requestFamily,
  resolveFamilyChoice,
  resolvePawnChoice,
} from './rules';
import type { FouleesColor, FouleesPlayerView, FouleesState } from './state';

const COLORS: FouleesColor[] = ['Rouge', 'Bleu', 'Vert', 'Jaune'];

export default defineGame<
  FouleesState,
  typeof FOULEES_ACTIONS,
  FouleesPlayerView
>({
  id: 'foulees-fantastiques',
  displayName: 'Foulées Fantastiques !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: 'Une course de quatre familles animales vers leur abri.',
  players: { min: 2, max: 4 },
  components: [diceKit({ id: 'main', count: 1, sides: 6 })],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    const offsets = [
      0,
      Math.floor(FOULEES_BOARD.trackLength / 2),
      Math.floor(FOULEES_BOARD.trackLength / 4),
      Math.floor((FOULEES_BOARD.trackLength * 3) / 4),
    ];
    const state: FouleesState = {
      trackLength: FOULEES_BOARD.trackLength,
      homeLength: FOULEES_BOARD.homeLength,
      pawnsByPlayer: Object.fromEntries(
        players.map((player) => [
          player.id,
          Array.from({ length: 4 }, (_entry, pawnIndex) => ({
            pawnIndex,
            progress: -1,
          })),
        ]),
      ),
      colorsByPlayer: Object.fromEntries(
        players.map((player, index) => [player.id, COLORS[index]]),
      ),
      familyIdByPlayer: {},
      offsets: Object.fromEntries(
        players.map((player, index) => [player.id, offsets[index]]),
      ),
      safeTiles: [...new Set([...FOULEES_BOARD.safeTiles, ...offsets])],
      setupComplete: false,
      lastRoll: null,
      winnerId: null,
      pendingMove: null,
    };
    const first = players[0];
    if (first) requestFamily(state, first.id, ctx);
    return state;
  },
  turn: standardTurn(),
  initialPhase: 'setup',
  actions: FOULEES_ACTIONS,
  choices: {
    'foulees.family': {
      resolve: ({ state, actor, value, ctx }) =>
        resolveFamilyChoice(state, String(value), actor.id, ctx),
    },
    'foulees.move': {
      resolve: ({ state, value, ctx }) =>
        resolvePawnChoice(state, String(value), ctx),
    },
  },
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'four-pawns-home' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players.all().map((player) => {
        const onTrack = state.pawnsByPlayer[player.id].filter(
          (pawn) => pawn.progress >= 0 && pawn.progress < state.trackLength,
        );
        const best = onTrack.length
          ? Math.max(...onTrack.map((pawn) => pawn.progress))
          : 0;
        return [
          player.id,
          (state.offsets[player.id] + best) % state.trackLength,
        ];
      }),
    );
    const arrival = state.trackLength + state.homeLength - 1;
    const arrived = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          state.pawnsByPlayer[player.id].filter(
            (pawn) => pawn.progress >= arrival,
          ).length,
        ]),
    );
    const { pendingMove: _pendingMove, ...publicState } = state;
    const family = actor
      ? FOULEES_FAMILIES.find(
          (entry) => entry.id === state.familyIdByPlayer[actor.id],
        )
      : null;
    return playerView({
      game: { ...structuredClone(publicState), positions, arrived },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        family,
        arrived,
      },
      board: { tiles: structuredClone(FOULEES_BOARD.tiles), positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
