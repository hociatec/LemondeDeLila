import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonDerapeRaceSchema,
  assertDerapeRaceReferences,
} from '../../definitions/json-derape-race-schema';
import { derapeRaceRules } from './derape-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'derapeRace',
  outputKey: 'derapeRace',
  schema: jsonDerapeRaceSchema,
  compile: derapeRaceRules,
  victoryKind: 'by-derape-race',
  validate: (context, program) =>
    assertDerapeRaceReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    ),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('derape-race-roll'),
  }),
  actions: (compiled) => ({
    'derape-race-roll': compiled.roll,
  }),
});
