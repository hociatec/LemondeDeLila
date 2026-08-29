import {
  GameNotFoundError,
  GameRuleViolationError,
} from '../../../domain/errors/game-domain.errors';
import type { CardValue } from './cards-contracts';
import { GameCardsDeckController } from './cards-deck-controller';

export class GameCardsController extends GameCardsDeckController {
  give<TCard>(handId: string, playerId: number, card: TCard): void {
    const hands = (this.state.hands[handId] ??= {});
    const hand = (hands[String(playerId)] ??= []);
    const deckId = this.handDefinitions.get(handId)?.deck;
    hand.push(
      deckId ? this.toPersistentCard(deckId, card) : (card as CardValue),
    );
    this.emit(
      'card.received',
      { handId, playerId },
      {
        kind: 'split',
        privateDataByPlayer: { [String(playerId)]: { card } },
      },
    );
  }

  play<TCard>(
    handId: string,
    deckId: string,
    playerId: number,
    card: TCard,
  ): void {
    const hand = this.persistentHand(handId, playerId);
    const persistentCard = this.toPersistentCard(deckId, card);
    const index = hand.findIndex((candidate) =>
      Object.is(candidate, persistentCard),
    );
    if (index < 0) {
      throw new GameRuleViolationError(
        'CARD_NOT_IN_HAND',
        { handId, playerId },
        'Carte absente de la main',
      );
    }
    const [played] = hand.splice(index, 1);
    (this.state.discards[deckId] ??= []).push(played);
    this.emit('card.played', {
      handId,
      deckId,
      playerId,
      card: this.fromPersistentCard(deckId, played),
    });
  }

  hand<TCard>(handId: string, playerId: number): TCard[] {
    const deckId = this.handDefinitions.get(handId)?.deck;
    const hand = this.persistentHand(handId, playerId);
    if (!deckId) return structuredClone(hand) as TCard[];
    return hand.map((card) => this.fromPersistentCard<TCard>(deckId, card));
  }

  take<TCard>(handId: string, playerId: number, card: TCard): TCard {
    const definition = this.handDefinitions.get(handId);
    const hand = this.persistentHand(handId, playerId);
    const persistentCard = definition
      ? this.toPersistentCard(definition.deck, card)
      : card;
    const index = hand.findIndex((candidate) =>
      Object.is(candidate, persistentCard),
    );
    if (index < 0) {
      throw new GameRuleViolationError(
        'CARD_NOT_IN_HAND',
        { handId, playerId },
        'Carte absente de la main',
      );
    }
    const [taken] = hand.splice(index, 1);
    return definition
      ? this.fromPersistentCard<TCard>(definition.deck, taken)
      : (structuredClone(taken) as TCard);
  }

  discardFromHand<TCard>(
    handId: string,
    deckId: string,
    playerId: number,
    card: TCard,
  ): TCard {
    const discarded = this.take(handId, playerId, card);
    this.discard(deckId, discarded);
    return discarded;
  }

  exchange<TCard>(
    handId: string,
    leftPlayerId: number,
    leftCard: TCard,
    rightPlayerId: number,
    rightCard: TCard,
  ): void {
    const leftHand = this.hand<TCard>(handId, leftPlayerId);
    const rightHand = this.hand<TCard>(handId, rightPlayerId);
    if (!leftHand.some((card) => Object.is(card, leftCard))) {
      throw new GameRuleViolationError('CARD_NOT_IN_HAND', {
        handId,
        playerId: leftPlayerId,
      });
    }
    if (!rightHand.some((card) => Object.is(card, rightCard))) {
      throw new GameRuleViolationError('CARD_NOT_IN_HAND', {
        handId,
        playerId: rightPlayerId,
      });
    }
    const takenLeft = this.take(handId, leftPlayerId, leftCard);
    const takenRight = this.take(handId, rightPlayerId, rightCard);
    this.give(handId, leftPlayerId, takenRight);
    this.give(handId, rightPlayerId, takenLeft);
    this.emit('cards.exchanged', {
      handId,
      leftPlayerId,
      rightPlayerId,
    });
  }

  shuffleHands(handId: string, playerIds: readonly number[]): void {
    const sizes = playerIds.map(
      (playerId) => this.persistentHand(handId, playerId).length,
    );
    const shuffled = this.random.shuffle(
      playerIds.flatMap((playerId) => this.persistentHand(handId, playerId)),
    );
    let cursor = 0;
    for (const [index, playerId] of playerIds.entries()) {
      const size = sizes[index] ?? 0;
      this.state.hands[handId][String(playerId)] = shuffled.slice(
        cursor,
        cursor + size,
      );
      cursor += size;
    }
    this.emit('cards.hands-shuffled', { handId, playerIds: [...playerIds] });
  }

  transfer<TCard>(
    handId: string,
    fromPlayerId: number,
    toPlayerId: number,
    card: TCard,
  ): void {
    const transferred = this.take(handId, fromPlayerId, card);
    this.give(handId, toPlayerId, transferred);
    this.emit('card.transferred', {
      handId,
      fromPlayerId,
      toPlayerId,
    });
  }

