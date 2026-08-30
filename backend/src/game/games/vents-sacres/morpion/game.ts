import {
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  gridGame,
  pawns,
} from '../../../engine/sdk/public-api';
import { MORPION_PAWNS } from './content';
import { chooseBotMove, MARK_PLACED, MORPION_ACTIONS } from './rules';
import type { NoGameState as MorpionState } from '../../../engine/sdk/public-api';

const PAWN_CHOICE = 'morpion.pawn';

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
    const availablePawns = ctx.random.shuffle(
      MORPION_PAWNS.map((pawn) => pawn.id),
    );
    for (const bot of players.filter((player) => player.isBot)) {
      const pawnId = availablePawns.shift();
      if (pawnId) ctx.pawns.assign('morpion', bot.id, pawnId);
    }
    const chooser = ctx.random.pick(players.filter((player) => !player.isBot));
    if (chooser) {
      ctx.turn.to(chooser.id);
      ctx.choice.one({
        id: PAWN_CHOICE,
        player: chooser.id,
        options: availablePawns,
      });
    }
    return {};
  },
  actions: MORPION_ACTIONS,
  choices: {
    [PAWN_CHOICE]: defineChoice<MorpionState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => {
        const pawnId = value;
        ctx.pawns.assign('morpion', actor.id, pawnId);
        ctx.events.message('game.pawn.selected', {
          playerId: actor.id,
          pawnId,
        });
        const next = ctx.players
          .all()
          .find(
            (player) => ctx.pawns.assigned('morpion', player.id).length === 0,
          );
        if (next) {
          ctx.turn.to(next.id);
          ctx.choice.one({
            id: PAWN_CHOICE,
            player: next.id,
            options: ctx.pawns.available('morpion').map((pawn) => pawn.id),
          });
        } else {
          const starterId = ctx.round.starter();
          if (starterId != null) ctx.turn.to(starterId);
        }
      },
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
