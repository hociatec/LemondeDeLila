import { GameRuleViolationError } from '../../../domain/errors/game-domain.errors';
import type { VisibilityRule } from './visibility-kit';

export type StatusScope =
  'turn' | 'global-turn' | 'round' | 'match' | 'until-used';

export const commonStatuses = {
  blocked: 'blocked',
  doubleMove: 'double-move',
  doubleRoll: 'double-roll',
  forcedRoll: 'forced-roll',
  immunity: 'immunity',
  protected: 'protected',
  reverse: 'reverse',
  shield: 'shield',
  skip: 'skip',
} as const;

export type CommonStatusId =
  (typeof commonStatuses)[keyof typeof commonStatuses];

export type PlayerStatus = {
  id: string;
  remaining: number | null;
  scope: StatusScope;
  data: Record<string, unknown>;
};

export type PlayerValuesKitState<
  TResourceId extends string = string,
  TCounterId extends string = string,
> = {
  scores: Record<string, number>;
  resources: Record<TResourceId, Record<string, number>>;
  counters?: Record<TCounterId, number>;
  statuses: Record<string, PlayerStatus[]>;
  turnFlags: Record<string, unknown>;
  scheduledSkips: Record<string, number>;
  scheduledExtraTurns: Record<string, number>;
};

export type PlayerValuesPlayerView<
  TResourceId extends string = string,
  TCounterId extends string = string,
> = {
  scores: Record<string, number>;
  scoring: ScorePlayerView;
  resources: Record<TResourceId, Record<string, number>>;
  counters: Record<TCounterId, number>;
  statuses: PlayerStatus[];
};

export type ScorePlayerView = {
  byPlayer: Record<string, number>;
  leaderboard: Array<{ playerId: number; score: number; rank: number }>;
};

/** Projection policy for values held by the player-values kit. */
export type PlayerValuesVisibility = {
  scores?: VisibilityRule;
  resources?: Readonly<Record<string, VisibilityRule>>;
  counters?: Readonly<Record<string, VisibilityRule>>;
  statuses?: VisibilityRule;
};

export function createPlayerValuesKitState<
  TResourceId extends string = string,
  TCounterId extends string = string,
>(): PlayerValuesKitState<TResourceId, TCounterId> {
  return {
    scores: {},
    resources: {},
    counters: {},
    statuses: {},
    turnFlags: {},
    scheduledSkips: {},
    scheduledExtraTurns: {},
  } as PlayerValuesKitState<TResourceId, TCounterId>;
}

