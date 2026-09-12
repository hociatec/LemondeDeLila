import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonBananaTroopsSchema,
  assertBananaTroopsReferences,
} from '../../definitions/json-banana-troops-schema';
import { bananaTroopsRules } from './banana-troops.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'bananaTroops',
  outputKey: 'bananaTroops',
  schema: jsonBananaTroopsSchema,
  compile: bananaTroopsRules,
  victoryKind: 'by-banana-troops',
  validate: (context, program) =>
    assertBananaTroopsReferences(program, context.components),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    lifecycle: compiled.lifecycle,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const play = compiled.enumerate(actor.id, ctx)[0];
        const recipe = play ? 'banana-troops-play' : 'banana-troops-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: play ?? {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'banana-troops-play': compiled.play,
    'banana-troops-pass': compiled.pass,
  }),
});
