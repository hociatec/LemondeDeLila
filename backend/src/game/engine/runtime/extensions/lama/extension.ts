import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonLamaSchema,
  assertLamaReferences,
} from '../../definitions/json-lama-schema';
import { lamaRules } from './lama.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'lama',
  outputKey: 'lama',
  schema: jsonLamaSchema,
  compile: lamaRules,
  victoryKind: 'by-lama',
  validate: (_context, program) => assertLamaReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    choices: compiled.choices,
    initialization: compiled.initialization,
    lifecycle: compiled.lifecycle,
    automatic: compiled.automatic,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, availableActions, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'lama-play': compiled.play,
    'lama-draw': compiled.draw,
    'lama-pass': compiled.pass,
    'lama-quit': compiled.quit,
  }),
  patterns: (compiled) => compiled.patterns,
});
