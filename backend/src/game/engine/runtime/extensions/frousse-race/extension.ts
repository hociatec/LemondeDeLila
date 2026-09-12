import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonFrousseRaceSchema,
  assertFrousseRaceReferences,
} from '../../definitions/json-frousse-race-schema';
import { frousseRaceRules } from './frousse-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'frousseRace',
  outputKey: 'frousseRace',
  schema: jsonFrousseRaceSchema,
  compile: frousseRaceRules,
  victoryKind: 'by-frousse-race',
  validate: (context, program) =>
    assertFrousseRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    playerValuesVisibility: context.publicStatuses(),
    bot: context.recipeBot('frousse-race-roll'),
  }),
  actions: (compiled) => ({
    'frousse-race-roll': compiled.roll,
  }),
});
