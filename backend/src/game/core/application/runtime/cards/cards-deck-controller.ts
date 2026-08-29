import { GameRuleViolationError } from '../../../domain/errors/game-domain.errors';
import { GameCardsStateController } from './cards-state-controller';

export abstract class GameCardsDeckController extends GameCardsStateController {
  discard<TCard>(deckId: string, card: TCard): void {
    (this.state.discards[deckId] ??= []).push(
      this.toPersistentCard(deckId, card),
    );
    this.emit('card.discarded', { deckId, card });
  }

  deckCount(deckId: string): number {
    return this.state.decks[deckId]?.length ?? 0;
  }

  discardCount(deckId: string): number {
    return this.state.discards[deckId]?.length ?? 0;
  }

  discardPile<TCard>(deckId: string): TCard[] {
    return (this.state.discards[deckId] ?? []).map((card) =>
      this.fromPersistentCard<TCard>(deckId, card),
    );
  }

  takeDiscard<TCard>(deckId: string, card: TCard): TCard {
    const discard = this.state.discards[deckId] ?? [];
    const persistentCard = this.toPersistentCard(deckId, card);
    const index = discard.findIndex((candidate) =>
      Object.is(candidate, persistentCard),
    );
    if (index < 0) {
      throw new GameRuleViolationError(
        'CARD_NOT_IN_DISCARD',
        { deckId },
        'Carte absente de la défausse',
      );
    }
    const [taken] = discard.splice(index, 1);
    return this.fromPersistentCard<TCard>(deckId, taken);
  }

  draw<TCard>(deckId: string): TCard | null {
    const lifecycle = this.lifecycle(deckId);
    let card = this.drawOne<TCard>(deckId);
    if (card == null && lifecycle.empty === 'recycle') {
      this.recycle(deckId);
      card = this.drawOne<TCard>(deckId);
    }
    if (card == null) this.markExhausted(deckId);
    return card;
  }

  drawOrRecycle<TCard>(deckId: string): TCard | null {
    let card = this.drawOne<TCard>(deckId);
    if (card != null) return card;
    this.recycle(deckId);
    card = this.drawOne<TCard>(deckId);
    if (card == null) this.markExhausted(deckId);
    return card;
  }

  drawToHand<TCard>(
    deckId: string,
    handId: string,
    playerId: number,
    options: { recycle?: boolean } = {},
  ): TCard | null {
    const card = options.recycle
      ? this.drawOrRecycle<TCard>(deckId)
      : this.draw<TCard>(deckId);
    if (card != null) this.give(handId, playerId, card);
    return card;
  }

  drawManyToHand<TCard>(
    deckId: string,
    handId: string,
    playerId: number,
    count: number,
    options: { recycle?: boolean } = {},
  ): TCard[] {
    const drawn: TCard[] = [];
    for (let index = 0; index < Math.max(0, count); index += 1) {
      const card = this.drawToHand<TCard>(deckId, handId, playerId, options);
      if (card == null) break;
      drawn.push(card);
    }
    return drawn;
  }

  drawThenResolve<TCard, TResult>(
    deckId: string,
    resolve: (card: TCard) => TResult,
    options: {
      recycle?: boolean;
      discard?:
        boolean | ((input: { card: TCard; result: TResult }) => boolean);
    } = {},
  ): TResult | null {
    const card = options.recycle
      ? this.drawOrRecycle<TCard>(deckId)
      : this.draw<TCard>(deckId);
    if (card == null) return null;
    const result = resolve(card);
    const shouldDiscard =
      typeof options.discard === 'function'
        ? options.discard({ card, result })
        : (options.discard ?? true);
    if (shouldDiscard) this.discard(deckId, card);
    return result;
  }

  recycle(deckId: string): void {
    const discard = this.state.discards[deckId] ?? [];
    if (discard.length === 0) return;
    const count = discard.length;
    this.state.decks[deckId] = this.random.shuffle(discard);
    this.state.discards[deckId] = [];
    this.lifecycle(deckId).exhausted = false;
    this.emit('deck.recycled', { deckId, count });
  }

  putOnTop<TCard>(deckId: string, cards: readonly TCard[]): void {
    const deck = (this.state.decks[deckId] ??= []);
    this.state.decks[deckId] = [
      ...cards.map((card) => this.toPersistentCard(deckId, card)),
      ...deck,
    ];
    if (cards.length > 0) this.lifecycle(deckId).exhausted = false;
  }

  private drawOne<TCard>(deckId: string): TCard | null {
    const deck = this.state.decks[deckId] ?? [];
    const persistentCard = deck.shift();
    if (persistentCard == null) return null;
    this.lifecycle(deckId).exhausted = false;
    this.emit('card.drawn', { deckId });
    return this.fromPersistentCard<TCard>(deckId, persistentCard);
  }

  private markExhausted(deckId: string): void {
    const lifecycle = this.lifecycle(deckId);
    if (lifecycle.exhausted) return;
    lifecycle.exhausted = true;
    this.emit('deck.exhausted', { deckId });
  }
}
