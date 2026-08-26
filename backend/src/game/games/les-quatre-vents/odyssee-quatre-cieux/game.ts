import {
  defineChoice,
  defineGame,
  gameInput,
  pawnRace,
  playerView,
} from '../../../core/application/public-api';
import { ODYSSEE_CONTENT } from './content';
import { applyMove, endMove, ODYSSEE_ACTIONS, type OdysseeMove } from './rules';
import type { OdysseePlayerView, OdysseeState } from './state';

const ODYSSEE_PAWNS = Array.from({ length: 4 }, (_seat, seatIndex) =>
  ODYSSEE_CONTENT.pawnNames.map((label, pawnIndex) => ({
    id: `${seatIndex}:${pawnIndex}`,
    label,
  })),
).flat();

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
  patterns: [
    pawnRace({
      pawnSetId: 'odyssee',
      pawns: ODYSSEE_PAWNS,
      perPlayer: ODYSSEE_CONTENT.pawnsPerPlayer,
      spaces: ODYSSEE_CONTENT.trackLength + ODYSSEE_CONTENT.homeLength,
      initialPosition: -1,
    }),
  ],
  initialization: {
    pawns: [{ setId: 'odyssee', assignment: 'grouped' }],
    startRound: false,
  },
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'E', type: 'interface', id: 'stable' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  setup: () => ({}),
  actions: ODYSSEE_ACTIONS,
  choices: {
    'odyssee.move': defineChoice<OdysseeState, OdysseeMove>({
      input: gameInput.object({
        pawnIndex: gameInput.number({ integer: true, min: 0 }),
        targetProgress: gameInput.number({ integer: true }),
        roll: gameInput.number({ integer: true, min: 1 }),
      }),
      resolve: ({ state, actor, value, ctx }) => {
        applyMove(state, actor.id, value, ctx);
        if (ctx.match.lifecycle() !== 'finished') endMove(ctx, value.roll);
      },
    }),
  },
  view: ({ actor, ctx }) => {
    const players = ctx.players.all();
    const offsets = Object.fromEntries(
      players.map((player, index) => [
        player.id,
        (index * 14) % ODYSSEE_CONTENT.trackLength,
      ]),
    );
    const pawnsByPlayer = Object.fromEntries(
      players.map((player) => [
        player.id,
        ctx.pawns.assigned('odyssee', player.id).map((pawnId) => ({
          pawnIndex: Number(pawnId.split(':')[1]),
          progress: ctx.pawns.position('odyssee', pawnId),
        })),
      ]),
    );
    const arrival = ODYSSEE_CONTENT.trackLength + ODYSSEE_CONTENT.homeLength - 1;
    const myPawns = actor ? (pawnsByPlayer[actor.id] ?? []) : [];
    const stableLines = [
      `Base: ${myPawns.filter((pawn) => pawn.progress < 0).length}/4.`,
      `Hangar: ${myPawns.filter((pawn) => pawn.progress >= ODYSSEE_CONTENT.trackLength && pawn.progress < arrival).length}/4.`,
      `Arrivée: ${myPawns.filter((pawn) => pawn.progress >= arrival).length}/4.`,
    ];
    const scoreLines = players.map((player) => {
      const finished = (pawnsByPlayer[player.id] ?? []).filter(
        (pawn) => pawn.progress >= arrival,
      ).length;
      return `${player.username} : ${finished} arrivée${finished > 1 ? 's' : ''}`;
    });
    return playerView({
      game: {
        offsets,
        pawnsByPlayer,
        trackLength: ODYSSEE_CONTENT.trackLength,
        homeLength: ODYSSEE_CONTENT.homeLength,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        lastRoll: ctx.dice.last('main')?.total ?? null,
      },
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
        trackLength: ODYSSEE_CONTENT.trackLength,
        homeLength: ODYSSEE_CONTENT.homeLength,
        offsets,
        pawnsByPlayer,
      },
    });
  },
  bot: {
    choose: () => ({ type: 'roll', payload: {} }),
  },
});
