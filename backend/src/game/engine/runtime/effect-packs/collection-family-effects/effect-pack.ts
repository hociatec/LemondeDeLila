import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonFamilyEffectsSchema,
  assertFamilyEffectsReferences,
} from '../../definitions/json-family-effects-schema';
import { familyEffectsRules } from './family-effects.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'collection',
  documentKey: 'familyEffects',
  outputKey: 'familyEffects',
  schema: jsonFamilyEffectsSchema,
  compile: familyEffectsRules,
  victoryKind: 'by-family-effects',
  validate: (context, program) =>
    assertFamilyEffectsReferences(
      program,
      context.components,
      context.resources,
    ),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const type = context.actionFor(availableActions, [
          'collection-family-effects-request',
        ]);
        const payload = compiled.enumerate(actor.id, ctx)[0];
        return type && payload ? { type, payload } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'collection-family-effects-request': compiled.request,
  }),
});
