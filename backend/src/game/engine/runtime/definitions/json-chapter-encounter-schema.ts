import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { ChapterEncounterProgram } from '../effect-packs/choice-chapter-encounter/program';
import { effectJsonSchema } from '../contracts/effect-json-schema';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorRecord as record,
  type AuthorSchema,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

const integer: AuthorSchema = {
  type: 'integer',
  minimum: -1000000,
  maximum: 1000000,
};
const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const kind = { enum: ['legend', 'farce', 'treasure', 'landscape'] } as const;
const card = object(
  {
    id: { type: 'integer', minimum: 1, maximum: 1000000 },
    title: text,
    description: text,
    effect: text,
    effects: effectJsonSchema,
    collectionGain: { oneOf: [{ type: 'null' }, kind] },
    discardAfterResolve: boolean,
    quiz: object({
      choices: array(object({ id, label: text }), 2),
      answerId: id,
      successDelta: integer,
    }),
  },
  [
    'id',
    'title',
    'description',
    'effect',
    'effects',
    'collectionGain',
    'discardAfterResolve',
  ],
);

export const jsonChapterEncounterSchema = object({
  trackId: id,
  diceId: id,
  choiceId: id,
  lastTargetStatusId: id,
  finishStartedCounterId: id,
  finishCountdownCounterId: id,
  collectionResourcePrefix: id,
  collectionKinds: { type: 'array', items: kind, minItems: 4, maxItems: 4 },
  tiles: array(
    object(
      {
        id: { type: 'integer', minimum: 1, maximum: 1000000 },
        title: text,
        type: {
          enum: [
            'start',
            'finish',
            'neutral',
            'rest',
            'passage',
            'legend',
            'farce',
            'treasure',
            'landscape',
          ],
        },
        label: text,
        description: text,
        passageEffect: {
          oneOf: [
            object({ kind: { const: 'swap-position' } }),
            object({ kind: { const: 'move' }, delta: integer }),
          ],
        },
      },
      ['id', 'title', 'type'],
    ),
    2,
  ),
  decks: record(array(card, 1)),
});

export function assertChapterEncounterReferences(
  program: ChapterEncounterProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`ChapterEncounter: ${reason}`);
  };
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('unknown dice');
  if (new Set(program.collectionKinds).size !== 4)
    fail('four unique collection kinds required');
  for (const collectionKind of program.collectionKinds) {
    if (!program.decks[collectionKind]?.length)
      fail(`missing ${collectionKind} cards`);
    if (
      !components.some(
        (item) => item.component === 'cards.deck' && item.id === collectionKind,
      )
    )
      fail(`unknown ${collectionKind} deck`);
  }
  for (const cardValue of Object.values(program.decks)) {
    for (const entry of cardValue) {
      const quiz = entry.quiz;
      if (
        quiz &&
        (new Set(quiz.choices.map((choice) => choice.id)).size !==
          quiz.choices.length ||
          !quiz.choices.some((choice) => choice.id === quiz.answerId))
      )
        fail(`invalid quiz on card ${entry.id}`);
    }
  }
}
