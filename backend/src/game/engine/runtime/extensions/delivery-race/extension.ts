import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonDeliveryRaceSchema,
  assertDeliveryRaceReferences,
} from '../../definitions/json-delivery-race-schema';
import { deliveryRaceRules } from './delivery-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'deliveryRace',
  outputKey: 'deliveryRace',
  schema: jsonDeliveryRaceSchema,
  compile: deliveryRaceRules,
  victoryKind: 'by-delivery-race',
  victoryLabel: 'delivery race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail(
        'patterns',
        'delivery race requires its declared race track',
      );
    assertDeliveryRaceReferences(program, context.components);
  },
  handlers: (context) => ({
    bot: context.recipeBot('delivery-race-roll'),
  }),
  actions: (compiled) => ({
    'delivery-race-roll': compiled.roll,
  }),
});
