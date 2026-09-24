import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonSharedPrestigeCardsSchema,
  assertSharedPrestigeCardsReferences,
} from './json-shared-prestige-cards-schema';
import { sharedPrestigeCardsRules } from './shared-prestige-cards.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: ['actions', 'bot', 'effects'],
  scope: 'game-specific',
  domain: 'cards',
  documentKey: 'sharedPrestigeCards',
  outputKey: 'sharedPrestigeCards',
  schema: jsonSharedPrestigeCardsSchema,
  compile: sharedPrestigeCardsRules,
  victoryKind: 'by-shared-prestige-cards',
  validate: (context, program) =>
    assertSharedPrestigeCardsReferences(program, context.components),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: context.selectedBot(({ actor, ctx }) => {
      const cardId = compiled.firstCard(actor.id, ctx);
      const recipe = cardId
        ? 'cards-shared-prestige-play'
        : 'cards-shared-prestige-pass';
      return { recipe: recipe, payload: cardId ? { cardId } : {} };
    }),
  }),
  actions: (compiled) => ({
    'cards-shared-prestige-draw': compiled.draw,
    'cards-shared-prestige-play': compiled.play,
    'cards-shared-prestige-pass': compiled.pass,
  }),
});
