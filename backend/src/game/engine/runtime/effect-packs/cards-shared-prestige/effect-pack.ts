import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonSharedPrestigeCardsSchema,
  assertSharedPrestigeCardsReferences,
} from '../../definitions/json-shared-prestige-cards-schema';
import { sharedPrestigeCardsRules } from './shared-prestige-cards.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
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
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const cardId = compiled.firstCard(actor.id, ctx);
        const recipe = cardId
          ? 'cards-shared-prestige-play'
          : 'cards-shared-prestige-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: cardId ? { cardId } : {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'cards-shared-prestige-draw': compiled.draw,
    'cards-shared-prestige-play': compiled.play,
    'cards-shared-prestige-pass': compiled.pass,
  }),
});
