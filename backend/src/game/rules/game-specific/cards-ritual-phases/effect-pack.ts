import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonRitualPhasesSchema,
  assertRitualPhasesReferences,
} from './json-ritual-phases-schema';
import { ritualPhasesRules } from './ritual-phases.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: [
    'actions',
    'bot',
    'choices',
    'components',
    'effects',
    'lifecycle',
    'patterns',
  ],
  scope: 'game-specific',
  domain: 'cards',
  documentKey: 'ritualPhases',
  outputKey: 'ritualPhases',
  schema: jsonRitualPhasesSchema,
  compile: ritualPhasesRules,
  validateProgram: assertRitualPhasesReferences,
  victoryKind: 'by-ritual-phases',
  validate: (_context, program) => assertRitualPhasesReferences(program),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    lifecycle: compiled.lifecycle,
    effects: compiled.effects,
    bot: context.selectedBot(({ actor, ctx }) =>
      compiled.chooseBot(actor.id, ctx),
    ),
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'cards-ritual-phases-ask-card': compiled.ask,
    'cards-ritual-phases-pass': compiled.pass,
  }),
  patterns: (compiled) => compiled.patterns,
});
