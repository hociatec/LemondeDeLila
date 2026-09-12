import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonFouleesRaceSchema,
  assertFouleesRaceReferences,
} from '../../definitions/json-foulees-race-schema';
import { fouleesRaceRules } from './foulees-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'fouleesRace',
  outputKey: 'fouleesRace',
  schema: jsonFouleesRaceSchema,
  compile: fouleesRaceRules,
  victoryKind: 'by-foulees-race',
  validate: (context, program) =>
    assertFouleesRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    bot: context.recipeBot('foulees-race-roll'),
  }),
  actions: (compiled) => ({
    'foulees-race-roll': compiled.roll,
  }),
});
