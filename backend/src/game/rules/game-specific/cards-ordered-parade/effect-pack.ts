import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import { jsonParadeSchema, assertParadeReferences } from './json-parade-schema';
import { paradeRules } from './parade.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: ['actions', 'bot', 'victory'],
  scope: 'game-specific',
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
