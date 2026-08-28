import {
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  pawnRace,
} from '../../../core/application/public-api';
import { ODYSSEE_CONTENT } from './content';
import {
  endMove,
  moveOdysseePawn,
  ODYSSEE_ACTIONS,
  type OdysseeMove,
} from './rules';
import type { OdysseeState } from './state';

const ODYSSEE_PAWNS = Array.from({ length: 4 }, (_seat, seatIndex) =>
  ODYSSEE_CONTENT.pawnNames.map((label, pawnIndex) => ({
    id: `${seatIndex}:${pawnIndex}`,
    label,
  })),
).flat();

export default defineGame<OdysseeState, typeof ODYSSEE_ACTIONS>({
  id: 'odyssee-quatre-cieux',
  displayName: 'L’Odyssée des Quatre Cieux',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course galactique de pions.',
  players: { min: 2, max: 4 },
  content: defineGameContent('odyssee-quatre-cieux', ODYSSEE_CONTENT),
  patterns: [
    pawnRace({
      pawnSetId: 'odyssee',
      pawns: ODYSSEE_PAWNS,
      perPlayer: ODYSSEE_CONTENT.pawnsPerPlayer,
      spaces: ODYSSEE_CONTENT.trackLength + ODYSSEE_CONTENT.homeLength,
      initialPosition: -1,
      entryRoll: 6,
      entryPosition: 0,
      exactFinish: true,
      homeStretchFrom: ODYSSEE_CONTENT.trackLength,
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
        pawnId: gameInput.string({ min: 1, max: 128 }),
        from: gameInput.number({ integer: true }),
        to: gameInput.number({ integer: true }),
        distance: gameInput.number({ integer: true }),
        roll: gameInput.number({ integer: true, min: 1 }),
      }),
      resolve: ({ state, actor, value, ctx }) => {
        moveOdysseePawn(state, actor.id, value, ctx);
        if (ctx.match.lifecycle() !== 'finished') endMove(ctx, value.roll);
      },
    }),
  },
  bot: {
    choose: () => ({ type: 'roll', payload: {} }),
  },
});
