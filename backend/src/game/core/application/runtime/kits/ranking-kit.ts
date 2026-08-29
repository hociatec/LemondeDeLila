export type RankingCriterion = {
  value: (playerId: number) => number;
  direction?: 'asc' | 'desc';
};

export type RankingEntry = {
  playerId: number;
  rank: number;
  values: number[];
};

export class GameRankingController {
  rank(
    playerIds: readonly number[],
    ...criteria: readonly RankingCriterion[]
  ): RankingEntry[] {
    const entries = playerIds.map((playerId) => ({
      playerId,
      values: criteria.map((criterion) => criterion.value(playerId)),
    }));
    entries.sort((left, right) => {
      for (const [index, criterion] of criteria.entries()) {
        const factor = criterion.direction === 'asc' ? 1 : -1;
        const difference =
          factor * ((left.values[index] ?? 0) - (right.values[index] ?? 0));
        if (difference !== 0) return difference;
      }
      return left.playerId - right.playerId;
    });
    let rank = 0;
    return entries.map((entry, index) => {
      const previous = entries[index - 1];
      if (
        !previous ||
        entry.values.some(
          (value, valueIndex) => value !== previous.values[valueIndex],
        )
      ) {
        rank = index + 1;
      }
      return { ...entry, rank };
    });
  }

  tiers(
    playerIds: readonly number[],
    ...criteria: readonly RankingCriterion[]
  ): number[][] {
    return this.rank(playerIds, ...criteria)
      .reduce<number[][]>((tiers, entry) => {
        (tiers[entry.rank - 1] ??= []).push(entry.playerId);
        return tiers;
      }, [])
      .filter((tier) => tier.length > 0);
  }

  leaders(
    playerIds: readonly number[],
    ...criteria: readonly RankingCriterion[]
  ): number[] {
    return this.tiers(playerIds, ...criteria)[0] ?? [];
  }
}
