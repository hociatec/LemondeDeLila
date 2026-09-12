import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonCatPattesSchema,
  assertCatPattesReferences,
} from '../../definitions/json-cat-pattes-schema';
import { catPattesRules } from './cat-pattes.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'catPattes',
  outputKey: 'catPattes',
  schema: jsonCatPattesSchema,
  compile: catPattesRules,
  victoryKind: 'by-cat-pattes',
  validate: (_context, program) => assertCatPattesReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    choices: {},
    lifecycle: compiled.lifecycle,
    effects: compiled.effects,
    playerValuesVisibility: compiled.playerValuesVisibility,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'cat-pattes-draw': compiled.draw,
    'cat-pattes-play': compiled.play,
    'cat-pattes-discard': compiled.discard,
  }),
  patterns: (compiled) => compiled.patterns,
});
