import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonThemeNameCardsSchema,
  assertThemeNameCardsReferences,
} from './json-theme-name-cards-schema';
import { themeNameCardsRules } from './theme-name-cards.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'cards',
  documentKey: 'themeNameCards',
  outputKey: 'themeNameCards',
  schema: jsonThemeNameCardsSchema,
  compile: themeNameCardsRules,
  validateProgram: assertThemeNameCardsReferences,
  victoryKind: 'by-theme-name-cards',
  validate: (_context, program) => assertThemeNameCardsReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: {},
    effects: compiled.effects,
    viewExtension: compiled.viewExtension,
    bot: context.selectedBot(({ actor, ctx }) =>
      compiled.chooseBot(actor.id, ctx),
    ),
  }),
  actions: (compiled) => ({
    'cards-theme-name-set-theme': compiled.setTheme,
    'cards-theme-name-play-name': compiled.playName,
    'cards-theme-name-play-special': compiled.playSpecial,
    'cards-theme-name-choose-winner': compiled.chooseWinner,
    'cards-theme-name-pass': compiled.pass,
  }),
  patterns: (compiled) => compiled.patterns,
});
