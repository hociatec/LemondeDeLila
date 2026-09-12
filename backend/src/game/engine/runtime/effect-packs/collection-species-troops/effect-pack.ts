import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonSpeciesTroopsSchema,
  assertSpeciesTroopsReferences,
} from '../../definitions/json-species-troops-schema';
import { speciesTroopsRules } from './species-troops.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'collection',
  documentKey: 'speciesTroops',
  outputKey: 'speciesTroops',
  schema: jsonSpeciesTroopsSchema,
  compile: speciesTroopsRules,
  victoryKind: 'by-species-troops',
  validate: (context, program) =>
    assertSpeciesTroopsReferences(program, context.components),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    lifecycle: compiled.lifecycle,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const play = compiled.enumerate(actor.id, ctx)[0];
        const recipe = play
          ? 'collection-species-troops-play'
          : 'collection-species-troops-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: play ?? {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'collection-species-troops-play': compiled.play,
    'collection-species-troops-pass': compiled.pass,
  }),
});
