import type { GameStateEntity, PlayerStateEntity } from './game-state.model';

export type GameInternalState<TGameState extends object = object> =
  GameStateEntity & {
    game?: TGameState;
  };

export type PublicPlayerState<TPlayerExtras extends object = object> = Pick<
  PlayerStateEntity,
  'id' | 'username' | 'isBot' | 'alive'
> &
  TPlayerExtras;

export type GamePlayerView<
  TGameView extends object = object,
  TExtras extends object = object,
  TBoard extends object = object,
> = Omit<
  GameStateEntity,
  'metadata' | 'players' | 'game' | 'extras' | 'board'
> & {
  players?: PublicPlayerState[];
  game?: TGameView;
  extras?: TExtras;
  board?: TBoard;
  metadata?: Record<string, unknown>;
};
