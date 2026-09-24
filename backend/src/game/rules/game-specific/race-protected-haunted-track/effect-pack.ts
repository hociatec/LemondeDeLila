import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonProtectedHauntedRaceSchema,
  assertProtectedHauntedRaceReferences,
} from './json-protected-haunted-race-schema';
import { protectedHauntedRaceRules } from './protected-haunted-race.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: [
    'actions',
    'bot',
    'choices',
    'effects',
    'playerValuesVisibility',
    'setup',
  ],
  scope: 'game-specific',
  domain: 'race',
  documentKey: 'protectedHauntedRace',
  outputKey: 'protectedHauntedRace',
  schema: jsonProtectedHauntedRaceSchema,
  compile: protectedHauntedRaceRules,
  victoryKind: 'by-protected-haunted-race',
  validate: (context, program) =>
    assertProtectedHauntedRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    playerValuesVisibility: context.publicStatuses(),
    bot: context.recipeBot('race-protected-haunted-track-roll'),
  }),
  actions: (compiled) => ({
    'race-protected-haunted-track-roll': compiled.roll,
  }),
});
