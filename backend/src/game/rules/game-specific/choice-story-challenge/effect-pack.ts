import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonStoryChallengeSchema,
  assertStoryChallengeReferences,
} from './json-story-challenge-schema';
import { storyChallengeRules } from './story-challenge.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: [
    'actions',
    'automatic',
    'bot',
    'choices',
    'components',
    'effects',
    'patterns',
    'playerValuesVisibility',
    'setup',
  ],
  scope: 'game-specific',
  domain: 'choice',
  documentKey: 'storyChallenge',
  outputKey: 'storyChallenge',
  schema: jsonStoryChallengeSchema,
  compile: storyChallengeRules,
  validateProgram: assertStoryChallengeReferences,
  victoryKind: 'by-story-challenge',
  validate: (context, program) =>
    assertStoryChallengeReferences(program, context.resources),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    automatic: compiled.automatic,
    playerValuesVisibility: compiled.playerValuesVisibility,
    bot: context.recipeBot('choice-story-challenge-roll'),
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'choice-story-challenge-roll': compiled.roll,
  }),
  patterns: (compiled) => compiled.patterns,
});
