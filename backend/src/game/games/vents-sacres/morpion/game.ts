import {
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
} from '../../../core/application/public-api';
import { MORPION_PAWNS } from './content';
import { chooseBotMove, MORPION_ACTIONS } from './rules';
import type { MorpionPlayerView, MorpionState } from './state';

const PAWN_CHOICE = 'morpion.pawn';

export default defineGame<
  MorpionState,
  typeof MORPION_ACTIONS,
  MorpionPlayerView
>({
  id: 'morpion',
  displayName: 'Morpion',
  category: 'JeuxDePlateaux',
  subcategory: 'Les Vents Sacrés',
  description: 'Alignez 3 symboles sur une grille 3×3.',
  players: { min: 2, max: 2 },
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'A', type: 'interface', id: 'play' },
  ],
  setup: ({ players, ctx }) => {
    const availablePawns = ctx.random.shuffle(
      MORPION_PAWNS.map((pawn) => pawn.id),
    );
    const glyphByPlayerId: Record<string, string> = {};
    for (const bot of players.filter((player) => player.isBot)) {
      const pawnId = availablePawns.shift();
      if (pawnId) glyphByPlayerId[String(bot.id)] = pawnId;
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
    return {
      size: 3,
      board: Array.from({ length: 9 }, () => 0),
      glyphByPlayerId,
      startingPlayerId: players[0]?.id ?? 0,
      winnerId: null,
      draw: false,
    };
  },
  turn: clockwise(),
  actions: MORPION_ACTIONS,
  choices: {
    [PAWN_CHOICE]: {
      resolve: ({ state, actor, value, ctx }) => {
        const pawnId = String(value);
        state.glyphByPlayerId[String(actor.id)] = pawnId;
        const pawn = MORPION_PAWNS.find((candidate) => candidate.id === pawnId);
        ctx.history.add(
          `${actor.username} a choisi le pion: ${pawn?.label ?? pawnId}.`,
        );
        const next = ctx.players
          .all()
          .find((player) => !state.glyphByPlayerId[String(player.id)]);
        if (next) {
          ctx.turn.to(next.id);
          ctx.choice.one({
            id: PAWN_CHOICE,
            player: next.id,
            options: MORPION_PAWNS.map((candidate) => candidate.id).filter(
              (id) => !Object.values(state.glyphByPlayerId).includes(id),
            ),
          });
        } else {
          ctx.turn.to(state.startingPlayerId);
        }
      },
    },
  },
  victory: victoryWhen(({ state }) =>
    state.winnerId != null || state.draw
      ? {
          winnerPlayerIds: state.winnerId == null ? [] : [state.winnerId],
          reason: state.draw ? 'draw' : 'line-3',
        }
      : null,
  ),
  view: ({ state, actor, ctx }) => {
    const players = ctx.players.all();
    const canPlay =
      actor != null && ctx.turn.is(actor.id) && !ctx.choice.current();
    const cellActions = Object.fromEntries(
      state.board.flatMap((ownerId, index) => {
        if (ownerId !== 0 || !canPlay) return [];
        const x = index % 3;
        const y = Math.floor(index / 3);
        return [
          [
            `${x},${y}`,
            [{ type: 'morpion_play', label: 'Jouer ici', payload: { x, y } }],
          ],
        ];
      }),
    );
    const entities = state.board.flatMap((ownerId, index) => {
      if (ownerId === 0) return [];
      const pawnId = state.glyphByPlayerId[String(ownerId)];
      return [
        {
          id: `mark:${index}`,
          type: 'mark',
          ownerId,
          x: index % 3,
          y: Math.floor(index / 3),
          glyph: MORPION_PAWNS.find((pawn) => pawn.id === pawnId)?.glyph ?? '@',
        },
      ];
    });
    const winner = players.find((player) => player.id === state.winnerId);
    const statusLines = [
      winner
        ? `Gagnant : ${winner.username}`
        : state.draw
          ? 'Match nul.'
          : canPlay
            ? 'À vous de jouer.'
            : 'Tour de l’adversaire.',
    ];
    return playerView({
      game: {
        ...structuredClone(state),
        pawns: structuredClone(MORPION_PAWNS),
      },
      extras: {
        grid: { kind: 'grid', size: 3, entities, cellActions, statusLines },
        ui: {
          panels: {
            play: {
              title: 'Coups',
              message: `Cases libres: ${state.board.filter((owner) => owner === 0).length}. Entrée: jouer sur la case focus.`,
            },
          },
        },
      },
      board: {
        tiles: Array.from({ length: 9 }, (_, index) => ({
          x: index % 3,
          y: Math.floor(index / 3),
        })),
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const opponentId =
        ctx.players.all().find((player) => player.id !== actor.id)?.id ?? null;
      const move = chooseBotMove(state, actor.id, opponentId);
      return move ? { type: 'morpion_play', payload: move } : null;
    },
  },
});
