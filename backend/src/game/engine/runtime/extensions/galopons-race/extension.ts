import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonGaloponsRaceSchema,
  assertGaloponsRaceReferences,
} from '../../definitions/json-galopons-race-schema';
import { galoponsRaceRules } from './galopons-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'galoponsRace',
  outputKey: 'galoponsRace',
  schema: jsonGaloponsRaceSchema,
  compile: galoponsRaceRules,
  victoryKind: 'by-galopons-race',
  validate: (context, program) =>
    assertGaloponsRaceReferences(
      program,
      context.components,
      context.resources,
    ),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('galopons-race-roll'),
  }),
  actions: (compiled) => ({
    'galopons-race-roll': compiled.roll,
  }),
});
