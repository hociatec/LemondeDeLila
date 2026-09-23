import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonPublicDomainCardsSchema,
  assertPublicDomainCardsReferences,
} from './json-public-domain-cards-schema';
import { publicDomainCardsRules } from './public-domain-cards.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'cards',
  documentKey: 'publicDomainCards',
  outputKey: 'publicDomainCards',
  schema: jsonPublicDomainCardsSchema,
  compile: publicDomainCardsRules,
  victoryKind: 'by-public-domain-cards',
  validate: (context, program) =>
    assertPublicDomainCardsReferences(program, context.components),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    lifecycle: compiled.lifecycle,
    bot: context.selectedBot(({ actor, ctx }) => {
      const play = compiled.enumerate(actor.id, ctx)[0];
      const recipe = play
        ? 'cards-public-domain-play'
        : 'cards-public-domain-pass';
      return { recipe: recipe, payload: play ?? {} };
    }),
  }),
  actions: (compiled) => ({
    'cards-public-domain-play': compiled.play,
    'cards-public-domain-pass': compiled.pass,
  }),
});
