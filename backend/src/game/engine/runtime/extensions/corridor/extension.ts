import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonCorridorSchema,
  assertCorridorReferences,
} from '../../definitions/json-corridor-schema';
import { corridorRules } from './corridor.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'corridor',
  outputKey: 'corridor',
  schema: jsonCorridorSchema,
  compile: corridorRules,
  victoryKind: 'by-corridor',
  validate: (_context, program) => assertCorridorReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    choices: compiled.choices,
    initialization: compiled.initialization,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const type = context.actionFor(availableActions, ['corridor-move']);
        const move = compiled.firstMove(actor.id, ctx);
        return type && move ? { type, payload: move } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'corridor-move': compiled.move,
    'corridor-place-wall': compiled.placeWall,
  }),
  patterns: (compiled) => compiled.patterns,
});
