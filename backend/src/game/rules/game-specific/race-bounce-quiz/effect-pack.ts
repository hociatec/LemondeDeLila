import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonBounceQuizRaceSchema,
  assertBounceQuizRaceReferences,
} from './json-bounce-quiz-race-schema';
import { bounceQuizRaceRules } from './bounce-quiz-race.recipes';

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
  documentKey: 'bounceQuizRace',
  outputKey: 'bounceQuizRace',
  schema: jsonBounceQuizRaceSchema,
  compile: bounceQuizRaceRules,
  victoryKind: 'by-bounce-quiz-race',
  validate: (context, program) =>
    assertBounceQuizRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    playerValuesVisibility: context.publicStatuses(),
    bot: context.recipeBot('race-bounce-quiz-roll'),
  }),
  actions: (compiled) => ({
    'race-bounce-quiz-roll': compiled.roll,
  }),
});
