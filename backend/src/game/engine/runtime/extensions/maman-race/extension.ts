import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonMamanRaceSchema,
  assertMamanRaceReferences,
} from '../../definitions/json-maman-race-schema';
import { mamanRaceRules } from './maman-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'mamanRace',
  outputKey: 'mamanRace',
  schema: jsonMamanRaceSchema,
  compile: mamanRaceRules,
  victoryKind: 'by-maman-race',
  validate: (context, program) =>
    assertMamanRaceReferences(program, context.components, context.resources),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: context.recipeBot('maman-race-roll'),
  }),
  actions: (compiled) => ({
    'maman-race-roll': compiled.roll,
  }),
});
