import type { JudgedCardsProgram } from '../contracts/judged-cards-program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorObject as object,
  authorId as id,
  authorPositive as positive,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { isEngineEventType } from '../events/engine-event-registry';

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
  if (minimumPlayers < 2)
    throw new GameConfigurationError(
      'Judged cards require a judge and a submitting player',
    );
  if (
    isEngineEventType(program.revealedEvent) ||
    program.revealedEvent.startsWith('engine.')
  )
    throw new GameConfigurationError(
      'Judged cards cannot redefine an engine event',
    );
  const decks = components.filter((c) => c.component === 'cards.deck');
  for (const id of [program.promptDeckId, program.answerDeckId]) {
    const deck = decks.find((c) => c.id === id);
    if (
      !deck ||
      deck.cards.some(
        (card) =>
          typeof card !== 'object' ||
          card === null ||
          !('id' in card) ||
          typeof card.id !== 'string',
      )
    )
      throw new GameConfigurationError(
        'Judged cards require identified card objects',
      );
  }
  const hand = components.find(
    (c) => c.component === 'cards.hands' && c.id === program.answerHandId,
  );
  if (
    hand?.component !== 'cards.hands' ||
    hand.deck !== program.answerDeckId ||
    hand.initial < 1 ||
    hand.visibility !== 'owner'
  )
    throw new GameConfigurationError(
      'Judged cards require a private dealt answer hand',
    );
  if (
    program.collectingPhase === program.judgingPhase ||
    initialPhase !== program.collectingPhase ||
    !phases[program.collectingPhase]?.transitions?.includes(
      program.judgingPhase,
    ) ||
    !phases[program.judgingPhase]?.transitions?.includes(
      program.collectingPhase,
    )
  )
    throw new GameConfigurationError(
      'Judged card collection and judging phases must form a round cycle',
    );
}
