import { GameStateEntity } from '../../../../../core/entities/game-state.entity';

// Déclaration des phases Panier Express (ordre et hooks).
export const PANIER_EXPRESS_PHASES: Array<{
  id: string;
  onEnter?: (s: GameStateEntity) => GameStateEntity;
}> = [
  { id: 'turn' },
  {
    id: 'check_victory',
    onEnter: (s) => s, // hook concrétisé dans le service (checkVictoryForAll)
  },
];
