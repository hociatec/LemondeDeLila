import { assertGameScheduler } from '../automation/scheduler-contracts';
import { assertSerializableState } from './assert-serializable-state';
import {
  assertGameCount,
  assertPlayerValues,
} from '../kits/numeric-invariants';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { DeclarativeState, EngineKitsState } from './declarative-state';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type {
  CardSetsDefinition,
  CardZoneDefinition,
  HandsDefinition,
} from '../cards/cards-kit';
import type { TrackDefinition } from '../kits/movement-kit';
import type { DiceDefinition } from '../kits/dice-kit';
import { assertDiceRoll } from '../kits/dice-roll-contract';
import type { GridDefinition } from '../kits/grid-kit';
import type { PawnSetDefinition } from '../kits/pawn-kit';

export function assertValidGameSession<TState extends object>(
  runtime: DeclarativeState<TState>,
  components: readonly GameComponentDefinition[] = [],
): void {
  assertSerializableState(runtime);
  assertPlayerValues(runtime.engine.playerValues);
  assertValidEngineKits(runtime.engine.kits, components);
  assertGameScheduler(runtime.engine.scheduler);
  invariant(
    typeof runtime.engine.configuration.complete === 'boolean',
    'configuration.complete',
    { complete: runtime.engine.configuration.complete },
  );
  invariant(
    runtime.engine.configuration.ownerPlayerId == null ||
      (runtime.players ?? []).some(
        (player) => player.id === runtime.engine.configuration.ownerPlayerId,
      ),
    'configuration.owner',
    { ownerPlayerId: runtime.engine.configuration.ownerPlayerId },
  );
}

export function assertValidEngineKits(
  kits: EngineKitsState,
  components: readonly GameComponentDefinition[] = [],
): void {
  assertValidCardsKit(kits, components);
  assertValidMovementKit(kits, components);
  assertValidPawnKit(kits, components);
  assertValidDiceKit(kits, components);
  assertValidGridAndQuizKits(kits, components);
}

function assertValidCardsKit(
  kits: EngineKitsState,
  components: readonly GameComponentDefinition[] = [],
): void {
  const cardsKit = kits.cards;
  const { handDefinitions, setDefinitions } = indexCardDefinitions(components);
  for (const [deckId, cards] of Object.entries(cardsKit?.decks ?? {})) {
    invariant(Array.isArray(cards), 'cards.deck', { deckId });
  }
  for (const [deckId, cards] of Object.entries(cardsKit?.discards ?? {})) {
    invariant(Array.isArray(cards), 'cards.discard', { deckId });
  }
  for (const [handId, byPlayer] of Object.entries(cardsKit?.hands ?? {})) {
    const definition = handDefinitions.get(handId);
    invariant(definition != null, 'cards.hand-definition', { handId });
    invariant(definition.deck in (cardsKit?.decks ?? {}), 'cards.hand-deck', {
      handId,
      deckId: definition.deck,
    });
    for (const [playerId, cards] of Object.entries(byPlayer)) {
      invariant(Array.isArray(cards), 'cards.hand', { handId, playerId });
    }
  }
  assertValidCardZones(cardsKit, components);
  for (const [collectionId, definition] of Object.entries(
    Object.fromEntries(setDefinitions),
  )) {
    invariant(definition.hand in (cardsKit?.hands ?? {}), 'cards.sets-hand', {
      collectionId,
      handId: definition.hand,
    });
    invariant(definition.deck in (cardsKit?.decks ?? {}), 'cards.sets-deck', {
      collectionId,
      deckId: definition.deck,
    });
    const knownSets = new Set(Object.keys(definition.sets));
    for (const [playerId, completed] of Object.entries(
      cardsKit?.completedSets[collectionId] ?? {},
    )) {
      invariant(
        completed.every((setId) => knownSets.has(setId)),
        'cards.completed-set',
        { collectionId, playerId },
      );
    }
  }
}

function assertValidMovementKit(
  kits: EngineKitsState,
  components: readonly GameComponentDefinition[],
): void {
  const movementKit = kits.movement;
  const trackDefinitions = new Map(
    components
      .filter(
        (component): component is TrackDefinition =>
          component.component === 'movement.track',
      )
      .map((definition) => [definition.id, definition]),
  );
  for (const [trackId, positions] of Object.entries(
    movementKit?.positions ?? {},
  )) {
    const track = trackDefinitions.get(trackId);
    invariant(
      track != null && Number.isInteger(track.spaces) && track.spaces > 0,
      'movement.track',
      { trackId, spaces: track?.spaces },
    );
    for (const [playerId, position] of Object.entries(positions)) {
      invariant(
        Number.isInteger(position) && position >= 0 && position < track.spaces,
        'movement.position',
        { trackId, playerId, position },
      );
    }
  }
}

