import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
import { authoringProperty } from '../contracts/authoring-diagnostics';
import { assertThemedSetCollectionReferences } from './json-collection-pattern-reference-validation';

type Failure = (path: string, reason: string) => never;

export function assertJsonPatternReferences(
  patterns: readonly JsonGamePattern[] | undefined,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
  maximumPlayers: number,
  fail: Failure,
): void {
  for (const [index, pattern] of (patterns ?? []).entries()) {
    if (pattern.kind === 'race' && pattern.delivery)
      assertDeliveryReferences(pattern.delivery, index, components, fail);
    if (pattern.kind === 'ordered-card-collection')
      assertOrderedCollectionReferences(
        pattern,
        index,
        components,
        resources,
        fail,
      );
    if (pattern.kind === 'event-card-race')
      assertEventCardRaceReferences(
        pattern,
        index,
        components,
        phases,
        initialPhase,
        maximumPlayers,
        fail,
      );
    if (pattern.kind === 'goose-race')
      assertGooseRaceReferences(
        pattern,
        index,
        components,
        phases,
        initialPhase,
        maximumPlayers,
        fail,
      );
    if (pattern.kind === 'card-battle')
      assertCardBattleReferences(pattern, index, components, fail);
    if (pattern.kind === 'track-zone-collection')
      assertTrackZoneCollectionReferences(
        pattern,
        index,
        components,
        resources,
        fail,
      );
    if (pattern.kind === 'themed-set-collection')
      assertThemedSetCollectionReferences(pattern, index, components, fail);
  }
}

function assertTrackZoneCollectionReferences(
  pattern: Extract<JsonGamePattern, { kind: 'track-zone-collection' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === pattern.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== pattern.tiles.length
  )
    fail(`${root}.trackId`, 'one tile per track position required');
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === pattern.diceId,
    )
  )
    fail(`${root}.diceId`, 'unknown dice');
  if (pattern.tiles.at(-1)?.type !== 'finish')
    fail(
      `${root}.tiles[${pattern.tiles.length - 1}].type`,
      'last tile must finish the race',
    );
  const zoneIds = new Set<number>();
  for (const [index, zone] of pattern.zones.entries()) {
    if (zoneIds.has(zone.id))
      fail(`${root}.zones[${index}].id`, 'duplicate zone');
    zoneIds.add(zone.id);
    if (zone.minimumTile > zone.maximumTile)
      fail(`${root}.zones[${index}].maximumTile`, 'inverted zone range');
    if (!resources.has(zone.resourceId))
      fail(`${root}.zones[${index}].resourceId`, 'unknown zone resource');
    const deck = components.find(
      (component) =>
        component.component === 'cards.deck' && component.id === zone.deckId,
    );
    if (deck?.component !== 'cards.deck') {
      fail(`${root}.zones[${index}].deckId`, 'unknown zone deck');
      continue;
    }
    if (
      deck.cards.some(
        (card) =>
          card === null ||
          typeof card !== 'object' ||
          !('id' in card) ||
          !('attributes' in card) ||
          card.attributes === null ||
          typeof card.attributes !== 'object' ||
          Reflect.get(card.attributes, 'zoneId') !== zone.id,
      )
    )
      fail(
        `${root}.zones[${index}].deckId`,
        'zone cards require matching zoneId attributes',
      );
  }
}

function assertCardBattleReferences(
  pattern: Extract<JsonGamePattern, { kind: 'card-battle' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  assertUnique(
    pattern.cards.map((card) => card.id),
    `${root}.cards`,
    'id',
    fail,
  );
  if (pattern.totalCards !== pattern.cards.length)
    fail(`${root}.totalCards`, 'totalCards must match the card catalogue');
  requireDeck(pattern.deckId, `${root}.deckId`, components, fail);
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' && component.id === pattern.handId,
  );
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
}

function assertGooseRaceReferences(
  pattern: Extract<JsonGamePattern, { kind: 'goose-race' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
  maximumPlayers: number,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  for (const [index, tile] of pattern.tiles.entries())
    if (!Object.hasOwn(pattern.tileRules, tile.type))
      fail(`${root}.tiles[${index}].type`, 'unknown tile rule');
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === pattern.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== pattern.tiles.length ||
    track.overshoot !== 'bounce'
  )
    fail(`${root}.trackId`, 'matching bounce track required');
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === pattern.diceId,
    )
  )
    fail(`${root}.diceId`, 'unknown dice');
  const pawns = components.find(
    (component) =>
      component.component === 'pawn.set' &&
      component.id === pattern.pawnSelection.setId,
  );
  if (
    pawns?.component !== 'pawn.set' ||
    pawns.perPlayer !== 1 ||
    pawns.pawns.length < maximumPlayers
  )
    fail(
      `${root}.pawnSelection.setId`,
      'one available pawn per player required',
    );
  if (
    initialPhase === pattern.playingPhase ||
    !phases[initialPhase]?.transitions?.includes(pattern.playingPhase)
  )
    fail(`${root}.playingPhase`, 'setup must transition to the playing phase');
  for (const [field, value] of [
    ['defaultReturn', pattern.defaultReturn],
    ['bridgeDestination', pattern.bridgeDestination],
  ] as const)
    if (value >= pattern.tiles.length)
      fail(`${root}.${field}`, 'destination outside track');
  for (const [index, tile] of pattern.tiles.entries())
    if (tile.backTo !== undefined && tile.backTo >= pattern.tiles.length)
      fail(`${root}.tiles[${index}].backTo`, 'back destination outside track');
}

