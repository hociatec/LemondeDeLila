import type { TrackDefinition } from '../kits/movement-kit';
import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';
import { assertEffectInstructions } from '../effects/game-effect-definition-validator';
import { requireTrackPosition } from '../effects/game-effect-reference-validator';

export function assertMovementComponent(
  component: TrackDefinition,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  for (const [field, value] of Object.entries({
    finish: component.finish,
    'homeStretch.from': component.homeStretch?.from,
    'homeStretch.to': component.homeStretch?.to,
  }))
    if (value != null)
      requireTrackPosition(
        references,
        component.id,
        value,
        `components.${component.id}.${field}`,
        fail,
      );
  for (const [position, instructions] of Object.entries(
    component.landingEffects ?? {},
  )) {
    const path = `components.${component.id}.landingEffects.${position}`;
    requireTrackPosition(
      references,
      component.id,
      Number(position),
      path,
      fail,
    );
    assertEffectInstructions(instructions, path, references, fail);
  }
  for (const [tag, instructions] of Object.entries(
    component.tagEffects ?? {},
  )) {
    const path = `components.${component.id}.tagEffects.${tag}`;
    if (!references.trackTags?.get(component.id)?.has(tag))
      fail(path, 'tag de piste inconnu');
    assertEffectInstructions(instructions, path, references, fail);
  }
}
