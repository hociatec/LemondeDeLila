import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonSimultaneousQuizSchema,
  assertSimultaneousQuizReferences,
} from './json-simultaneous-quiz-schema';
import { simultaneousQuizRules } from './simultaneous-quiz.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'choice',
  documentKey: 'simultaneousQuiz',
  outputKey: 'simultaneousQuiz',
  schema: jsonSimultaneousQuizSchema,
  compile: simultaneousQuizRules,
  victoryKind: 'by-simultaneous-quiz',
  validate: (_context, program) => assertSimultaneousQuizReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    bot: context.selectedBot(({ availableActions, ctx }) =>
      compiled.chooseBot(availableActions, ctx),
    ),
  }),
  events: (compiled) => compiled.events,
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'choice-simultaneous-quiz-draw': compiled.draw,
    'choice-simultaneous-quiz-answer': compiled.answer,
    'choice-simultaneous-quiz-timeout': compiled.timeout,
    'choice-simultaneous-quiz-ready': compiled.ready,
  }),
  patterns: (compiled) => compiled.patterns,
});
