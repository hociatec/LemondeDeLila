import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonCarAssemblySchema,
  assertCarAssemblyReferences,
} from '../../definitions/json-car-assembly-schema';
import { carAssemblyRules } from './car-assembly.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'carAssembly',
  outputKey: 'carAssembly',
  schema: jsonCarAssemblySchema,
  compile: carAssemblyRules,
  victoryKind: 'by-car-assembly',
  validate: (context, program) =>
    assertCarAssemblyReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    ),
  handlers: (context, compiled) => ({
    automatic: compiled.automatic,
    viewExtension: compiled.viewExtension,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const cardId = compiled.playable(actor.id, ctx)[0];
        const recipe = cardId ? 'car-assembly-play' : 'car-assembly-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: cardId ? { cardId } : {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'car-assembly-play': compiled.play,
    'car-assembly-discard': compiled.discard,
    'car-assembly-pass': compiled.pass,
  }),
});
