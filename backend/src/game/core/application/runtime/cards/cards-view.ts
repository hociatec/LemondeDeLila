import type {
  CardSetsDefinition,
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
    completedSets: {},
  };
}

export function projectCardsKitState(
  state: CardsKitState,
  viewerPlayerId: number | null,
  definitions: readonly (HandsDefinition | CardSetsDefinition)[] = [],
): CardsPlayerView {
  const handDefinitions = new Map(
    definitions
      .filter(
        (definition): definition is HandsDefinition =>
          definition.component === 'cards.hands',
      )
      .map((definition) => [definition.id, definition]),
  );
  const setDefinitions = new Map(
    definitions
      .filter(
        (definition): definition is CardSetsDefinition =>
          definition.component === 'cards.sets',
      )
      .map((definition) => [definition.id, definition]),
  );
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
                visibility === 'public' || Number(playerId) === viewerPlayerId
                  ? structuredClone(cards)
                  : { count: cards.length },
              ]),
            ),
          },
        ];
      }),
    ),
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
