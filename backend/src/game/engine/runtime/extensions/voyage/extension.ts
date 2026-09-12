import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonVoyageSchema,
  assertVoyageReferences,
} from '../../definitions/json-voyage-schema';
import { voyageRules } from './voyage.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'voyage',
  outputKey: 'voyage',
  schema: jsonVoyageSchema,
  compile: voyageRules,
  victoryKind: 'by-voyage',
  validate: (context, program) =>
    assertVoyageReferences(program, context.components),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    lifecycle: compiled.lifecycle,
    bot: {
      choose: ({ availableActions }) => {
        const type = context.actionFor(availableActions, ['voyage-roll']);
        return type ? { type, payload: {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'voyage-roll': compiled.roll,
  }),
});
