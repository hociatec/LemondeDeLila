import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { DameNatureMetadata } from '../services/dame-nature.service';

export const DAME_NATURE_PHASES: Array<{
  id: string;
  onEnter?: (state: GameStateEntity, _meta: DameNatureMetadata) => GameStateEntity;
}> = [
  { id: 'turn' },
  {
    id: 'pollution-check',
    onEnter: (s, _meta) => s, // application gérée dans le service (applyPollution)
  },
];
