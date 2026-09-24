import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonChapterEncounterSchema,
  assertChapterEncounterReferences,
} from './json-chapter-encounter-schema';
import { chapterEncounterRules } from './chapter-encounter.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: ['actions', 'bot', 'choices', 'effects', 'lifecycle'],
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
