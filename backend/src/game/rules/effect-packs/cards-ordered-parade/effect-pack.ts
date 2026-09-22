import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonParadeSchema,
  assertParadeReferences,
} from '../../schemas/json-parade-schema';
import { paradeRules } from './parade.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'cards',
  documentKey: 'parade',
  outputKey: 'parade',
  schema: jsonParadeSchema,
  compile: paradeRules,
  victoryKind: 'by-parade',
  validate: (context, program) =>
    assertParadeReferences(program, context.components, context.resources),
  handlers: (context, compiled) => ({
    victory: compiled.victory,
    bot: context.selectedBot(({ actor, ctx }) => {
      const cardId = compiled.playable(actor.id, ctx)[0];
      const recipe = cardId
        ? 'cards-ordered-parade-play'
        : 'cards-ordered-parade-pass';
      return { recipe: recipe, payload: cardId ? { cardId } : {} };
    }),
  }),
  actions: (compiled) => ({
    'cards-ordered-parade-play': compiled.play,
    'cards-ordered-parade-pass': compiled.pass,
  }),
});
