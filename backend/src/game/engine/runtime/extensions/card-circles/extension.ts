import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonCardCirclesSchema,
  assertCardCirclesReferences,
} from '../../definitions/json-card-circles-schema';
import { cardCirclesRules } from './card-circles.recipes';

export const extension = defineJsonProgramExtension({
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
          circle && context.actionFor(availableActions, ['card-circles-form'])
            ? 'card-circles-form'
            : hand.length > program.handLimit
              ? 'card-circles-discard'
              : 'card-circles-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type
          ? {
              type,
              payload:
                recipe === 'card-circles-form'
                  ? { cardIds: circle }
                  : recipe === 'card-circles-discard'
                    ? { cardId: hand[0] }
                    : {},
            }
          : null;
      },
    },
  }),
  actions: (compiled) => ({
    'card-circles-form': compiled.form,
    'card-circles-discard': compiled.discard,
    'card-circles-pass': compiled.pass,
  }),
});
