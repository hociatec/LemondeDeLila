import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonMnemosyneSchema,
  assertMnemosyneReferences,
} from '../../definitions/json-mnemosyne-schema';
import { mnemosyneRules } from './mnemosyne.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'mnemosyne',
  outputKey: 'mnemosyne',
  schema: jsonMnemosyneSchema,
  compile: mnemosyneRules,
  victoryKind: 'by-mnemosyne',
  validate: (_context, program) => assertMnemosyneReferences(program),
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
    'mnemosyne-draw': compiled.draw,
    'mnemosyne-answer': compiled.answer,
    'mnemosyne-timeout': compiled.timeout,
  }),
  patterns: (compiled) => compiled.patterns,
});
