import { GameRuleViolationError } from '../../../core/domain/errors/game-domain.errors';
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

export type PlayerStatus<TData extends object = Record<string, unknown>> = {
  id: string;
  remaining: number | null;
  scope: StatusScope;
  data: TData;
};

export type PlayerValuesKitState<
  TResourceId extends string = string,
  TCounterId extends string = string,
  TStatusData extends object = Record<string, unknown>,
  TTurnFlags extends Record<string, unknown> = Record<string, unknown>,
> = {
  scores: Record<string, number>;
  resources: Record<TResourceId, Record<string, number>>;
  counters?: Record<TCounterId, number>;
  statuses: Record<string, PlayerStatus<TStatusData>[]>;
  turnFlags: TTurnFlags;
  scheduledSkips: Record<string, number>;
  scheduledExtraTurns: Record<string, number>;
};

export type PlayerValuesPlayerView<
  TResourceId extends string = string,
  TCounterId extends string = string,
  TStatusData extends object = Record<string, unknown>,
> = {
  scores: Record<string, number>;
  scoring: ScorePlayerView;
  resources: Record<TResourceId, Record<string, number>>;
  counters: Record<TCounterId, number>;
  statuses: PlayerStatus<TStatusData>[];
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
  TStatusData extends object = Record<string, unknown>,
  TTurnFlags extends Record<string, unknown> = Record<string, unknown>,
>(): PlayerValuesKitState<TResourceId, TCounterId, TStatusData, TTurnFlags> {
  return {
    scores: {},
    resources: {},
    counters: {},
    statuses: {},
    turnFlags: {},
    scheduledSkips: {},
    scheduledExtraTurns: {},
  } as PlayerValuesKitState<TResourceId, TCounterId, TStatusData, TTurnFlags>;
}

export {
  projectPlayerValues,
  projectScores,
  projectStatusesByPlayer,
  projectStatusViews,
} from '../projection/player-values-projection';

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

  set(
    playerId: number,
    value: number,
    options: { announce?: boolean } = {},
  ): number {
    const previous = this.get(playerId);
    this.state.scores[String(playerId)] = value;
    this.emit('score.changed', {
      playerId,
      previous,
      value,
      delta: value - previous,
      ...(options.announce === false ? { announce: false } : {}),
    });
    return value;
  }

  add(
    playerId: number,
    amount: number,
    options: { announce?: boolean } = {},
  ): number {
    return this.set(playerId, this.get(playerId) + amount, options);
  }

  subtract(
    playerId: number,
    amount: number,
    options: { announce?: boolean } = {},
  ): number {
    return this.add(playerId, -amount, options);
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

export class GameResourcesController<TResourceId extends string = string> {
  constructor(
    private readonly state: PlayerValuesKitState<TResourceId>,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
  ) {}

  get(playerId: number, resource: TResourceId): number {
    return this.state.resources[resource]?.[String(playerId)] ?? 0;
  }

  set(playerId: number, resource: TResourceId, value: number): number {
    const previous = this.get(playerId, resource);
    const stateResources = this.state.resources as Record<
      string,
      Record<string, number>
    >;
    (stateResources[resource] ??= {})[String(playerId)] = value;
    this.emit('resource.changed', {
      playerId,
      resource,
      previous,
      value,
      delta: value - previous,
    });
    return value;
  }

  add(playerId: number, resource: TResourceId, amount: number): number {
    return this.set(playerId, resource, this.get(playerId, resource) + amount);
  }

  has(playerId: number, resource: TResourceId, amount: number): boolean {
    return this.get(playerId, resource) >= amount;
  }

  remove(playerId: number, resource: TResourceId, amount: number): number {
    if (!this.has(playerId, resource, amount)) {
      throw new GameRuleViolationError(
        'RESOURCE_INSUFFICIENT',
        { playerId, resource, amount, available: this.get(playerId, resource) },
        `Ressource insuffisante: ${resource}`,
      );
    }
    return this.add(playerId, resource, -amount);
  }

  transfer(
    from: number,
    to: number,
    resource: TResourceId,
    amount: number,
  ): void {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    if (normalizedAmount === 0 || from === to) return;
    const fromKey = String(from);
    const toKey = String(to);
    const stateResources = this.state.resources as Record<
      string,
      Record<string, number>
    >;
    const resources = (stateResources[resource] ??= {});
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

export class GameCountersController<TCounterId extends string = string> {
  constructor(
    private readonly state: PlayerValuesKitState<string, TCounterId>,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
  ) {}

  get(counter: TCounterId): number {
    return this.state.counters?.[counter] ?? 0;
  }

  set(counter: TCounterId, value: number): number {
    const previous = this.get(counter);
    const counters = (this.state.counters ??= {} as Record<TCounterId, number>);
    counters[counter] = value;
    this.emit('counter.changed', {
      counter,
      previous,
      value,
      delta: value - previous,
    });
    return value;
  }

  add(counter: TCounterId, amount: number): number {
    return this.set(counter, this.get(counter) + amount);
  }

  subtract(counter: TCounterId, amount: number): number {
    return this.add(counter, -amount);
  }
}

export class GameStatusController<
  TStatusData extends object = Record<string, unknown>,
> {
  constructor(
    private readonly state: PlayerValuesKitState<string, string, TStatusData>,
  ) {}

  add(
    playerId: number,
    id: string,
    options: {
      turns?: number;
      scope?: StatusScope;
      data?: TStatusData;
    } = {},
  ): void {
    const statuses = (this.state.statuses[String(playerId)] ??= []);
    const status: PlayerStatus<TStatusData> = {
      id,
      remaining: options.turns == null ? null : Math.max(0, options.turns),
      scope: options.scope ?? 'turn',
      data: structuredClone(options.data ?? ({} as TStatusData)),
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

  get(playerId: number, id: string): PlayerStatus<TStatusData> | null {
    const status = (this.state.statuses[String(playerId)] ?? []).find(
      (candidate) => candidate.id === id,
    );
    return status ? structuredClone(status) : null;
  }

  list(playerId: number): PlayerStatus<TStatusData>[] {
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
