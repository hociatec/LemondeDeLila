import {
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  pawns,
  publicField,
  raceGame,
} from '../../../core/application/public-api';
import { GOOSE_PAWNS, GOOSE_TILES } from './content';
import {
  assignPawn,
  initializeGoose,
  JEU_OIE_ACTIONS,
  JEU_OIE_PHASES,
} from './rules';
import type { JeuOieState } from './state';

export default defineGame<JeuOieState, typeof JEU_OIE_ACTIONS>({
  id: 'jeu-oie',
  displayName: 'Jeu de l’oie',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: 'Course classique sur 63 cases et ses pièges.',
  players: { min: 2, max: 6 },
  content: defineGameContent('jeu-oie', {
    tiles: GOOSE_TILES,
    pawns: GOOSE_PAWNS,
  }),
  playerValuesVisibility: { statuses: publicField() },
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
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
