import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonParadeSchema,
  assertParadeReferences,
} from '../../definitions/json-parade-schema';
import { paradeRules } from './parade.recipes';

export const extension = defineJsonProgramExtension({
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
        const recipe = cardId ? 'parade-play' : 'parade-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: cardId ? { cardId } : {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'parade-play': compiled.play,
    'parade-pass': compiled.pass,
  }),
});
