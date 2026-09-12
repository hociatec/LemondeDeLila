import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonGerardSchema,
  assertGerardReferences,
} from '../../definitions/json-gerard-schema';
import { gerardRules } from './gerard.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'gerard',
  outputKey: 'gerard',
  schema: jsonGerardSchema,
  compile: gerardRules,
  victoryKind: 'by-gerard',
  validate: (_context, program) => assertGerardReferences(program),
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
    'gerard-set-theme': compiled.setTheme,
    'gerard-play-name': compiled.playName,
    'gerard-play-special': compiled.playSpecial,
    'gerard-choose-winner': compiled.chooseWinner,
    'gerard-pass': compiled.pass,
  }),
  patterns: (compiled) => compiled.patterns,
});
