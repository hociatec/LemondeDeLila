import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonProfessionFamiliesSchema,
  assertProfessionFamiliesReferences,
} from '../../definitions/json-profession-families-schema';
import { professionFamiliesRules } from './profession-families.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'professionFamilies',
  outputKey: 'professionFamilies',
  schema: jsonProfessionFamiliesSchema,
  compile: professionFamiliesRules,
  victoryKind: 'by-profession-families',
  validate: (context, program) =>
    assertProfessionFamiliesReferences(
      program,
      context.components,
      context.resources,
    ),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const type = context.actionFor(availableActions, [
          'profession-families-request',
        ]);
        const payload = compiled.enumerate(actor.id, ctx)[0];
        return type && payload ? { type, payload } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'profession-families-request': compiled.request,
  }),
});
