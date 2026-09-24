import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonPairedPawnRaceSchema,
  assertPairedPawnRaceReferences,
} from './json-paired-pawn-race-schema';
import { pairedPawnRaceRules } from './paired-pawn-race.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: ['actions', 'bot', 'effects'],
  scope: 'game-specific',
  domain: 'race',
  documentKey: 'pairedPawnRace',
  outputKey: 'pairedPawnRace',
  schema: jsonPairedPawnRaceSchema,
  compile: pairedPawnRaceRules,
  victoryKind: 'by-paired-pawn-race',
  validate: (context, program) =>
    assertPairedPawnRaceReferences(
      program,
      context.components,
      context.resources,
    ),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: context.recipeBot('race-paired-pawns-roll'),
  }),
  actions: (compiled) => ({
    'race-paired-pawns-roll': compiled.roll,
  }),
});
