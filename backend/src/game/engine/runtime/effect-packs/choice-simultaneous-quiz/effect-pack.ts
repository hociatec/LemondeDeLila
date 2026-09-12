import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonSimultaneousQuizSchema,
  assertSimultaneousQuizReferences,
} from '../../definitions/json-simultaneous-quiz-schema';
import { simultaneousQuizRules } from './simultaneous-quiz.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'choice',
  documentKey: 'simultaneousQuiz',
  outputKey: 'simultaneousQuiz',
  schema: jsonSimultaneousQuizSchema,
  compile: simultaneousQuizRules,
  victoryKind: 'by-simultaneous-quiz',
  validate: (_context, program) => assertSimultaneousQuizReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    bot: {
      choose: ({ availableActions, ctx }) => {
        const selected = compiled.chooseBot(availableActions, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  events: (compiled) => compiled.events,
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'choice-simultaneous-quiz-draw': compiled.draw,
    'choice-simultaneous-quiz-answer': compiled.answer,
    'choice-simultaneous-quiz-timeout': compiled.timeout,
  }),
  patterns: (compiled) => compiled.patterns,
});