export function projectPlayerValues(
  state: PlayerValuesKitState,
  viewerPlayerId: number | null,
  visibility: PlayerValuesVisibility = {},
): PlayerValuesPlayerView {
  const scores = projectNumericByPlayer(
    state.scores,
    viewerPlayerId,
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
): {
  byId: Record<string, Record<string, PlayerStatus>>;
} {
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

export class GameScoreController {
  constructor(
    private readonly state: PlayerValuesKitState,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
  ) {}

  get(playerId: number): number {
    return this.state.scores[String(playerId)] ?? 0;
  }

  set(playerId: number, value: number): number {
    const previous = this.get(playerId);
    this.state.scores[String(playerId)] = value;
    this.emit('score.changed', {
      playerId,
      previous,
      value,
      delta: value - previous,
    });
    return value;
  }

  add(playerId: number, amount: number): number {
    return this.set(playerId, this.get(playerId) + amount);
  }

  subtract(playerId: number, amount: number): number {
    return this.add(playerId, -amount);
  }

  ranking(direction: 'asc' | 'desc' = 'desc'): number[][] {
    const factor = direction === 'desc' ? -1 : 1;
    const sorted = Object.entries(this.state.scores).sort(
      (left, right) => factor * (left[1] - right[1]),
    );
    const ranks: number[][] = [];
    for (const [playerId, score] of sorted) {
      const previous = sorted.findIndex((entry) => entry[1] === score);
      (ranks[previous] ??= []).push(Number(playerId));
    }
    return ranks.filter((rank) => rank.length > 0);
  }

  leaders(): number[] {
    return this.ranking()[0] ?? [];
  }
}

export class GameResourcesController {
  constructor(
    private readonly state: PlayerValuesKitState,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
  ) {}

  get(playerId: number, resource: string): number {
    return this.state.resources[resource]?.[String(playerId)] ?? 0;
  }

  set(playerId: number, resource: string, value: number): number {
    const previous = this.get(playerId, resource);
    (this.state.resources[resource] ??= {})[String(playerId)] = value;
    this.emit('resource.changed', {
      playerId,
      resource,
      previous,
      value,
      delta: value - previous,
    });
    return value;
  }

  add(playerId: number, resource: string, amount: number): number {
    return this.set(playerId, resource, this.get(playerId, resource) + amount);
  }

  has(playerId: number, resource: string, amount: number): boolean {
    return this.get(playerId, resource) >= amount;
  }

  remove(playerId: number, resource: string, amount: number): number {
    if (!this.has(playerId, resource, amount)) {
      throw new GameRuleViolationError(
        'RESOURCE_INSUFFICIENT',
        { playerId, resource, amount, available: this.get(playerId, resource) },
        `Ressource insuffisante: ${resource}`,
      );
    }
    return this.add(playerId, resource, -amount);
  }

  transfer(from: number, to: number, resource: string, amount: number): void {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    if (normalizedAmount === 0 || from === to) return;
    const fromKey = String(from);
    const toKey = String(to);
    const resources = (this.state.resources[resource] ??= {});
    const sourceAmount = resources[fromKey] ?? 0;
    if (sourceAmount < normalizedAmount) {
      throw new GameRuleViolationError(
        'RESOURCE_INSUFFICIENT',
        { from, to, resource, amount, available: sourceAmount },
        'Ressource insuffisante',
      );
    }
    const destinationAmount = resources[toKey] ?? 0;
    resources[fromKey] = sourceAmount - normalizedAmount;
    resources[toKey] = destinationAmount + normalizedAmount;
    this.emit('resource.changed', {
      playerId: from,
      resource,
      previous: sourceAmount,
      value: resources[fromKey],
      delta: -normalizedAmount,
    });
    this.emit('resource.changed', {
      playerId: to,
      resource,
      previous: destinationAmount,
      value: resources[toKey],
      delta: normalizedAmount,
    });
    this.emit('resource.transferred', {
      from,
      to,
      resource,
      amount: normalizedAmount,
    });
  }

  private normalizePositiveAmount(amount: number): number {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new GameRuleViolationError(
        'RESOURCE_TRANSFER_AMOUNT',
        { amount },
        "Quantité d'échange invalide",
      );
    }
    return amount;
  }
}

export class GameCountersController {
  constructor(
    private readonly state: PlayerValuesKitState,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
  ) {}

  get(counter: string): number {
    return this.state.counters?.[counter] ?? 0;
  }

  set(counter: string, value: number): number {
    const previous = this.get(counter);
    (this.state.counters ??= {})[counter] = value;
    this.emit('counter.changed', {
      counter,
      previous,
      value,
      delta: value - previous,
    });
    return value;
  }

  add(counter: string, amount: number): number {
    return this.set(counter, this.get(counter) + amount);
  }

  subtract(counter: string, amount: number): number {
    return this.add(counter, -amount);
  }
}

export class GameStatusController {
  constructor(private readonly state: PlayerValuesKitState) {}

  add(
    playerId: number,
    id: string,
    options: {
      turns?: number;
      scope?: StatusScope;
      data?: Record<string, unknown>;
    } = {},
  ): void {
    const statuses = (this.state.statuses[String(playerId)] ??= []);
    const status: PlayerStatus = {
      id,
      remaining: options.turns == null ? null : Math.max(0, options.turns),
      scope: options.scope ?? 'turn',
      data: structuredClone(options.data ?? {}),
    };
    const existing = statuses.findIndex((candidate) => candidate.id === id);
    if (existing < 0) statuses.push(status);
    else statuses[existing] = status;
  }

  has(playerId: number, id: string): boolean {
    return (this.state.statuses[String(playerId)] ?? []).some(
      (status) => status.id === id,
    );
  }

  get(playerId: number, id: string): PlayerStatus | null {
    const status = (this.state.statuses[String(playerId)] ?? []).find(
      (candidate) => candidate.id === id,
    );
    return status ? structuredClone(status) : null;
  }

  list(playerId: number): PlayerStatus[] {
    return structuredClone(this.state.statuses[String(playerId)] ?? []);
  }

  remove(playerId: number, id: string): void {
    const statuses = this.state.statuses[String(playerId)] ?? [];
    this.state.statuses[String(playerId)] = statuses.filter(
      (status) => status.id !== id,
    );
  }

  consume(playerId: number, id: string): boolean {
    if (!this.has(playerId, id)) return false;
    this.remove(playerId, id);
    return true;
  }

  tick(scope: StatusScope, playerId?: number): void {
    if (scope === 'until-used') return;
    const keys =
      playerId == null ? Object.keys(this.state.statuses) : [String(playerId)];
    for (const key of keys) {
      const statuses = this.state.statuses[key] ?? [];
      for (const status of statuses) {
        if (status.scope === scope && status.remaining != null)
          status.remaining -= 1;
      }
      this.state.statuses[key] = statuses.filter(
        (status) =>
          status.scope !== scope ||
          (status.remaining != null && status.remaining > 0),
      );
    }
  }
}
