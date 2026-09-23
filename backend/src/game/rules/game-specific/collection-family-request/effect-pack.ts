import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonFamilyRequestSchema,
  assertFamilyRequestReferences,
} from './json-family-request-schema';
import { familyRequestRules } from './family-request.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'collection',
  documentKey: 'familyRequest',
  outputKey: 'familyRequest',
  schema: jsonFamilyRequestSchema,
  compile: familyRequestRules,
  victoryKind: 'by-family-request',
  validate: (context, program) =>
    assertFamilyRequestReferences(
      program,
      context.components,
      context.counters,
    ),
  handlers: (context, compiled) => ({
    bot: context.selectedBot(({ actor, ctx }) => {
      const target = ctx.players.others(actor.id)[0];
      const cardId =
        compiled.familyIds[ctx.random.int(compiled.familyIds.length)];
      const recipe =
        target && cardId
          ? 'collection-family-request-ask'
          : 'collection-family-request-pass';
      return {
        recipe: recipe,
        payload: target && cardId ? { targetPlayerId: target.id, cardId } : {},
      };
    }),
  }),
  actions: (compiled) => ({
    'collection-family-request-ask': compiled.ask,
    'collection-family-request-pass': compiled.pass,
  }),
});
