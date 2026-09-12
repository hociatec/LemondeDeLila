import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonChapterEncounterSchema,
  assertChapterEncounterReferences,
} from '../../definitions/json-chapter-encounter-schema';
import { chapterEncounterRules } from './chapter-encounter.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
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
    bot: {
      choose: ({ availableActions }) => {
        const type = context.actionFor(availableActions, [
          'choice-chapter-encounter-roll',
        ]);
        return type ? { type, payload: {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'choice-chapter-encounter-roll': compiled.roll,
  }),
});
