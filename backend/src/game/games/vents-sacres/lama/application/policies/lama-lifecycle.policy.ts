import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { LamaMetadata, LamaRoundStep } from '../../model/lama.model';

function normalized(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

export function isLamaSetupState(state: GameStateEntity): boolean {
  return normalized(state.phase) === 'setup' || normalized(state.status) === 'setup';
}

export function effectiveLamaStep(
  state: GameStateEntity,
  metadata: LamaMetadata,
): LamaRoundStep {
  const step = metadata.step ?? 'turn_choice';
  // `phase` owns the game lifecycle. A stale setup sub-step must never bring the
  // configuration form back once a round has begun.
  if (step === 'setup_config' && !isLamaSetupState(state)) return 'turn_choice';
  return step;
}
