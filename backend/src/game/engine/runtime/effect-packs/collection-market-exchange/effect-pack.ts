import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonMarketExchangeSchema,
  assertMarketExchangeReferences,
} from '../../definitions/json-market-exchange-schema';
import { marketExchangeRules } from './market-exchange.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'collection',
  documentKey: 'marketExchange',
  outputKey: 'marketExchange',
  schema: jsonMarketExchangeSchema,
  compile: marketExchangeRules,
  victoryKind: 'by-market-exchange',
  validate: (context, program) =>
    assertMarketExchangeReferences(
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
    'collection-market-exchange-buy': compiled.buy,
    'collection-market-exchange-sell': compiled.sell,
    'collection-market-exchange-rumor': compiled.rumor,
    'collection-market-exchange-protect': compiled.protect,
    'collection-market-exchange-steal': compiled.steal,
    'collection-market-exchange-pass': compiled.pass,
  }),
});
