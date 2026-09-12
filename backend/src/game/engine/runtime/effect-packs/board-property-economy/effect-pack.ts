import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonPropertyEconomySchema,
  assertPropertyEconomyReferences,
} from '../../definitions/json-property-economy-schema';
import { propertyEconomyRules } from './property-economy.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'board',
  documentKey: 'propertyEconomy',
  outputKey: 'propertyEconomy',
  schema: jsonPropertyEconomySchema,
  compile: propertyEconomyRules,
  victoryKind: 'by-property-economy',
  validate: (_context, program) => assertPropertyEconomyReferences(program),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    config: compiled.config,
    setup: compiled.setup,
    initialization: compiled.initialization,
    resourceIds: compiled.resourceIds,
    viewExtension: compiled.viewExtension,
    bot: {
      choose: ({ availableActions }) => {
        const type = context.actionFor(availableActions, [
          'board-property-economy-use-jail-card',
          'board-property-economy-pay-fine',
          'board-property-economy-roll',
        ]);
        return type ? { type, payload: {} } : null;
      },
    },
  }),
  events: (compiled) => compiled.events,
  components: (compiled) =>
    compiled.components.filter(
      (component) => component.component !== 'cards.zone',
    ),
  actions: (compiled) => ({
    'board-property-economy-roll': compiled.roll,
    'board-property-economy-build': compiled.build,
    'board-property-economy-sell-building': compiled.sell,
    'board-property-economy-mortgage': compiled.mortgage,
    'board-property-economy-unmortgage': compiled.unmortgage,
    'board-property-economy-pay-fine': compiled.payFine,
    'board-property-economy-use-jail-card': compiled.useJailCard,
  }),
  patterns: (compiled) => compiled.patterns,
});
