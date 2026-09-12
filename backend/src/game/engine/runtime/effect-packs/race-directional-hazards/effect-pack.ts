import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonDirectionalHazardRaceSchema,
  assertDirectionalHazardRaceReferences,
} from '../../definitions/json-directional-hazard-race-schema';
import { directionalHazardRaceRules } from './directional-hazard-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'directionalHazardRace',
  outputKey: 'directionalHazardRace',
  schema: jsonDirectionalHazardRaceSchema,
  compile: directionalHazardRaceRules,
  victoryKind: 'by-directional-hazard-race',
  validate: (context, program) =>
    assertDirectionalHazardRaceReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    ),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('race-hazard-roll'),
  }),
  actions: (compiled) => ({
    'race-hazard-roll': compiled.roll,
  }),
});
