import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { MISSION_NEMESIS_GAME } from './game.definition';

export const MISSION_NEMESIS_PHASES: Array<{
  id: string;
  onEnter?: (state: GameStateEntity) => GameStateEntity;
}> = [{ id: MISSION_NEMESIS_GAME.phaseOrder[0].id }];
