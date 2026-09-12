import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonParadeSchema,
  assertParadeReferences,
} from '../../definitions/json-parade-schema';
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
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const cardId = compiled.playable(actor.id, ctx)[0];
        const recipe = cardId
          ? 'cards-ordered-parade-play'
          : 'cards-ordered-parade-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: cardId ? { cardId } : {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'cards-ordered-parade-play': compiled.play,
    'cards-ordered-parade-pass': compiled.pass,
  }),
});
