import {
  authoringFailure,
  authoringProperty,
} from '../../../engine/sdk/extension-api';
import { AuthoringError } from '../../../engine/sdk/extension-api';
import type { JudgedCardsProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';
import {
  authorObject as object,
  authorId as id,
  authorPositive as positive,
} from '../../../engine/sdk/extension-api';
import { isEngineEventType } from '../../../engine/sdk/extension-api';

export const jsonJudgedCardsSchema = object({
  judgeId: id,
  submissionId: id,
  promptDeckId: id,
  answerDeckId: id,
  answerHandId: id,
  collectingPhase: id,
  judgingPhase: id,
  scoreToWin: positive,
  winningReason: id,
  submittedMessage: id,
  revealedEvent: id,
  botSelection: { enum: ['first', 'random'] },
});

export function assertJudgedCardsReferences(
  program: JudgedCardsProgram,
  components: readonly GameComponentDefinition[],
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
  minimumPlayers: number,
): void {
  const fail = authoringFailure('game.json.judgedCards', program);
  if (minimumPlayers < 2)
    throw new AuthoringError(
      'manifest.minPlayers',
      'at least two players',
      minimumPlayers,
      'Judged cards require a judge and a submitting player',
    );
  if (
    isEngineEventType(program.revealedEvent) ||
    program.revealedEvent.startsWith('engine.')
  )
    fail('revealedEvent', 'Judged cards cannot redefine an engine event');
  const componentFail = authoringFailure('game.json', {
    components,
    phases,
    initialPhase,
  });
  for (const field of ['promptDeckId', 'answerDeckId'] as const) {
    const id = program[field];
    const index = components.findIndex(
      (c) => c.component === 'cards.deck' && c.id === id,
    );
    const deck = components[index];
    if (deck?.component !== 'cards.deck') fail(field, 'unknown deck');
    if (deck?.component === 'cards.deck')
      deck.cards.forEach((card, i) => {
        const path = `components[${index}].cards[${i}]`;
        if (typeof card !== 'object' || card === null)
          componentFail(path, 'Judged cards require identified card objects');
        else if (!('id' in card) || typeof card.id !== 'string')
          componentFail(`${path}.id`, 'string card identifier required');
      });
  }
  const handIndex = components.findIndex(
    (c) => c.component === 'cards.hands' && c.id === program.answerHandId,
  );
  const hand = components[handIndex];
  if (hand?.component !== 'cards.hands') fail('answerHandId', 'unknown hand');
  if (hand?.component === 'cards.hands') {
    for (const [field, valid] of [
      ['deck', hand.deck === program.answerDeckId],
      ['initial', hand.initial >= 1],
      ['visibility', hand.visibility === 'owner'],
    ] as const)
      if (!valid)
        componentFail(
          `components[${handIndex}].${field}`,
          'Judged cards require a private dealt answer hand',
        );
  }
  if (program.collectingPhase === program.judgingPhase)
    fail('judgingPhase', 'judging and collecting phases must differ');
  if (initialPhase !== program.collectingPhase)
    componentFail('initialPhase', 'collecting phase required');
  for (const [from, to] of [
    [program.collectingPhase, program.judgingPhase],
    [program.judgingPhase, program.collectingPhase],
  ])
    if (!phases[from]?.transitions?.includes(to))
      componentFail(
        `${authoringProperty('phases', from)}.transitions`,
        'Judged card collection and judging phases must form a round cycle',
      );
}