function assertValidPawnKit(
  kits: EngineKitsState,
  components: readonly GameComponentDefinition[],
): void {
  const pawnKit = kits.pawns;
  const pawnDefinitions = new Map(
    components
      .filter(
        (component): component is PawnSetDefinition =>
          component.component === 'pawn.set',
      )
      .map((definition) => [definition.id, definition]),
  );
  for (const setId of Object.keys(pawnKit?.positions ?? {})) {
    const set = pawnDefinitions.get(setId);
    invariant(set != null, 'pawn.set', { setId });
    const pawnIds = new Set(set.pawns.map((pawn) => pawn.id));
    invariant(pawnIds.size === set.pawns.length, 'pawn.definition', { setId });
    for (const [pawnId, playerId] of Object.entries(
      pawnKit?.owners[setId] ?? {},
    )) {
      invariant(pawnIds.has(pawnId), 'pawn.owner', {
        setId,
        pawnId,
        playerId,
      });
    }
    for (const pawnId of Object.keys(pawnKit?.positions[setId] ?? {})) {
      invariant(pawnIds.has(pawnId), 'pawn.position', { setId, pawnId });
    }
  }
}

function assertValidDiceKit(
  kits: EngineKitsState,
  components: readonly GameComponentDefinition[],
): void {
  const diceKit = kits.dice;
  if (diceKit?.sequence != null) assertGameCount(diceKit.sequence);
  const diceDefinitions = new Map(
    components
      .filter(
        (component): component is DiceDefinition =>
          component.component === 'dice.set',
      )
      .map((definition) => [definition.id, definition]),
  );
  const rolls = [
    diceKit?.rolls ?? {},
    ...Object.values(diceKit?.rollsByPlayer ?? {}),
  ];
  for (const [diceId, roll] of rolls.flatMap((collection) =>
    Object.entries(collection),
  )) {
    const definition = diceDefinitions.get(diceId);
    invariant(
      definition != null &&
        Number.isInteger(definition.count) &&
        definition.count > 0 &&
        Number.isInteger(definition.sides) &&
        definition.sides >= 2,
      'dice.definition',
      { diceId },
    );
    assertDiceRoll(diceId, roll, definition);
  }
}

function assertValidGridAndQuizKits(
  kits: EngineKitsState,
  components: readonly GameComponentDefinition[],
): void {
  const gridDefinitions = new Map(
    components
      .filter(
        (component): component is GridDefinition =>
          component.component === 'grid.board',
      )
      .map((definition) => [definition.id, definition]),
  );
  for (const boardId of Object.keys(kits.grid?.cells ?? {})) {
    const board = gridDefinitions.get(boardId);
    invariant(
      board != null &&
        Number.isInteger(board.width) &&
        board.width > 0 &&
        Number.isInteger(board.height) &&
        board.height > 0,
      'grid.board',
      { boardId },
    );
  }
  for (const [bankId, cursor] of Object.entries(kits.quiz?.cursors ?? {})) {
    invariant(
      Number.isInteger(cursor) &&
        cursor >= 0 &&
        cursor <= (kits.quiz?.orders[bankId]?.length ?? 0),
      'quiz.cursor',
      { bankId, cursor },
    );
  }
}

function indexCardDefinitions(components: readonly GameComponentDefinition[]): {
  handDefinitions: Map<string, HandsDefinition>;
  setDefinitions: Map<string, CardSetsDefinition>;
} {
  return {
    handDefinitions: new Map(
      components
        .filter(
          (component): component is HandsDefinition =>
            component.component === 'cards.hands',
        )
        .map((component) => [component.id, component]),
    ),
    setDefinitions: new Map(
      components
        .filter(
          (component): component is CardSetsDefinition =>
            component.component === 'cards.sets',
        )
        .map((component) => [component.id, component]),
    ),
  };
}

function assertValidCardZones(
  cardsKit: EngineKitsState['cards'],
  components: readonly GameComponentDefinition[],
): void {
  const definitions = new Map(
    components
      .filter(
        (component): component is CardZoneDefinition =>
          component.component === 'cards.zone',
      )
      .map((component) => [component.id, component]),
  );
  for (const [zoneId, cards] of Object.entries(cardsKit?.zones ?? {})) {
    const definition = definitions.get(zoneId);
    invariant(definition != null, 'cards.zone-definition', { zoneId });
    invariant(definition.deck in (cardsKit?.decks ?? {}), 'cards.zone-deck', {
      zoneId,
      deckId: definition.deck,
    });
    invariant(Array.isArray(cards), 'cards.zone', { zoneId });
  }
}

function invariant(
  condition: boolean,
  contract: string,
  details: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    throw new GameStateViolationError(
      `Postcondition moteur invalide: ${contract}`,
      { contract, ...details },
    );
  }
}
