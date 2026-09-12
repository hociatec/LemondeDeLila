import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonZigEtZagSchema,
  assertZigEtZagReferences,
} from '../../definitions/json-zig-et-zag-schema';
import { zigEtZagRules } from './zig-et-zag.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'zigEtZag',
  outputKey: 'zigEtZag',
  schema: jsonZigEtZagSchema,
  compile: zigEtZagRules,
  victoryKind: 'by-zig-et-zag',
  validate: (_context, program) => assertZigEtZagReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    viewExtension: compiled.viewExtension,
    bot: context.recipeBot('zig-et-zag-draw'),
  }),
  actions: (compiled) => ({
    'zig-et-zag-draw': compiled.draw,
  }),
});
