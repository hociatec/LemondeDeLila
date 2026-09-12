import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonRitesSchema,
  assertRitesReferences,
} from '../../definitions/json-rites-schema';
import { ritesRules } from './rites.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'rites',
  outputKey: 'rites',
  schema: jsonRitesSchema,
  compile: ritesRules,
  victoryKind: 'by-rites',
  validate: (_context, program) => assertRitesReferences(program),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    lifecycle: compiled.lifecycle,
    effects: compiled.effects,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'rites-ask-card': compiled.ask,
    'rites-pass': compiled.pass,
  }),
  patterns: (compiled) => compiled.patterns,
});
