import { copyState } from '../contracts/state-copy';
import type { ReadonlyState } from '../contracts/state-copy';
import type {
  CardSetsDefinition,
  CardValue,
  CardZoneDefinition,
  CardsKitState,
  CardsPlayerView,
  DeckDefinition,
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
  state: ReadonlyState<CardsKitState>,
  viewerPlayerId: number | null,
  definitions: readonly (
    | DeckDefinition<CardValue>
    | HandsDefinition
    | CardSetsDefinition
    | CardZoneDefinition
  )[] = [],
  roundInactivePlayerIds: readonly number[] = [],
): CardsPlayerView {
  const handDefinitions = indexHands(definitions);
  const deckDefinitions = indexDecks(definitions);
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
        {
          count: cards.length,
          cards: projectCards(cards, deckDefinitions.get(id)),
        },
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
                  ? projectCards(
                      cards,
                      deckDefinitions.get(definition?.deck ?? ''),
                    )
                  : { count: cards.length },
              ]),
            ),
          },
        ];
      }),
    ),
    zones: projectCardZones(state.zones, zoneDefinitions, deckDefinitions),
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

function indexDecks(
  definitions: readonly (
    | DeckDefinition<CardValue>
    | HandsDefinition
    | CardSetsDefinition
    | CardZoneDefinition
  )[],
): Map<string, DeckDefinition<CardValue>> {
  return new Map(
    definitions
      .filter(
        (definition): definition is DeckDefinition<CardValue> =>
          definition.component === 'cards.deck',
      )
      .map((definition) => [definition.id, definition]),
  );
}

function projectCards(
  cards: ReadonlyState<CardsKitState['decks'][string]>,
  definition: DeckDefinition<CardValue> | undefined,
) {
  const catalog = definition?.catalog ?? definition?.cards ?? [];
  const byId = new Map(
    catalog
      .filter(
        (card): card is { id: string | number } =>
          typeof card === 'object' && card != null && 'id' in card,
      )
      .map((card) => [String(card.id), card]),
  );
  return cards.map((card) =>
    typeof card === 'string' || typeof card === 'number'
      ? copyState(byId.get(String(card)) ?? card)
      : copyState(card),
  );
}

function indexHands(
  definitions: readonly (
    | DeckDefinition<CardValue>
    | HandsDefinition
    | CardSetsDefinition
    | CardZoneDefinition
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
    | DeckDefinition<CardValue>
    | HandsDefinition
    | CardSetsDefinition
    | CardZoneDefinition
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
    | DeckDefinition<CardValue>
    | HandsDefinition
    | CardSetsDefinition
    | CardZoneDefinition
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
  zones: ReadonlyState<CardsKitState['zones']>,
  definitions: ReadonlyMap<string, CardZoneDefinition>,
  decks: ReadonlyMap<string, DeckDefinition<CardValue>>,
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
              ? projectCards(cards, decks.get(definitions.get(id)?.deck ?? ''))
              : { count: cards.length },
        },
      ];
    }),
  );
}
