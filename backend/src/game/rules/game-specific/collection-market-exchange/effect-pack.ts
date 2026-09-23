import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonMarketExchangeSchema,
  assertMarketExchangeReferences,
} from './json-market-exchange-schema';
import { marketExchangeRules } from './market-exchange.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
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
    bot: context.selectedBot(({ actor, ctx }) =>
      compiled.choose(actor.id, ctx),
    ),
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
