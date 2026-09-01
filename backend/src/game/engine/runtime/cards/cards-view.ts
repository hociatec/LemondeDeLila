import type {
  CardSetsDefinition,
  CardZoneDefinition,
  CardsKitState,
  CardsPlayerView,
  HandsDefinition,
} from './cards-contracts';

export function createCardsKitState(): CardsKitState {
  return {
    decks: {},
    discards: {},
    deckLifecycles: {},
    hands: {},
    zones: {},
    completedSets: {},
  };
}

export function projectCardsKitState(
  state: CardsKitState,
  viewerPlayerId: number | null,
  definitions: readonly (
    HandsDefinition | CardSetsDefinition | CardZoneDefinition
  )[] = [],
  roundInactivePlayerIds: readonly number[] = [],
): CardsPlayerView {
  const handDefinitions = indexHands(definitions);
  const setDefinitions = indexCardSets(definitions);
  const zoneDefinitions = indexCardZones(definitions);
  const inactiveRoundPlayers = new Set(roundInactivePlayerIds);
  return {
    decks: Object.fromEntries(
      Object.entries(state.decks).map(([id, cards]) => [
        id,
        { count: cards.length },
      ]),
    ),
    discards: Object.fromEntries(
      Object.entries(state.discards).map(([id, cards]) => [
        id,
        { count: cards.length, cards: structuredClone(cards) },
      ]),
    ),
    hands: Object.fromEntries(
      Object.entries(state.hands).map(([id, byPlayer]) => {
        const definition = handDefinitions.get(id);
        const visibility = definition?.visibility ?? 'owner';
        return [
          id,
          {
            visibility,
            byPlayer: Object.fromEntries(
              Object.entries(byPlayer).map(([playerId, cards]) => [
                playerId,
                visibility === 'public' ||
                (Number(playerId) === viewerPlayerId &&
                  (definition?.ownerVisibility !== 'active-round' ||
                    !inactiveRoundPlayers.has(Number(playerId))))
                  ? structuredClone(cards)
                  : { count: cards.length },
              ]),
            ),
          },
        ];
      }),
    ),
    zones: projectCardZones(state.zones, zoneDefinitions),
    collections: Object.fromEntries(
      Object.entries(state.completedSets).map(([id, byPlayer]) => {
        const visibility = setDefinitions.get(id)?.visibility ?? 'public';
        return [
          id,
          {
            visibility,
            byPlayer: Object.fromEntries(
              Object.entries(byPlayer).map(([playerId, setIds]) => [
                playerId,
                visibility === 'public' || Number(playerId) === viewerPlayerId
                  ? [...setIds]
                  : { count: setIds.length },
              ]),
            ),
          },
        ];
      }),
    ),
  };
}

function indexHands(
  definitions: readonly (
    HandsDefinition | CardSetsDefinition | CardZoneDefinition
  )[],
): Map<string, HandsDefinition> {
  return new Map(
    definitions
      .filter(
        (definition): definition is HandsDefinition =>
          definition.component === 'cards.hands',
      )
      .map((definition) => [definition.id, definition]),
  );
}

function indexCardSets(
  definitions: readonly (
    HandsDefinition | CardSetsDefinition | CardZoneDefinition
  )[],
): Map<string, CardSetsDefinition> {
  return new Map(
    definitions
      .filter(
        (definition): definition is CardSetsDefinition =>
          definition.component === 'cards.sets',
      )
      .map((definition) => [definition.id, definition]),
  );
}

function indexCardZones(
  definitions: readonly (
    HandsDefinition | CardSetsDefinition | CardZoneDefinition
  )[],
): Map<string, CardZoneDefinition> {
  return new Map(
    definitions
      .filter(
        (definition): definition is CardZoneDefinition =>
          definition.component === 'cards.zone',
      )
      .map((definition) => [definition.id, definition]),
  );
}

function projectCardZones(
  zones: CardsKitState['zones'],
  definitions: ReadonlyMap<string, CardZoneDefinition>,
): CardsPlayerView['zones'] {
  return Object.fromEntries(
    Object.entries(zones).map(([id, cards]) => {
      const visibility = definitions.get(id)?.visibility ?? 'hidden';
      return [
        id,
        {
          visibility,
          cards:
            visibility === 'public'
              ? structuredClone(cards)
              : { count: cards.length },
        },
      ];
    }),
  );
}
