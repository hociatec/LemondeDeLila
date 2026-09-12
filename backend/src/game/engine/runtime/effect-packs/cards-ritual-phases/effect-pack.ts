import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonRitualPhasesSchema,
  assertRitualPhasesReferences,
} from '../../definitions/json-ritual-phases-schema';
import { ritualPhasesRules } from './ritual-phases.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'cards',
  documentKey: 'ritualPhases',
  outputKey: 'ritualPhases',
  schema: jsonRitualPhasesSchema,
  compile: ritualPhasesRules,
  victoryKind: 'by-ritual-phases',
  validate: (_context, program) => assertRitualPhasesReferences(program),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    lifecycle: compiled.lifecycle,
    effects: compiled.effects,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'cards-ritual-phases-ask-card': compiled.ask,
    'cards-ritual-phases-pass': compiled.pass,
  }),
  patterns: (compiled) => compiled.patterns,
});
