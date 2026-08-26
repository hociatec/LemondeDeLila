import {
  clockwise,
  defineChoice,
  defineGame,
  gameInput,
  grid,
  pawns,
  playerView,
} from '../../../core/application/public-api';
import { MORPION_PAWNS } from './content';
import { boardState, chooseBotMove, MORPION_ACTIONS } from './rules';
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
  components: [
    grid.board({ id: 'morpion', width: 3, height: 3 }),
    pawns.set({ id: 'morpion', pawns: MORPION_PAWNS }),
  ],
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
  turn: clockwise(),
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
          .find((player) => ctx.pawns.assigned('morpion', player.id).length === 0);
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
  view: ({ actor, ctx }) => {
    const players = ctx.players.all();
    const glyphByPlayerId = Object.fromEntries(
      players.flatMap((player) => {
        const pawnId = ctx.pawns.assigned('morpion', player.id)[0];
        return pawnId == null ? [] : [[String(player.id), pawnId]];
      }),
    );
    const board = boardState(ctx);
    const canPlay =
      actor != null && ctx.turn.is(actor.id) && !ctx.choice.current();
    const cellActions = Object.fromEntries(
      board.flatMap((ownerId, index) => {
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
    const entities = board.flatMap((ownerId, index) => {
      if (ownerId === 0) return [];
      const pawnId = glyphByPlayerId[String(ownerId)];
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
    const result = ctx.match.result();
    const winnerId = result?.winnerPlayerIds[0] ?? null;
    const draw = result?.reason === 'draw';
    const winner = players.find((player) => player.id === winnerId);
    const statusLines = [
      winner
        ? `Gagnant : ${winner.username}`
        : draw
          ? 'Match nul.'
          : canPlay
            ? 'À vous de jouer.'
            : 'Tour de l’adversaire.',
    ];
    return playerView({
      game: {
        glyphByPlayerId,
        size: 3,
        board,
        startingPlayerId: ctx.round.starter() ?? 0,
        winnerId,
        draw,
        pawns: structuredClone(MORPION_PAWNS),
      },
      extras: {
        grid: { kind: 'grid', size: 3, entities, cellActions, statusLines },
        ui: {
          panels: {
            play: {
              title: 'Coups',
              message: `Cases libres: ${board.filter((owner) => owner === 0).length}. Entrée: jouer sur la case focus.`,
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
      const move = chooseBotMove(ctx, actor.id, opponentId);
      return move ? { type: 'morpion_play', payload: move } : null;
    },
  },
});
