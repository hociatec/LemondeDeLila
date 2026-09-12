import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonStoryChallengeSchema,
  assertStoryChallengeReferences,
} from '../../definitions/json-story-challenge-schema';
import { storyChallengeRules } from './story-challenge.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'choice',
  documentKey: 'storyChallenge',
  outputKey: 'storyChallenge',
  schema: jsonStoryChallengeSchema,
  compile: storyChallengeRules,
  victoryKind: 'by-story-challenge',
  validate: (_context, program) => assertStoryChallengeReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    automatic: compiled.automatic,
    playerValuesVisibility: compiled.playerValuesVisibility,
    bot: {
      choose: ({ availableActions }) => {
        const type = context.actionFor(availableActions, [
          'choice-story-challenge-roll',
        ]);
        return type ? { type, payload: {} } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'choice-story-challenge-roll': compiled.roll,
  }),
  patterns: (compiled) => compiled.patterns,
});
