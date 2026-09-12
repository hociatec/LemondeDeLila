import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonOlympiaSchema,
  assertOlympiaReferences,
} from '../../definitions/json-olympia-schema';
import { olympiaRules } from './olympia.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'olympia',
  outputKey: 'olympia',
  schema: jsonOlympiaSchema,
  compile: olympiaRules,
  victoryKind: 'by-olympia',
  validate: (context, program) =>
    assertOlympiaReferences(program, context.components),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const cardId = compiled.firstCard(actor.id, ctx);
        const recipe = cardId ? 'olympia-play' : 'olympia-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: cardId ? { cardId } : {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'olympia-draw': compiled.draw,
    'olympia-play': compiled.play,
    'olympia-pass': compiled.pass,
  }),
});
