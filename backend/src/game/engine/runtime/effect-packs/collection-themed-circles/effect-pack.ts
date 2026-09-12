import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonCardCirclesSchema,
  assertCardCirclesReferences,
} from '../../definitions/json-card-circles-schema';
import { cardCirclesRules } from './card-circles.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'collection',
  documentKey: 'cardCircles',
  outputKey: 'cardCircles',
  schema: jsonCardCirclesSchema,
  compile: cardCirclesRules,
  victoryKind: 'by-card-circles',
  validate: (context, program) =>
    assertCardCirclesReferences(program, context.components),
  handlers: (context, compiled, program) => ({
    lifecycle: compiled.lifecycle,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const circle = compiled.circles(
          ctx.cards.hand<string>(program.handId, actor.id),
        )[0];
        const hand = ctx.cards.hand<string>(program.handId, actor.id);
        const recipe =
          circle &&
          context.actionFor(availableActions, [
            'collection-themed-circles-form',
          ])
            ? 'collection-themed-circles-form'
            : hand.length > program.handLimit
              ? 'collection-themed-circles-discard'
              : 'collection-themed-circles-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type
          ? {
              type,
              payload:
                recipe === 'collection-themed-circles-form'
                  ? { cardIds: circle }
                  : recipe === 'collection-themed-circles-discard'
                    ? { cardId: hand[0] }
                    : {},
            }
          : null;
      },
    },
  }),
  actions: (compiled) => ({
    'collection-themed-circles-form': compiled.form,
    'collection-themed-circles-discard': compiled.discard,
    'collection-themed-circles-pass': compiled.pass,
  }),
});
