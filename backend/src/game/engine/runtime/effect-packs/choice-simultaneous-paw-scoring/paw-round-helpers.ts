import type { PawScoringObstacle, PawScoringPower } from './program';

export function powerIgnoresObstacle(
  activePowers: readonly PawScoringPower[],
  obstacle: PawScoringObstacle,
) {
  return activePowers.some(
    (power) =>
      (power === 'reserve' && obstacle === 'gamelle') ||
      (power === 'chat-ninja' && obstacle === 'chien') ||
      (power === 'patte-blindee' && obstacle === 'coussin') ||
      (power === 'passage-star' &&
        (obstacle === 'pluie' || obstacle === 'sol')),
  );
}
