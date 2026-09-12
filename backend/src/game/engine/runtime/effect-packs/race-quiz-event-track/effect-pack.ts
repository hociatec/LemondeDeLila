import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonQuizEventRaceSchema,
  assertQuizEventRaceReferences,
} from '../../definitions/json-quiz-event-race-schema';
import { quizEventRaceRules } from './quiz-event-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'quizEventRace',
  outputKey: 'quizEventRace',
  schema: jsonQuizEventRaceSchema,
  compile: quizEventRaceRules,
  victoryKind: 'by-quiz-event-race',
  validate: (context, program) =>
    assertQuizEventRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('race-quiz-event-track-roll'),
  }),
  actions: (compiled) => ({
    'race-quiz-event-track-roll': compiled.roll,
  }),
});
