import { authoringProperty } from '../contracts/authoring-diagnostics';
import { isEngineEventType } from '../events/engine-event-registry';
import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';

type Failure = (path: string, reason: string) => never;

export function assertJudgedSubmissionReferences(
  pattern: Extract<JsonGamePattern, { kind: 'judged-submission' }>,
  index: number,
  components: readonly GameComponentDefinition[],
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
  minimumPlayers: number,
  fail: Failure,
): void {
  const root = `patterns[${index}]`;
  if (minimumPlayers < 2)
    fail(root, 'a judge and at least one submitting player are required');
  if (
    isEngineEventType(pattern.revealedEvent) ||
    pattern.revealedEvent.startsWith('engine.')
  )
    fail(`${root}.revealedEvent`, 'engine events cannot be redefined');
  for (const field of ['promptDeckId', 'answerDeckId'] as const) {
    const deck = components.find(
      (component) =>
        component.component === 'cards.deck' && component.id === pattern[field],
    );
    if (deck?.component !== 'cards.deck')
      fail(`${root}.${field}`, 'unknown deck');
    if (
      deck?.component === 'cards.deck' &&
      deck.cards.some(
        (card) =>
          typeof card !== 'object' ||
          card === null ||
          !('id' in card) ||
          typeof card.id !== 'string',
      )
    )
      fail(`${root}.${field}`, 'identified card objects required');
  }
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' &&
      component.id === pattern.answerHandId,
  );
  if (
    hand?.component !== 'cards.hands' ||
    hand.deck !== pattern.answerDeckId ||
    hand.initial < 1 ||
    hand.visibility !== 'owner'
  )
    fail(`${root}.answerHandId`, 'a private dealt answer hand is required');
  if (pattern.collectingPhase === pattern.judgingPhase)
    fail(`${root}.judgingPhase`, 'judging and collecting phases must differ');
  if (initialPhase !== pattern.collectingPhase)
    fail('initialPhase', 'collecting phase required');
  for (const [from, to] of [
    [pattern.collectingPhase, pattern.judgingPhase],
    [pattern.judgingPhase, pattern.collectingPhase],
  ])
    if (!phases[from]?.transitions?.includes(to))
      fail(
        `${authoringProperty('phases', from)}.transitions`,
        'collecting and judging phases must form a cycle',
      );
}
