import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonSacSchema,
  assertSacReferences,
} from '../../definitions/json-sac-schema';
import { sacRules } from './sac.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'sac',
  outputKey: 'sac',
  schema: jsonSacSchema,
  compile: sacRules,
  victoryKind: 'by-sac',
  validate: (_context, program) => assertSacReferences(program),
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
          'sac-use-jail-card',
          'sac-pay-fine',
          'sac-roll',
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
    'sac-roll': compiled.roll,
    'sac-build': compiled.build,
    'sac-sell-building': compiled.sell,
    'sac-mortgage': compiled.mortgage,
    'sac-unmortgage': compiled.unmortgage,
    'sac-pay-fine': compiled.payFine,
    'sac-use-jail-card': compiled.useJailCard,
  }),
  patterns: (compiled) => compiled.patterns,
});
