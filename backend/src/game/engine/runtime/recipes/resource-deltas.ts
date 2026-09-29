import { gameEffects } from '../effects/effects-dsl';
import type {
  EffectTarget,
  GameEffectInstruction,
} from '../contracts/effect-ir';
import type { InsufficientResourcePolicy } from '../contracts/resource-payment';

/** Compose a reward or cost bundle using the same settlement policy per debit. */
export function resourceDeltaEffects(
  deltas: Readonly<Record<string, number>>,
  target: EffectTarget,
  insufficient: InsufficientResourcePolicy = 'partial',
): readonly GameEffectInstruction[] {
  return Object.entries(deltas).map(([resource, delta]) =>
    delta >= 0
      ? gameEffects.gainResource(resource, delta, target)
      : gameEffects.loseResource(resource, -delta, target, { insufficient }),
  );
}
