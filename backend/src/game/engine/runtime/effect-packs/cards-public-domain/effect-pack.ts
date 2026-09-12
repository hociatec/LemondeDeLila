import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonPublicDomainCardsSchema,
  assertPublicDomainCardsReferences,
} from '../../definitions/json-public-domain-cards-schema';
import { publicDomainCardsRules } from './public-domain-cards.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
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
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const play = compiled.enumerate(actor.id, ctx)[0];
        const recipe = play
          ? 'cards-public-domain-play'
          : 'cards-public-domain-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: play ?? {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'cards-public-domain-play': compiled.play,
    'cards-public-domain-pass': compiled.pass,
  }),
});
