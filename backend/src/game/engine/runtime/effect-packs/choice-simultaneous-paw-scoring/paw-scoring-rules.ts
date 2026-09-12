import type {
  PawScoringObstacle,
  PawScoringParade,
  PawScoringPower,
} from './program';

export const OBSTACLE_TO_PARADE: Record<PawScoringObstacle, PawScoringParade> =
  {
    gamelle: 'croquettes',
    pluie: 'rayon',
    chien: 'dodo',
    coussin: 'coussin',
    sol: 'saut',
  };
export const PARADE_DISABLED_BY_POWER: Record<
  PawScoringPower,
  readonly PawScoringParade[]
> = {
  reserve: ['croquettes'],
  'chat-ninja': ['dodo'],
  'patte-blindee': ['coussin'],
  'passage-star': ['rayon', 'saut'],
};
