import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { when } from '../../../engine/sdk/public-api';
import { PIMP_MY_RIDE_CAR_NAMES } from './content';
import { currentCarParts, drawCarPart } from './rules';
import type { CarProgress, PimpMyRideState } from './state';
export type CompletedCarView = {
  name: string;
  description: string;
  parts: string[];
};
export type PimpMyRidePlayerView = {
  progress: Record<
    number,
    Omit<CarProgress, 'completedCars'> & { completedCars: CompletedCarView[] }
  >;
};
export const GAME_RULES = {
  automatic: [
    when(
      'draw-car-part',
      ({ ctx }) =>
        ctx.effects.sourcePlayerId() !== (ctx.players.current()?.id ?? null),
      ({ state, ctx }) => drawCarPart(state, ctx),
    ),
  ],
  viewExtension: ({ state, ctx }): PimpMyRidePlayerView => {
    const progress = ctx.players.byId((player) => {
      const carParts = currentCarParts(player.id, ctx);
      return {
        stageIndex: carParts.length,
        carParts,
        completedCars: state.completedCars[player.id].map((completed) => {
          const definition = PIMP_MY_RIDE_CAR_NAMES[completed.nameIndex];
          return {
            name: definition?.name ?? '',
            description: definition?.description ?? '',
            parts: [...completed.parts],
          };
        }),
      };
    });
    return { progress };
  },
} satisfies GameRuleBindings<PimpMyRideState, PimpMyRidePlayerView>;
