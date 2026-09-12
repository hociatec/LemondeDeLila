import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonThemeNameCardsSchema,
  assertThemeNameCardsReferences,
} from '../../definitions/json-theme-name-cards-schema';
import { themeNameCardsRules } from './theme-name-cards.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'cards',
  documentKey: 'themeNameCards',
  outputKey: 'themeNameCards',
  schema: jsonThemeNameCardsSchema,
  compile: themeNameCardsRules,
  victoryKind: 'by-theme-name-cards',
  validate: (_context, program) => assertThemeNameCardsReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: {},
    effects: compiled.effects,
    viewExtension: compiled.viewExtension,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
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
