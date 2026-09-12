import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonPawnRaceSchema,
  assertPawnRaceReferences,
} from '../../definitions/json-pawn-race-schema';
import { pawnRaceRules } from '../../recipes/gameplay/pawn-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'pawnRace',
  outputKey: 'pawnRace',
  schema: jsonPawnRaceSchema,
  compile: pawnRaceRules,
  choiceIds: (program) => [program.choiceId],
  victoryKind: 'by-pawn-race',
  validate: (context, program) =>
    assertPawnRaceReferences(
      program,
      context.components,
      context.maximumPlayers,
      context.fail,
    ),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    bot: context.recipeBot('pawn-race-roll'),
  }),
  actions: (compiled) => ({
    'pawn-race-roll': compiled.roll,
  }),
});
