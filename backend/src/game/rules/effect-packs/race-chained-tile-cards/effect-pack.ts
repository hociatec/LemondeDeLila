import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonChainedTileRaceSchema,
  assertChainedTileRaceReferences,
} from '../../schemas/json-chained-tile-race-schema';
import { chainedTileRaceRules } from './chained-tile-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'chainedTileRace',
  outputKey: 'chainedTileRace',
  schema: jsonChainedTileRaceSchema,
  compile: chainedTileRaceRules,
  validate: (context, program) =>
    assertChainedTileRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    playerValuesVisibility: context.publicStatuses(),
    bot: context.recipeBot([
      'race-chained-tile-cards-draw',
      'race-chained-tile-cards-roll',
    ]),
  }),
  actions: (compiled) => ({
    'race-chained-tile-cards-roll': compiled.roll,
    'race-chained-tile-cards-draw': compiled.draw,
  }),
});
