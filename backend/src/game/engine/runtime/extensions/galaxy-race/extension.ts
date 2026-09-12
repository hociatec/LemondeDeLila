import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonGalaxyRaceSchema,
  assertGalaxyRaceReferences,
} from '../../definitions/json-galaxy-race-schema';
import { galaxyRaceRules } from './galaxy-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'galaxyRace',
  outputKey: 'galaxyRace',
  schema: jsonGalaxyRaceSchema,
  compile: galaxyRaceRules,
  victoryKind: 'by-galaxy-race',
  validate: (context, program) =>
    assertGalaxyRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('galaxy-race-roll'),
  }),
  actions: (compiled) => ({
    'galaxy-race-roll': compiled.roll,
  }),
});
