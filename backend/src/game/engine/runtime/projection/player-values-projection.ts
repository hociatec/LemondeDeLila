import type {
  PlayerStatus,
  PlayerValuesKitState,
  PlayerValuesPlayerView,
  PlayerValuesVisibility,
  ScorePlayerView,
} from '../kits/player-values-kit';
import type { VisibilityRule } from '../kits/visibility-kit';

export function projectPlayerValues(
  state: PlayerValuesKitState,
  viewerPlayerId: number | null,
  visibility: PlayerValuesVisibility = {},
  playerIds: readonly number[] = [],
): PlayerValuesPlayerView {
  const projectedScores = projectNumericByPlayer(
    state.scores,
    viewerPlayerId,
    visibility.scores,
  );
  const scores = completePublicScores(
    projectedScores,
    playerIds,
    visibility.scores,
  );
  return {
    scores,
    scoring: projectScores(scores),
    resources: Object.fromEntries(
      Object.entries(state.resources).flatMap(([resource, values]) => {
        const projected = projectNumericByPlayer(
          values,
          viewerPlayerId,
          visibility.resources?.[resource],
        );
        return Object.keys(projected).length > 0 ? [[resource, projected]] : [];
      }),
    ),
    counters: projectCounters(state.counters ?? {}, visibility.counters ?? {}),
    statuses: projectStatuses(
      state.statuses,
      viewerPlayerId,
      visibility.statuses,
    ),
  };
}

function completePublicScores(
  scores: Record<string, number>,
  playerIds: readonly number[],
  visibility: VisibilityRule | undefined,
): Record<string, number> {
  if (
    visibility?.kind === 'hidden' ||
    (visibility?.kind === 'hidden-until' && !visibility.revealed) ||
    visibility?.kind === 'private-by-player'
  ) {
    return scores;
  }
  const completed = { ...scores };
  for (const playerId of playerIds) completed[String(playerId)] ??= 0;
  return completed;
}

export function projectStatusesByPlayer(
  statuses: Readonly<Record<string, PlayerStatus[]>>,
  viewerPlayerId: number | null,
  visibility: VisibilityRule | undefined,
): Record<string, PlayerStatus[]> {
  if (visibility?.kind === 'hidden') return {};
  if (visibility?.kind === 'hidden-until') {
    return visibility.revealed ? structuredClone(statuses) : {};
  }
  if (visibility?.kind === 'public') return structuredClone(statuses);
  if (viewerPlayerId == null) return {};
  const own = statuses[String(viewerPlayerId)];
  return own == null ? {} : { [String(viewerPlayerId)]: structuredClone(own) };
}

export function projectStatusViews(
  statuses: Readonly<Record<string, PlayerStatus[]>>,
  viewerPlayerId: number | null,
  visibility: VisibilityRule | undefined,
): { byId: Record<string, Record<string, PlayerStatus>> } {
  const byPlayer = projectStatusesByPlayer(
    statuses,
    viewerPlayerId,
    visibility,
  );
  const byId: Record<string, Record<string, PlayerStatus>> = {};
  for (const [playerId, playerStatuses] of Object.entries(byPlayer)) {
    for (const status of playerStatuses) {
      (byId[status.id] ??= {})[playerId] = status;
    }
  }
  return { byId };
}

function projectStatuses(
  statuses: Readonly<Record<string, PlayerStatus[]>>,
  viewerPlayerId: number | null,
  visibility: VisibilityRule | undefined,
): PlayerStatus[] {
  if (viewerPlayerId == null || visibility?.kind === 'hidden') return [];
  if (visibility?.kind === 'hidden-until' && !visibility.revealed) return [];
  return structuredClone(statuses[String(viewerPlayerId)] ?? []);
}

function projectNumericByPlayer(
  values: Readonly<Record<string, number>>,
  viewerPlayerId: number | null,
  visibility: VisibilityRule | undefined,
): Record<string, number> {
  if (visibility?.kind === 'hidden') return {};
  if (visibility?.kind === 'hidden-until' && !visibility.revealed) return {};
  if (visibility?.kind === 'private-by-player') {
    if (viewerPlayerId == null) return {};
    const value = values[String(viewerPlayerId)];
    return value == null ? {} : { [String(viewerPlayerId)]: value };
  }
  if (visibility?.kind === 'count-only') {
    return Object.fromEntries(
      Object.entries(values).map(([playerId, value]) => [
        playerId,
        value === 0 ? 0 : 1,
      ]),
    );
  }
  return structuredClone(values);
}

function projectCounters(
  counters: Readonly<Record<string, number>>,
  visibility: Readonly<Record<string, VisibilityRule>>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counters).flatMap(([counter, value]) => {
      const rule = visibility[counter];
      if (rule?.kind === 'hidden') return [];
      if (rule?.kind === 'hidden-until' && !rule.revealed) return [];
      return [
        [counter, rule?.kind === 'count-only' ? (value === 0 ? 0 : 1) : value],
      ];
    }),
  );
}

export function projectScores(
  scores: Readonly<Record<string, number>>,
): ScorePlayerView {
  const sorted = Object.entries(scores)
    .map(([playerId, score]) => ({ playerId: Number(playerId), score }))
    .sort(
      (left, right) =>
        right.score - left.score || left.playerId - right.playerId,
    );
  let rank = 0;
  return {
    byPlayer: structuredClone(scores),
    leaderboard: sorted.map((entry, index) => {
      if (index === 0 || entry.score !== sorted[index - 1]?.score) {
        rank = index + 1;
      }
      return { ...entry, rank };
    }),
  };
}
