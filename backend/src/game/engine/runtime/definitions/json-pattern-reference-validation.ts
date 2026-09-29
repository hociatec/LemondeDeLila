import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
import { authoringProperty } from '../contracts/authoring-diagnostics';
import {
  assertFamilyEffectsReferences,
  assertFamilyRequestReferences,
  assertSpeciesTroopsReferences,
  assertThemedSetCollectionReferences,
} from './json-collection-pattern-reference-validation';
import { assertGridPlacementReferences } from './json-grid-pattern-reference-validation';
import { assertOrderedAssemblyReferences } from './json-ordered-assembly-reference-validation';
import { assertDeliveryReferences } from './json-delivery-pattern-reference-validation';
import { assertJudgedSubmissionReferences } from './json-judged-submission-reference-validation';
import { assertAnonymousVoteReferences } from './json-anonymous-vote-reference-validation';
import { assertTreasureTrackReferences } from './json-treasure-track-reference-validation';
import { assertPairedPawnRaceReferences } from './json-paired-pawn-race-reference-validation';
import { assertBounceQuizRaceReferences } from './json-bounce-quiz-race-reference-validation';
import { assertBidirectionalCollisionRaceReferences } from './json-bidirectional-collision-race-reference-validation';
import { assertCardBattleReferences } from './json-card-battle-reference-validation';
import { assertPublicDomainCardsReferences } from './json-public-domain-cards-reference-validation';
import { assertTeamPawnRaceReferences } from './json-team-pawn-race-reference-validation';
import { assertQuizEventRaceReferences } from './json-quiz-event-race-reference-validation';
import { assertMigratedPatternReferences } from './json-migrated-pattern-reference-validation';

type Failure = (path: string, reason: string) => never;
type AdvancedContext = {
  components: readonly GameComponentDefinition[];
  resources: ReadonlySet<string>;
  counters: ReadonlySet<string>;
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>;
  initialPhase: string;
  gameId: string;
  minimumPlayers: number;
  maximumPlayers: number;
  fail: Failure;
};

export function assertJsonPatternReferences(
  patterns: readonly JsonGamePattern[] | undefined,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
  gameId: string,
  minimumPlayers: number,
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
    assertAdvancedPatternReferences(pattern, index, {
      components,
      resources,
      counters,
      phases,
      initialPhase,
      gameId,
      minimumPlayers,
      maximumPlayers,
      fail,
    });
  }
}

function assertAdvancedPatternReferences(
  pattern: JsonGamePattern,
  index: number,
  context: AdvancedContext,
): void {
  const { components, resources, counters, phases, fail } = context;
  if (pattern.kind === 'anonymous-vote')
    assertAnonymousVoteReferences(pattern, index, fail);
  if (pattern.kind === 'treasure-track-race')
    assertTreasureTrackReferences(pattern, index, components, resources, fail);
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
  if (pattern.kind === 'family-request')
    assertFamilyRequestReferences(pattern, index, components, counters, fail);
  if (pattern.kind === 'family-effects')
    assertFamilyEffectsReferences(pattern, index, components, resources, fail);
  if (pattern.kind === 'species-troops')
    assertSpeciesTroopsReferences(pattern, index, components, fail);
  if (pattern.kind === 'paired-pawn-race')
    assertPairedPawnRaceReferences(pattern, index, components, resources, fail);
  if (pattern.kind === 'bounce-quiz-race')
    assertBounceQuizRaceReferences(pattern, index, components, fail);
  if (pattern.kind === 'bidirectional-collision-race')
    assertBidirectionalCollisionRaceReferences(
      pattern,
      index,
      components,
      resources,
      fail,
    );
  if (pattern.kind === 'public-domain-cards')
    assertPublicDomainCardsReferences(pattern, index, components, fail);
  if (pattern.kind === 'team-pawn-race')
    assertTeamPawnRaceReferences(pattern, index, components, fail);
  if (pattern.kind === 'quiz-event-race')
    assertQuizEventRaceReferences(pattern, index, components, fail);
  assertMigratedPatternReferences(pattern, index, context);
  if (pattern.kind === 'grid-placement')
    assertGridPlacementReferences(
      pattern,
      index,
      components,
      context.gameId,
      context.maximumPlayers,
      fail,
    );
  if (pattern.kind === 'ordered-assembly')
    assertOrderedAssemblyReferences(
      pattern,
      index,
      components,
      resources,
      counters,
      fail,
    );
  if (pattern.kind === 'judged-submission')
    assertJudgedSubmissionReferences(
      pattern,
      index,
      components,
      phases,
      context.initialPhase,
      context.minimumPlayers,
      fail,
    );
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
