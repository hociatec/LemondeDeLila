import { Injectable } from '@nestjs/common';
import { RandomService } from './random.service';

@Injectable()
export class DeckManagerService {
  constructor(private readonly random: RandomService) {}

  shuffle<T>(arr: T[]): T[] {
    return this.random.shuffle({}, arr).values;
  }

  draw<T>(
    deck: T[],
    discards: T[],
  ): { card: T; deck: T[]; discards: T[] } | null {
    let deckToUse = [...deck];
    let discardsToUse = [...discards];

    if (deckToUse.length === 0 && discardsToUse.length > 0) {
      deckToUse = this.shuffle(discardsToUse);
      discardsToUse = [];
    }
    if (deckToUse.length === 0) {
      return null;
    }
    const [card, ...rest] = deckToUse;
    return { card, deck: rest, discards: discardsToUse };
  }
}
