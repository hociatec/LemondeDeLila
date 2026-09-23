import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonChapterEncounterSchema,
  assertChapterEncounterReferences,
} from './json-chapter-encounter-schema';
import { chapterEncounterRules } from './chapter-encounter.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'choice',
  documentKey: 'chapterEncounter',
  outputKey: 'chapterEncounter',
  schema: jsonChapterEncounterSchema,
  compile: chapterEncounterRules,
  victoryKind: 'by-chapter-encounter',
  validate: (context, program) =>
    assertChapterEncounterReferences(program, context.components),
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    lifecycle: compiled.lifecycle,
    bot: context.recipeBot('choice-chapter-encounter-roll'),
  }),
  actions: (compiled) => ({
    'choice-chapter-encounter-roll': compiled.roll,
  }),
});
