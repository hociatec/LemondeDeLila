import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonPawnRaceSchema,
  assertPawnRaceReferences,
} from '../../definitions/json-pawn-race-schema';
import { pawnRaceRules } from '../../recipes/gameplay/pawn-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
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
    bot: context.recipeBot('race-multi-pawn-roll'),
  }),
  actions: (compiled) => ({
    'race-multi-pawn-roll': compiled.roll,
  }),
});
