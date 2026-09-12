import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonBattleTiesSchema,
  assertBattleTiesReferences,
} from '../../definitions/json-battle-ties-schema';
import { battleTiesRules } from './battle-ties.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'cards',
  documentKey: 'battleTies',
  outputKey: 'battleTies',
  schema: jsonBattleTiesSchema,
  compile: battleTiesRules,
  victoryKind: 'by-battle-ties',
  validate: (_context, program) => assertBattleTiesReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    viewExtension: compiled.viewExtension,
    bot: context.recipeBot('cards-battle-ties-draw'),
  }),
  actions: (compiled) => ({
    'cards-battle-ties-draw': compiled.draw,
  }),
});