function assertEventCardRaceReferences(
  pattern: Extract<JsonGamePattern, { kind: 'event-card-race' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
  maximumPlayers: number,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === pattern.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== pattern.tiles.length
  )
    fail(`${root}.trackId`, 'one tile per track position required');
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === pattern.diceId,
    )
  )
    fail(`${root}.diceId`, 'unknown dice');
  for (const [index, tile] of pattern.tiles.entries()) {
    if (!tile.deckId) continue;
    const deck = requireDeck(
      tile.deckId,
      `${root}.tiles[${index}].deckId`,
      components,
      fail,
    );
    if (
      deck.cards.some(
        (card) =>
          card == null ||
          typeof card !== 'object' ||
          !('id' in card) ||
          !('effects' in card) ||
          ('deck' in card && card.deck !== tile.deckId),
      )
    )
      fail(
        `${root}.tiles[${index}].deckId`,
        'event cards require identifiers, effects and a matching deck',
      );
  }
  const pawnSet = components.find(
    (component) =>
      component.component === 'pawn.set' &&
      component.id === pattern.pawnSelection.setId,
  );
  if (
    pawnSet?.component !== 'pawn.set' ||
    pawnSet.perPlayer !== 1 ||
    pawnSet.pawns.length < maximumPlayers
  )
    fail(
      `${root}.pawnSelection.setId`,
      'one available pawn per player required',
    );
  if (
    initialPhase === pattern.playingPhase ||
    !phases[initialPhase]?.transitions?.includes(pattern.playingPhase)
  )
    fail(`${root}.playingPhase`, 'setup must transition to the playing phase');
}

function assertOrderedCollectionReferences(
  pattern: Extract<JsonGamePattern, { kind: 'ordered-card-collection' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  requireDeck(pattern.deckId, `${root}.deckId`, components, fail);
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' && component.id === pattern.handId,
  );
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
  assertUnique(
    pattern.cards.map((card) => card.id),
    `${root}.cards`,
    'id',
    fail,
  );
  assertUnique(
    pattern.cards.map((card) => card.value),
    `${root}.cards`,
    'value',
    fail,
  );
  assertUnique(pattern.sequence, `${root}.sequence`, null, fail);
  const values = new Set(pattern.cards.map((card) => card.value));
  for (const [index, value] of pattern.sequence.entries())
    if (!values.has(value))
      fail(`${root}.sequence[${index}]`, 'unknown card value');
  if (pattern.sequence.length !== values.size)
    fail(`${root}.sequence`, 'sequence must contain every card value');
  for (const [value, reward] of Object.entries(pattern.rewards)) {
    if (!values.has(value))
      fail(authoringProperty(`${root}.rewards`, value), 'unknown card value');
    for (const resource of Object.keys(reward))
      if (!resources.has(resource))
        fail(
          authoringProperty(`${root}.rewards`, resource),
          'unknown reward resource',
        );
  }
  for (const resource of Object.keys(pattern.resourceValues))
    if (!resources.has(resource))
      fail(
        authoringProperty(`${root}.resourceValues`, resource),
        'unknown scored resource',
      );
}

function assertUnique(
  values: readonly string[],
  root: string,
  member: string | null,
  fail: Failure,
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value))
      fail(`${root}[${index}]${member ? `.${member}` : ''}`, 'duplicate value');
    seen.add(value);
  }
}

function assertDeliveryReferences(
  delivery: NonNullable<Extract<JsonGamePattern, { kind: 'race' }>['delivery']>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}].delivery`;
  const clientDeck = requireDeck(
    delivery.clientDeckId,
    `${root}.clientDeckId`,
    components,
    fail,
  );
  const eventDeck = requireDeck(
    delivery.eventDeckId,
    `${root}.eventDeckId`,
    components,
    fail,
  );
  assertNumericCardAttribute(
    clientDeck.cards,
    delivery.destinationAttribute,
    `${root}.destinationAttribute`,
    fail,
  );
  assertNumericCardAttribute(
    eventDeck.cards,
    delivery.blockedPositionAttribute,
    `${root}.blockedPositionAttribute`,
    fail,
  );
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' &&
      component.id === delivery.clientHandId,
  );
  if (
    hand?.component !== 'cards.hands' ||
    hand.deck !== delivery.clientDeckId ||
    hand.initial !== 0
  )
    fail(
      `${root}.clientHandId`,
      'client hand must use the client deck and start empty',
    );
}

function requireDeck(
  id: string,
  path: string,
  components: readonly GameComponentDefinition[],
  fail: Failure,
) {
  const deck = components.find(
    (component) => component.component === 'cards.deck' && component.id === id,
  );
  if (deck?.component !== 'cards.deck') fail(path, 'unknown card deck');
  return deck;
}

function assertNumericCardAttribute(
  cards: readonly unknown[],
  attribute: string,
  path: string,
  fail: Failure,
): void {
  for (const [index, card] of cards.entries()) {
    if (card == null || typeof card !== 'object')
      fail(path, `card ${index} must be an object`);
    const attributes = Reflect.get(card, 'attributes');
    if (
      attributes == null ||
      typeof attributes !== 'object' ||
      typeof Reflect.get(attributes, attribute) !== 'number'
    )
      fail(
        authoringProperty(path, attribute),
        `numeric card attribute required on card ${index}`,
      );
  }
}
