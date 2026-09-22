import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonSpeciesTroopsSchema,
  assertSpeciesTroopsReferences,
} from '../../schemas/json-species-troops-schema';
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
    bot: context.selectedBot(({ actor, ctx }) => {
      const play = compiled.enumerate(actor.id, ctx)[0];
      const recipe = play
        ? 'collection-species-troops-play'
        : 'collection-species-troops-pass';
      return { recipe: recipe, payload: play ?? {} };
    }),
  }),
  actions: (compiled) => ({
    'collection-species-troops-play': compiled.play,
    'collection-species-troops-pass': compiled.pass,
  }),
});
