import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonDiscardPenaltyCardsSchema,
  assertDiscardPenaltyCardsReferences,
} from '../../definitions/json-discard-penalty-cards-schema';
import { discardPenaltyCardsRules } from './discard-penalty-cards.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'cards',
  documentKey: 'discardPenaltyCards',
  outputKey: 'discardPenaltyCards',
  schema: jsonDiscardPenaltyCardsSchema,
  compile: discardPenaltyCardsRules,
  victoryKind: 'by-discard-penalty-cards',
  validate: (_context, program) => assertDiscardPenaltyCardsReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    choices: compiled.choices,
    initialization: compiled.initialization,
    lifecycle: compiled.lifecycle,
    automatic: compiled.automatic,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, availableActions, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'cards-discard-penalty-play': compiled.play,
    'cards-discard-penalty-draw': compiled.draw,
    'cards-discard-penalty-pass': compiled.pass,
    'cards-discard-penalty-quit': compiled.quit,
  }),
  patterns: (compiled) => compiled.patterns,
});
