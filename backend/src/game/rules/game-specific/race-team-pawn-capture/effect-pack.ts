import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonTeamPawnRaceSchema,
  assertTeamPawnRaceReferences,
} from './json-team-pawn-race-schema';
import { teamPawnRaceRules } from './team-pawn-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'race',
  documentKey: 'teamPawnRace',
  outputKey: 'teamPawnRace',
  schema: jsonTeamPawnRaceSchema,
  compile: teamPawnRaceRules,
  validateProgram: assertTeamPawnRaceReferences,
  victoryKind: 'by-team-pawn-race',
  validate: (context, program) =>
    assertTeamPawnRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    bot: context.recipeBot('race-team-pawn-capture-roll'),
  }),
  actions: (compiled) => ({
    'race-team-pawn-capture-roll': compiled.roll,
  }),
});
