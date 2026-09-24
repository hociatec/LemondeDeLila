import { GameCardsDeckController } from './cards-deck-controller';
import type { CardId, CardValue } from './cards-contracts';
import type { CardLocation } from '../contracts/card-location';
import {
  GameNotFoundError,
  GameRuleViolationError,
} from '../contracts/game-domain.errors';
import { assertGamePlayerId } from '../kits/numeric-invariants';

/** Moves exactly one canonical card; validates both containers before mutation. */
export abstract class GameCardsLocationController extends GameCardsDeckController {
  moveCard(
    source: CardLocation,
    destination: CardLocation,
    cardId: CardId,
  ): CardValue {
    const from = this.location(source),
      to = this.location(destination);
    const index = from.cards.findIndex((persistent) => {
      const card = this.fromPersistentCard<CardValue>(from.deckId, persistent);
      return (
        (typeof card === 'object' && card !== null && 'id' in card
          ? card.id
          : card) === cardId
      );
    });
    if (index < 0)
      throw new GameRuleViolationError('CARD_NOT_IN_LOCATION', {
        source,
        cardId,
      });
    const card = this.fromPersistentCard<CardValue>(
      from.deckId,
      from.cards[index],
    );
    const persistent = this.toPersistentCard(to.deckId, card);
    if (from.cards === to.cards) return card;
    from.cards.splice(index, 1);
    to.cards.push(persistent);
    if (source.kind === 'deck') this.lifecycle(source.deckId).exhausted = false;
    if (destination.kind === 'deck')
      this.lifecycle(destination.deckId).exhausted = false;
    const publicCard = from.visible || to.visible;
    const privateDataByPlayer = Object.fromEntries(
      [source, destination].flatMap((location) =>
        location.kind === 'hand' ? [[String(location.playerId), { card }]] : [],
      ),
    );
    this.emit(
      'card.moved',
      { source, destination, ...(publicCard ? { card } : {}) },
      publicCard ? { kind: 'public' } : { kind: 'split', privateDataByPlayer },
    );
    return card;
  }

  private location(location: CardLocation): {
    deckId: string;
    cards: CardValue[];
    visible: boolean;
  } {
    if (location.kind === 'hand') {
      assertGamePlayerId(location.playerId);
      const definition = this.handDefinitions.get(location.handId);
      const cards =
        this.state.hands[location.handId]?.[String(location.playerId)];
      if (!definition || !cards)
        throw new GameNotFoundError('Unknown card hand');
      return {
        deckId: definition.deck,
        cards,
        visible: definition.visibility === 'public',
      };
    }
    if (location.kind === 'zone') {
      const definition = this.zoneDefinitions.get(location.zoneId);
      const cards = this.state.zones[location.zoneId];
      if (!definition || !cards)
        throw new GameNotFoundError('Unknown card zone');
      return {
        deckId: definition.deck,
        cards,
        visible: definition.visibility === 'public',
      };
    }
    const deckId = location.deckId;
    if (!Object.hasOwn(this.state.decks, deckId))
      throw new GameNotFoundError('Unknown card deck');
    const cards =
      location.kind === 'deck'
        ? this.state.decks[deckId]
        : this.state.discards[deckId];
    if (!cards) throw new GameNotFoundError('Unknown card container');
    return { deckId, cards, visible: location.kind === 'discard' };
  }
}
