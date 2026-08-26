import type { GameStateEntity, PlayerStateEntity } from './game-state.model';

export type GameInternalState<TGameState = Record<string, unknown>> =
  GameStateEntity & {
    game?: TGameState;
  };

export type PublicPlayerState = Pick<
  PlayerStateEntity,
  'id' | 'username' | 'isBot' | 'alive'
> &
  Record<string, unknown>;

export type GamePlayerView<TGameView = Record<string, unknown>> = Omit<
  GameStateEntity,
  'metadata' | 'players'
> & {
  players?: PublicPlayerState[];
  game?: TGameView;
  metadata?: Record<string, unknown>;
};
