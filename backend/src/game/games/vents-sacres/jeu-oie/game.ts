import {
  defineChoice,
  defineGame,
  gameInput,
  pawns,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { GOOSE_PAWNS, GOOSE_TILES } from './content';
import {
  assignPawn,
  GOOSE_IN_WELL,
  initializeGoose,
  JEU_OIE_ACTIONS,
  JEU_OIE_PHASES,
} from './rules';
import type { JeuOiePlayerView, JeuOieState } from './state';

export default defineGame<
  JeuOieState,
  typeof JEU_OIE_ACTIONS,
  JeuOiePlayerView
>({
  id: 'jeu-oie',
  displayName: 'Jeu de l’oie',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: 'Course classique sur 63 cases et ses pièges.',
  players: { min: 2, max: 6 },
  patterns: [
    raceGame({
      trackId: 'goose-board',
      spaces: GOOSE_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [pawns.set({ id: 'goose', pawns: GOOSE_PAWNS })],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: ({ players, ctx }) => {
    const selectionOrder = ctx.random.shuffle(
      players.map((player) => player.id),
    );
    ctx.round.start(selectionOrder[0], selectionOrder);
    ctx.turn.to(selectionOrder[0]);
    initializeGoose(selectionOrder, ctx);
    return {};
  },
  initialPhase: JEU_OIE_PHASES.initialPhase,
  phases: JEU_OIE_PHASES.phases,
  actions: JEU_OIE_ACTIONS,
  choices: {
    'goose.pawn': defineChoice<JeuOieState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => assignPawn(actor.id, value, ctx),
    }),
  },
  view: ({ state: _state, actor, ctx }) => {
    const pawnByPlayerId = Object.fromEntries(
      ctx.players.all().flatMap((player) => {
        const pawnId = ctx.pawns.assigned('goose', player.id)[0];
        return pawnId == null ? [] : [[player.id, pawnId]];
      }),
    );
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('goose-board', player.id),
    );
    return playerView({
      game: {
        inWell: ctx.players.byId((player) =>
          ctx.status.has(player.id, GOOSE_IN_WELL),
        ),
        pawnByPlayerId,
      },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        pawns: GOOSE_PAWNS,
        pawnByPlayerId,
      },
      board: { tiles: GOOSE_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
