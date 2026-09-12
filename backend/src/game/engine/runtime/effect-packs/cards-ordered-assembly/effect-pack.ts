import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonCarAssemblySchema,
  assertCarAssemblyReferences,
} from '../../definitions/json-car-assembly-schema';
import { carAssemblyRules } from './car-assembly.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'cards',
  documentKey: 'carAssembly',
  outputKey: 'carAssembly',
  schema: jsonCarAssemblySchema,
  compile: carAssemblyRules,
  victoryKind: 'by-car-assembly',
  validate: (context, program) =>
    assertCarAssemblyReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    ),
  handlers: (context, compiled) => ({
    automatic: compiled.automatic,
    viewExtension: compiled.viewExtension,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const cardId = compiled.playable(actor.id, ctx)[0];
        const recipe = cardId
          ? 'cards-ordered-assembly-play'
          : 'cards-ordered-assembly-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: cardId ? { cardId } : {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'cards-ordered-assembly-play': compiled.play,
    'cards-ordered-assembly-discard': compiled.discard,
    'cards-ordered-assembly-pass': compiled.pass,
  }),
});
