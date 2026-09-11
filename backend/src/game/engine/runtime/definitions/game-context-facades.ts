import type { GameContextCapabilities as GameContextAuthorShape } from './game-context-capabilities';

/** Public capability groups exposed to game authors. */
export type GamePlayersFacade<TState extends object> = Pick<
  GameContextAuthorShape<TState>,
  'actor' | 'players'
>;

export type GameLifecycleFacade<TState extends object> = Pick<
  GameContextAuthorShape<TState>,
  'phase' | 'turn' | 'round' | 'match' | 'status' | 'config'
>;

export type GameValuesFacade<TState extends object> = Pick<
  GameContextAuthorShape<TState>,
  'ranking' | 'score' | 'resources' | 'counters'
>;

export type GameComponentsFacade<TState extends object> = Pick<
  GameContextAuthorShape<TState>,
  | 'cards'
  | 'inventory'
  | 'economy'
  | 'ownership'
  | 'movement'
  | 'pawns'
  | 'dice'
  | 'grid'
  | 'quiz'
>;

export type GameInteractionsFacade<TState extends object> = Pick<
  GameContextAuthorShape<TState>,
  'choice' | 'submissions' | 'submissionFlow' | 'judge' | 'voting' | 'scheduler'
>;

export type GameEffectsFacade<TState extends object> = Pick<
  GameContextAuthorShape<TState>,
  'effects'
>;

export type GameSchedulingFacade<TState extends object> = Pick<
  GameContextAuthorShape<TState>,
  'scheduler'
>;

/** The author-facing shape is intentionally assembled from capability facades. */
export type GameAuthorContextFacades<TState extends object> =
  GamePlayersFacade<TState> &
    GameLifecycleFacade<TState> &
    GameValuesFacade<TState> &
    GameComponentsFacade<TState> &
    GameInteractionsFacade<TState> &
    GameEffectsFacade<TState> &
    GameSchedulingFacade<TState> &
    Pick<
      GameContextAuthorShape<TState>,
      'random' | 'clock' | 'commandId' | 'events' | 'reject'
    >;
