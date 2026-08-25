import { GameStateEntity } from '../../../../core/application/models/game-state.model';
import { PANIER_EXPRESS_GAME } from './game.definition';

export const PANIER_EXPRESS_PHASES: Array<{
  id: string;
  onEnter?: (s: GameStateEntity) => GameStateEntity;
}> = [
  { id: PANIER_EXPRESS_GAME.phaseOrder[0].id },
  { id: PANIER_EXPRESS_GAME.phaseOrder[1].id, onEnter: (s) => s },
];



