import { Injectable } from '@nestjs/common';

@Injectable()
export class DeckManagerService {
  shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  draw<T>(deck: T[], discards: T[]): { card: T; deck: T[]; discards: T[] } | null {
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
