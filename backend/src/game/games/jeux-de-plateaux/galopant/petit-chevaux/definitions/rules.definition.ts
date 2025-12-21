import { GameStateEntity } from '../../../../../engine/../core/entities/game-state.entity';
import { PETIT_CHEVAUX_GAME } from './game.definition';

export const PETIT_CHEVAUX_PHASES: Array<{
  id: string;
  onEnter?: (state: GameStateEntity) => GameStateEntity;
}> = [{ id: PETIT_CHEVAUX_GAME.phaseOrder[0].id }];
