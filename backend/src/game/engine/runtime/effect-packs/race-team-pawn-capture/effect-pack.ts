import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonTeamPawnRaceSchema,
  assertTeamPawnRaceReferences,
} from '../../definitions/json-team-pawn-race-schema';
import { teamPawnRaceRules } from './team-pawn-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'teamPawnRace',
  outputKey: 'teamPawnRace',
  schema: jsonTeamPawnRaceSchema,
  compile: teamPawnRaceRules,
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
