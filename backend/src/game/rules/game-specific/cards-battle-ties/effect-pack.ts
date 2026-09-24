import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonBattleTiesSchema,
  assertBattleTiesReferences,
} from './json-battle-ties-schema';
import { battleTiesRules } from './battle-ties.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: ['actions', 'bot', 'setup', 'viewExtension'],
  scope: 'game-specific',
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
