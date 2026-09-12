import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonContesSchema,
  assertContesReferences,
} from '../../definitions/json-contes-schema';
import { contesRules } from './contes.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'contes',
  outputKey: 'contes',
  schema: jsonContesSchema,
  compile: contesRules,
  victoryKind: 'by-contes',
  validate: (_context, program) => assertContesReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    automatic: compiled.automatic,
    playerValuesVisibility: compiled.playerValuesVisibility,
    bot: {
      choose: ({ availableActions }) => {
        const type = context.actionFor(availableActions, ['contes-roll']);
        return type ? { type, payload: {} } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'contes-roll': compiled.roll,
  }),
  patterns: (compiled) => compiled.patterns,
});
