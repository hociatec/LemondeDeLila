import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonDeliveryRaceSchema,
  assertDeliveryRaceReferences,
} from '../../definitions/json-delivery-race-schema';
import { deliveryRaceRules } from './delivery-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
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
    bot: context.recipeBot('race-route-delivery-roll'),
  }),
  actions: (compiled) => ({
    'race-route-delivery-roll': compiled.roll,
  }),
});
