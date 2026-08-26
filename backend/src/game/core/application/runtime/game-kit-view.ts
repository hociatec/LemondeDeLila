import {
  projectCardsKitState,
  type CardSetsDefinition,
  type HandsDefinition,
} from './cards-kit';
import type { GameComponentDefinition } from './component-kit';
import type { EngineKitsState } from './game-definition';
import {
  projectInventoryKitState,
  type InventoryDefinition,
} from './inventory-kit';
import {
  projectEconomyKitState,
  type MarketDefinition,
} from './economy-kit';
import {
  projectOwnershipKitState,
  type OwnershipDefinition,
} from './ownership-kit';
import type { QuizDefinition } from './quiz-kit';
import type { TrackDefinition } from './movement-kit';
import type { DiceDefinition } from './dice-kit';
import type { GridDefinition } from './grid-kit';
import type { PawnSetDefinition } from './pawn-kit';

export function projectGameKits(
  kits: EngineKitsState,
  viewerPlayerId: number | null,
  turnNumber: number,
  components: readonly GameComponentDefinition[] = [],
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  if (kits.cards && Object.keys(kits.cards.decks).length > 0) {
    extras.cards = projectCardsKitState(
      kits.cards,
      viewerPlayerId,
      components.filter(
        (component): component is HandsDefinition | CardSetsDefinition =>
          component.component === 'cards.hands' ||
          component.component === 'cards.sets',
      ),
    );
  }
  if (kits.inventory && Object.keys(kits.inventory.byPlayer).length > 0) {
    extras.inventory = projectInventoryKitState(
      kits.inventory,
      viewerPlayerId,
      components.filter(
        (component): component is InventoryDefinition =>
          component.component === 'inventory.set',
      ),
    );
  }
  if (kits.economy && Object.keys(kits.economy.prices).length > 0) {
    extras.economy = projectEconomyKitState(
      kits.economy,
      components.filter(
        (component): component is MarketDefinition =>
          component.component === 'economy.market',
      ),
    );
  }
  if (kits.ownership && Object.keys(kits.ownership.owners).length > 0) {
    extras.ownership = projectOwnershipKitState(
      kits.ownership,
      viewerPlayerId,
      components.filter(
        (component): component is OwnershipDefinition =>
          component.component === 'ownership.registry',
      ),
    );
  }
  const dice = kits.dice;
  const latest = dice ? Object.entries(dice.rolls).at(-1) : undefined;
  const diceDefinitions = components.filter(
    (component): component is DiceDefinition =>
      component.component === 'dice.set',
  );
  const setId = latest?.[0] ?? diceDefinitions[0]?.id;
  const definition = diceDefinitions.find((candidate) => candidate.id === setId);
  if (setId && definition) {
    const roll = latest?.[0] === setId ? latest[1] : null;
    extras.dice = {
      id: setId,
      label: definition.count > 1 ? 'Dés' : 'Dé',
      sides: definition.sides,
      dice: Array.from({ length: definition.count }, (_, index) => ({
        id: `${setId}-${index + 1}`,
        label: `Dé ${index + 1}`,
        sides: definition.sides,
        ...(roll?.values[index] == null ? {} : { value: roll.values[index] }),
      })),
      ...(roll
        ? {
            total: roll.total,
            rollKey: `${turnNumber}:${roll.values.join('-')}`,
          }
        : {}),
    };
  }
  const movement = kits.movement;
  const trackDefinitions = components.filter(
    (component): component is TrackDefinition =>
      component.component === 'movement.track',
  );
  if (movement && Object.keys(movement.positions).length > 0) {
    extras.movement = {
      tracks: Object.fromEntries(
        Object.entries(movement.positions).map(([trackId, positions]) => {
          const track = trackDefinitions.find(
            (definition) => definition.id === trackId,
          );
          return [
          trackId,
          {
            spaces: track?.spaces ?? 0,
            overshoot:
              track?.overshoot ?? (track?.wrap ? 'wrap' : 'clamp'),
            positions: structuredClone(positions),
          },
          ];
        }),
      ),
    };
  }
  const pawns = kits.pawns;
  const pawnDefinitions = components.filter(
    (component): component is PawnSetDefinition =>
      component.component === 'pawn.set',
  );
  if (pawns && Object.keys(pawns.positions).length > 0) {
    extras.pawns = {
      sets: Object.fromEntries(
        Object.entries(pawns.positions).map(([setId, positions]) => {
          const definition = pawnDefinitions.find(
            (candidate) => candidate.id === setId,
          );
          return [
            setId,
            {
              definitions: structuredClone(definition?.pawns ?? []),
              owners: structuredClone(pawns.owners[setId] ?? {}),
              assignments: structuredClone(
                pawns.assignments[setId] ?? {},
              ),
              positions: structuredClone(positions),
            },
          ];
        }),
      ),
    };
  }
  if (kits.grid && Object.keys(kits.grid.cells).length > 0) {
    const gridDefinitions = components.filter(
      (component): component is GridDefinition =>
        component.component === 'grid.board',
    );
    extras.grid = {
      boards: Object.fromEntries(
        Object.entries(kits.grid.cells).map(([boardId, cells]) => [
          boardId,
          {
            ...structuredClone(
              gridDefinitions.find((definition) => definition.id === boardId),
            ),
            cells: structuredClone(cells),
          },
        ]),
      ),
    };
  }
  const quiz = kits.quiz;
  const quizDefinitions = new Map(
    components
      .filter(
        (component): component is QuizDefinition =>
          component.component === 'quiz.bank',
      )
      .map((definition) => [definition.id, definition]),
  );
  if (quiz && Object.keys(quiz.orders).length > 0) {
    extras.quiz = {
      banks: Object.fromEntries(
        Object.entries(quiz.orders).map(([bankId, order]) => {
          const cursor = quiz.cursors[bankId] ?? 0;
          return [
            bankId,
            {
              count: order.length,
              cursor,
              remaining: Math.max(0, order.length - cursor),
            },
          ];
        }),
      ),
      sessions: Object.fromEntries(
        Object.entries(quiz.sessions).map(([sessionId, session]) => [
          sessionId,
          {
            id: session.id,
            bankId: session.bankId,
            question: publicQuizQuestion(
              quizDefinitions.get(session.bankId),
              session.questionId,
            ),
            participantPlayerIds: [...session.participantPlayerIds],
            answeredPlayerIds: Object.keys(session.answers).map(Number),
            phase: session.phase,
            scored: session.scored,
            ...(session.phase === 'revealed' || session.phase === 'closed'
              ? {
                  answers: structuredClone(session.answers),
                  correctAnswerIndex: session.correctAnswerIndex,
                }
              : viewerPlayerId != null &&
                  session.answers[String(viewerPlayerId)] != null
                ? { myAnswer: session.answers[String(viewerPlayerId)] }
                : {}),
          },
        ]),
      ),
    };
  }
  return extras;
}

function publicQuizQuestion(
  definition: QuizDefinition | undefined,
  questionId: string,
): { id: string; prompt: string; choices: readonly string[] } {
  const question = definition?.questions.find(
    (candidate) => candidate.id === questionId,
  );
  if (!question) return { id: questionId, prompt: '', choices: [] };
  const { answerIndex: _answerIndex, ...publicQuestion } = question;
  return structuredClone(publicQuestion);
}