  exchangeRandom<TCard>(
    handId: string,
    leftPlayerId: number,
    rightPlayerId: number,
  ): void {
    if (leftPlayerId === rightPlayerId) return;
    const leftCard = this.random.pick(this.hand<TCard>(handId, leftPlayerId));
    const rightCard = this.random.pick(this.hand<TCard>(handId, rightPlayerId));
    if (leftCard && rightCard) {
      this.exchange(handId, leftPlayerId, leftCard, rightPlayerId, rightCard);
      return;
    }
    if (leftCard) this.transfer(handId, leftPlayerId, rightPlayerId, leftCard);
    else if (rightCard)
      this.transfer(handId, rightPlayerId, leftPlayerId, rightCard);
  }

  stealRandom<TCard>(
    handId: string,
    fromPlayerId: number,
    toPlayerId: number,
  ): TCard | null {
    const card = this.random.shuffle(this.hand<TCard>(handId, fromPlayerId))[0];
    if (card == null) return null;
    this.transfer(handId, fromPlayerId, toPlayerId, card);
    return card;
  }

  swapHands(handId: string, leftPlayerId: number, rightPlayerId: number): void {
    const hands = (this.state.hands[handId] ??= {});
    const left = hands[String(leftPlayerId)] ?? [];
    const right = hands[String(rightPlayerId)] ?? [];
    hands[String(leftPlayerId)] = right;
    hands[String(rightPlayerId)] = left;
    this.emit('cards.hands-swapped', {
      handId,
      leftPlayerId,
      rightPlayerId,
    });
  }

  discardRandom<TCard>(
    handId: string,
    deckId: string,
    playerId: number,
  ): TCard | null {
    const card = this.random.shuffle(this.hand<TCard>(handId, playerId))[0];
    if (card == null) return null;
    this.play(handId, deckId, playerId, card);
    return card;
  }

  handCounts(handId: string): Record<number, number> {
    const hands = this.state.hands[handId] ?? {};
    return Object.fromEntries(
      Object.entries(hands).map(([playerId, cards]) => [
        Number(playerId),
        cards.length,
      ]),
    );
  }

  setIds(collectionId: string): string[] {
    return Object.keys(this.requireSets(collectionId).sets);
  }

  missingFromSet(
    collectionId: string,
    setId: string,
    playerId: number,
  ): string[] {
    const definition = this.requireSets(collectionId);
    const required = definition.sets[setId];
    if (!required) {
      throw new GameNotFoundError(`Famille de cartes inconnue: ${setId}`);
    }
    const available = [...this.hand<string>(definition.hand, playerId)];
    return required.filter((cardId) => {
      const index = available.indexOf(cardId);
      if (index < 0) return true;
      available.splice(index, 1);
      return false;
    });
  }

  completableSets(collectionId: string, playerId: number): string[] {
    const completed = new Set(this.playerCompletedSets(collectionId, playerId));
    return this.setIds(collectionId).filter(
      (setId) =>
        !completed.has(setId) &&
        this.missingFromSet(collectionId, setId, playerId).length === 0,
    );
  }

  completeSet(
    collectionId: string,
    playerId: number,
    setId: string,
    options: {
      allowIncomplete?: boolean;
      consume?: boolean;
      discard?: boolean;
    } = {},
  ): boolean {
    const definition = this.requireSets(collectionId);
    const completed = this.playerCompletedSets(collectionId, playerId);
    if (completed.includes(setId)) return false;
    const required = definition.sets[setId];
    if (!required) {
      throw new GameNotFoundError(`Famille de cartes inconnue: ${setId}`);
    }
    const present = required.filter((cardId) =>
      this.hand<string>(definition.hand, playerId).includes(cardId),
    );
    if (!options.allowIncomplete && present.length !== required.length) {
      return false;
    }
    if (options.consume ?? true) {
      for (const cardId of present) {
        if (options.discard ?? true) {
          this.discardFromHand(
            definition.hand,
            definition.deck,
            playerId,
            cardId,
          );
        } else {
          this.take(definition.hand, playerId, cardId);
        }
      }
    }
    completed.push(setId);
    this.emit('cards.set-completed', { collectionId, playerId, setId });
    return true;
  }

  playerCompletedSets(collectionId: string, playerId: number): string[] {
    const byPlayer = (this.state.completedSets[collectionId] ??= {});
    return (byPlayer[String(playerId)] ??= []);
  }

  completedSetCounts(collectionId: string): Record<number, number> {
    const byPlayer = this.state.completedSets[collectionId] ?? {};
    return Object.fromEntries(
      Object.entries(byPlayer).map(([playerId, setIds]) => [
        Number(playerId),
        setIds.length,
      ]),
    );
  }

  deal(
    deckId: string,
    handId: string,
    playerIds: readonly number[],
    count: number,
  ): void {
    for (let round = 0; round < Math.max(0, count); round += 1) {
      for (const playerId of playerIds) {
        if (this.drawToHand(deckId, handId, playerId) == null) return;
      }
    }
  }
}
