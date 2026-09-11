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
export type PlayerValuesVisibility = {
  scores?: VisibilityRule;
  resources?: Readonly<Record<string, VisibilityRule>>;
  counters?: Readonly<Record<string, VisibilityRule>>;
  statuses?: VisibilityRule;
};
