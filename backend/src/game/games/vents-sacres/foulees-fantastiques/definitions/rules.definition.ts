import { GameStateEntity } from '../../../../engine/../core/entities/game-state.entity';
import { FOULEES_FANTASTIQUES_GAME } from './game.definition';

export const FOULEES_FANTASTIQUES_PHASES: Array<{
  id: string;
  onEnter?: (state: GameStateEntity) => GameStateEntity;
}> = [{ id: FOULEES_FANTASTIQUES_GAME.phaseOrder[0].id }];
