import {
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  gridGame,
  pawns,
  sequentialPawnSelection,
} from '../../../engine/sdk/public-api';
import { MORPION_PAWNS } from './content';
import { chooseBotMove, MARK_PLACED, MORPION_ACTIONS } from './rules';
import type { NoGameState as MorpionState } from '../../../engine/sdk/public-api';

const PAWN_CHOICE = 'morpion.pawn';
const pawnSelection = sequentialPawnSelection<MorpionState>({
  setId: 'morpion',
  choiceId: PAWN_CHOICE,
  complete: ({ ctx }) => {
    const starterId = ctx.round.starter();
    if (starterId != null) ctx.turn.to(starterId);
  },
});

export default defineGame<MorpionState>()({
  id: 'morpion',
  displayName: 'Morpion',
  category: 'JeuxDePlateaux',
  subcategory: 'Les Vents Sacrés',
  description: 'Alignez 3 symboles sur une grille 3×3.',
  players: { min: 2, max: 2 },
  events: [MARK_PLACED],
  content: defineGameContent('morpion', { pawns: MORPION_PAWNS }),
  patterns: [
    gridGame({
      boardId: 'morpion',
      width: 3,
      height: 3,
      winLength: 3,
      drawWhenFull: true,
      winnerReason: 'line-3',
      drawReason: 'draw',
    }),
  ],
  components: [pawns.set({ id: 'morpion', pawns: MORPION_PAWNS })],
  initialization: { firstPlayer: 'first', startRound: true },
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'A', type: 'interface', id: 'play' },
  ],
  setup: ({ players, ctx }) => {
    pawnSelection.requestAll(
      ctx.random.shuffle(players.map((player) => player.id)),
      ctx,
    );
    return {};
  },
  actions: MORPION_ACTIONS,
  choices: {
    [PAWN_CHOICE]: defineChoice<MorpionState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) =>
        pawnSelection.resolve(actor.id, value, ctx),
    }),
  },
  bot: {
    choose: ({ state: _state, actor, ctx }) => {
      const opponentId =
        ctx.players.all().find((player) => player.id !== actor.id)?.id ?? null;
      const move = chooseBotMove(ctx, actor.id, opponentId);
      return move ? { type: 'morpion_play', payload: move } : null;
    },
  },
});
