import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonNatureFamiliesSchema,
  assertNatureFamiliesReferences,
} from '../../definitions/json-nature-families-schema';
import { natureFamiliesRules } from './nature-families.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'natureFamilies',
  outputKey: 'natureFamilies',
  schema: jsonNatureFamiliesSchema,
  compile: natureFamiliesRules,
  victoryKind: 'by-nature-families',
  validate: (context, program) =>
    assertNatureFamiliesReferences(
      program,
      context.components,
      context.counters,
    ),
  handlers: (context, compiled) => ({
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const target = ctx.players.others(actor.id)[0];
        const cardId =
          compiled.familyIds[ctx.random.int(compiled.familyIds.length)];
        const recipe =
          target && cardId ? 'nature-families-ask' : 'nature-families-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type
          ? {
              type,
              payload:
                target && cardId ? { targetPlayerId: target.id, cardId } : {},
            }
          : null;
      },
    },
  }),
  actions: (compiled) => ({
    'nature-families-ask': compiled.ask,
    'nature-families-pass': compiled.pass,
  }),
});
