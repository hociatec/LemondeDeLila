import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonMidnightRaceSchema,
  assertMidnightRaceReferences,
} from '../../definitions/json-midnight-race-schema';
import { midnightRaceRules } from './midnight-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'midnightRace',
  outputKey: 'midnightRace',
  schema: jsonMidnightRaceSchema,
  compile: midnightRaceRules,
  victoryKind: 'by-midnight-race',
  validate: (context, program) =>
    assertMidnightRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    playerValuesVisibility: context.publicStatuses(),
    bot: context.recipeBot('midnight-race-roll'),
  }),
  actions: (compiled) => ({
    'midnight-race-roll': compiled.roll,
  }),
});
