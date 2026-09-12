import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonNawakSchema,
  assertNawakReferences,
} from '../../definitions/json-nawak-schema';
import { nawakRules } from './nawak.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'nawak',
  outputKey: 'nawak',
  schema: jsonNawakSchema,
  compile: nawakRules,
  victoryKind: 'by-nawak',
  validate: (_context, program) => assertNawakReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    viewExtension: compiled.viewExtension,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'nawak-choose': compiled.choose,
    'nawak-vote': compiled.vote,
  }),
});
