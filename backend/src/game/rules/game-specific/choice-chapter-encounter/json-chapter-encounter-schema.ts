import {
  authoringFailure,
  authoringProperty,
  assertUniqueAuthorValues,
} from '../../../engine/sdk/extension-api';
import type { ChapterEncounterProgram } from './program';
import { effectJsonSchema } from '../../../engine/sdk/extension-api';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorRecord as record,
  type AuthorSchema,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

const integer: AuthorSchema = {
  type: 'integer',
  minimum: -1000000,
  maximum: 1000000,
};
const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const kind = id;
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
  legacyQuizDeckId: id,
  tieBreakCollection: id,
  finishReason: id,
  trackId: id,
  diceId: id,
  choiceId: id,
  lastTargetStatusId: id,
  finishStartedCounterId: id,
  finishCountdownCounterId: id,
  collectionResourcePrefix: id,
  collectionKinds: array(kind, 1),
  tiles: array(
    object(
      {
        id: { type: 'integer', minimum: 1, maximum: 1000000 },
        title: text,
        type: id,
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
  const fail = authoringFailure(
    'game.json.chapterEncounter',
    program,
    'ChapterEncounter: ',
  );
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('trackId', 'one tile per track position required');
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('diceId', 'unknown dice');
  assertUniqueAuthorValues(
    program.collectionKinds,
    (i) => `collectionKinds[${i}]`,
    fail,
  );
  const reserved = ['start', 'finish', 'neutral', 'rest', 'passage'];
  program.collectionKinds.forEach((value, i) => {
    if (reserved.includes(value))
      fail(`collectionKinds[${i}]`, 'reserved collection kind');
  });
  for (const field of ['legacyQuizDeckId', 'tieBreakCollection'] as const)
    if (!program.collectionKinds.includes(program[field]))
      fail(field, 'unknown collection reference');
  for (const key of Object.keys(program.decks))
    if (!program.collectionKinds.includes(key))
      fail(authoringProperty('decks', key), 'undeclared deck');
  program.tiles.forEach((tile, i) => {
    if (
      !reserved.includes(tile.type) &&
      !program.collectionKinds.includes(tile.type)
    )
      fail(`tiles[${i}].type`, 'unknown tile kind');
  });
  for (const collectionKind of program.collectionKinds) {
    if (!program.decks[collectionKind]?.length)
      fail(
        authoringProperty('decks', collectionKind),
        `missing ${collectionKind} cards`,
      );
    if (
      !components.some(
        (item) => item.component === 'cards.deck' && item.id === collectionKind,
      )
    )
      fail(
        authoringProperty('decks', collectionKind),
        `unknown ${collectionKind} deck`,
      );
  }
  for (const [deckId, cardValue] of Object.entries(program.decks)) {
    const path = authoringProperty('decks', deckId);
    assertUniqueAuthorValues(
      cardValue.map((entry) => entry.id),
      (i) => `${path}[${i}].id`,
      fail,
    );
    for (const [index, entry] of cardValue.entries()) {
      if (
        entry.collectionGain != null &&
        !program.collectionKinds.includes(entry.collectionGain)
      )
        fail(`${path}[${index}].collectionGain`, 'unknown collection gain');
      const quiz = entry.quiz;
      if (!quiz) continue;
      assertUniqueAuthorValues(
        quiz.choices.map((choice) => choice.id),
        (i) => `${path}[${index}].quiz.choices[${i}].id`,
        fail,
      );
      if (!quiz.choices.some((choice) => choice.id === quiz.answerId))
        fail(
          `${path}[${index}].quiz.answerId`,
          `invalid quiz on card ${entry.id}`,
        );
    }
  }
}
