import { Injectable } from '@nestjs/common';
import { RandomService } from './random.service';

export type TiePolicy = 'no-kill' | 'random' | 'all';

export type VoteResult = {
  winnerId: number | null;
  tie: boolean;
  tally: Record<number, number>;
};

@Injectable()
export class VoteService {
  constructor(private readonly random: RandomService) {}

  resolveVotes(
    votes: Record<number, number | null | undefined>,
    tiePolicy: TiePolicy = 'no-kill',
  ): VoteResult {
    const tally = new Map<number, number>();
    Object.values(votes || {}).forEach((target) => {
      if (target == null || target < 0) return;
      tally.set(target, (tally.get(target) ?? 0) + 1);
    });
    const tallyObj: Record<number, number> = {};
    tally.forEach((v, k) => (tallyObj[k] = v));
    if (tally.size === 0) {
      return { winnerId: null, tie: false, tally: tallyObj };
    }
    const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
    const [topId, topCount] = sorted[0];
    const tie = sorted.length > 1 && sorted[1][1] === topCount;
    if (!tie) {
      return { winnerId: topId, tie: false, tally: tallyObj };
    }
    if (tiePolicy === 'random') {
      const tied = sorted
        .filter(([, count]) => count === topCount)
        .map(([id]) => id);
      const pick = this.random.pickOne({}, tied).value;
      return { winnerId: pick, tie: true, tally: tallyObj };
    }
    if (tiePolicy === 'all') {
      return { winnerId: null, tie: true, tally: tallyObj };
    }
    return { winnerId: null, tie: true, tally: tallyObj };
  }
}
