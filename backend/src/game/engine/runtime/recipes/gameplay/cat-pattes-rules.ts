import type {
  CatPattesObstacle,
  CatPattesParade,
  CatPattesPower,
} from '../../extensions/cat-pattes/program';

export const OBSTACLE_TO_PARADE: Record<CatPattesObstacle, CatPattesParade> = {
  gamelle: 'croquettes',
  pluie: 'rayon',
  chien: 'dodo',
  coussin: 'coussin',
  sol: 'saut',
};
export const PARADE_DISABLED_BY_POWER: Record<
  CatPattesPower,
  readonly CatPattesParade[]
> = {
  reserve: ['croquettes'],
  'chat-ninja': ['dodo'],
  'patte-blindee': ['coussin'],
  'passage-star': ['rayon', 'saut'],
};
