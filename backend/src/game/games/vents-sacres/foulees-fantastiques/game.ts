import {
  defineChoice,
  defineGame,
  gameInput,
  pawnRace,
  playerView,
} from '../../../core/application/public-api';
import { FOULEES_BOARD, FOULEES_FAMILIES, FOULEES_PAWNS } from './content';
import {
  FOULEES_ACTIONS,
  FOULEES_PHASES,
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
  patterns: [
    pawnRace({
      pawnSetId: 'foulees',
      pawns: FOULEES_PAWNS,
      perPlayer: 4,
      spaces: FOULEES_BOARD.trackLength + FOULEES_BOARD.homeLength,
      initialPosition: -1,
      homeStretchFrom: FOULEES_BOARD.trackLength,
    }),
  ],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    const state: FouleesState = {};
    const first = players[0];
    if (first) requestFamily(state, first.id, ctx);
    return state;
  },
  initialPhase: FOULEES_PHASES.initialPhase,
  phases: FOULEES_PHASES.phases,
  actions: FOULEES_ACTIONS,
  choices: {
    'foulees.family': defineChoice<FouleesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveFamilyChoice(state, value, actor.id, ctx),
    }),
    'foulees.move': defineChoice<FouleesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, value, ctx }) => resolvePawnChoice(state, value, ctx),
    }),
  },
  view: ({ actor, ctx }) => {
    const offsets = ctx.players.byId(
      (_player, index) =>
        [
          0,
          Math.floor(FOULEES_BOARD.trackLength / 2),
          Math.floor(FOULEES_BOARD.trackLength / 4),
          Math.floor((FOULEES_BOARD.trackLength * 3) / 4),
        ][index],
    );
    const colorsByPlayer = ctx.players.byId((_player, index) => COLORS[index]);
    const familyIdByPlayer = Object.fromEntries(
      ctx.players.all().flatMap((player) => {
        const pawnId = ctx.pawns.assigned('foulees', player.id)[0];
        return pawnId == null ? [] : [[player.id, pawnId.split(':')[0]]];
      }),
    );
    const pawnsByPlayer = ctx.players.byId((player) =>
      ctx.pawns.assigned('foulees', player.id).map((pawnId) => ({
        pawnIndex: Number(pawnId.split(':')[1]),
        progress: ctx.pawns.position('foulees', pawnId),
      })),
    );
    const positions = ctx.players.byId((player) => {
      const onTrack = pawnsByPlayer[player.id].filter(
        (pawn) =>
          pawn.progress >= 0 && pawn.progress < FOULEES_BOARD.trackLength,
      );
      const best = onTrack.length
        ? Math.max(...onTrack.map((pawn) => pawn.progress))
        : 0;
      return (offsets[player.id] + best) % FOULEES_BOARD.trackLength;
    });
    const arrival = FOULEES_BOARD.trackLength + FOULEES_BOARD.homeLength - 1;
    const arrived = ctx.players.byId(
      (player) =>
        pawnsByPlayer[player.id].filter((pawn) => pawn.progress >= arrival)
          .length,
    );
    const family = actor
      ? FOULEES_FAMILIES.find(
          (entry) => entry.id === familyIdByPlayer[actor.id],
        )
      : null;
    return playerView({
      game: {
        pawnsByPlayer,
        colorsByPlayer,
        familyIdByPlayer,
        offsets,
        trackLength: FOULEES_BOARD.trackLength,
        homeLength: FOULEES_BOARD.homeLength,
        safeTiles: [
          ...new Set([...FOULEES_BOARD.safeTiles, ...Object.values(offsets)]),
        ],
        arrived,
      },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        family,
        arrived,
      },
      board: { tiles: FOULEES_BOARD.tiles, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
