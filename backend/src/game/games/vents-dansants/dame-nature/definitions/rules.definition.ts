import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { DameNatureMetadata } from '../model/dame-nature.model';
import { DAME_NATURE_GAME } from './game.definition';

export const DAME_NATURE_PHASES: Array<{
  id: string;
  onEnter?: (
    state: GameStateEntity,
    _meta: DameNatureMetadata,
  ) => GameStateEntity;
}> = [
  { id: DAME_NATURE_GAME.phaseOrder[0].id },
  {
    id: DAME_NATURE_GAME.phaseOrder[1].id,
    onEnter: (s, _meta) => s,
  },
];
