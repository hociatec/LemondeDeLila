import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import {
  DameNatureSetupService,
  FamilyCard,
} from './dame-nature-setup.service';

@Injectable()
export class DameNatureBooksService {
  constructor(private readonly setup: DameNatureSetupService) {}

  checkAndBook(
    state: GameStateEntity,
    player: {
      id: number;
      username: string;
      hand: FamilyCard[];
      handCount: number;
      books: string[];
    },
  ) {
    const families = this.setup.families();
    const toBook: string[] = [];
    for (const fam of families) {
      const members = fam.members.map((m) => m.id);
      const hasAll = members.every((m) =>
        player.hand.some((c) => c.memberId === m),
      );
      if (hasAll && !player.books.includes(fam.id)) {
        toBook.push(fam.id);
      }
    }
    if (!toBook.length) {
      return { state, booked: [] as string[] };
    }
    player.books.push(...toBook);
    player.hand = player.hand.filter((c) => !toBook.includes(c.familyId));
    player.handCount = player.hand.length;
    return { state, booked: toBook };
  }
}
