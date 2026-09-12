import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonWonderMarketSchema,
  assertWonderMarketReferences,
} from '../../definitions/json-wonder-market-schema';
import { wonderMarketRules } from './wonder-market.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'wonderMarket',
  outputKey: 'wonderMarket',
  schema: jsonWonderMarketSchema,
  compile: wonderMarketRules,
  victoryKind: 'by-wonder-market',
  validate: (context, program) =>
    assertWonderMarketReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    ),
  handlers: (context, compiled) => ({
    playerValuesVisibility: context.publicStatuses(),
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const selected = compiled.choose(actor.id, ctx);
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'wonder-market-buy': compiled.buy,
    'wonder-market-sell': compiled.sell,
    'wonder-market-rumor': compiled.rumor,
    'wonder-market-protect': compiled.protect,
    'wonder-market-steal': compiled.steal,
    'wonder-market-pass': compiled.pass,
  }),
});
