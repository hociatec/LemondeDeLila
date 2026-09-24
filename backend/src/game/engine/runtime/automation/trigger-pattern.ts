import type { DeclarativeTrigger } from '../contracts/declarative-trigger';
import type { GamePattern } from '../contracts/pattern-definition';
import { assertTrigger } from './trigger-validation';

export function triggerPattern<TState extends object>(
  source: DeclarativeTrigger,
): GamePattern<TState> {
  assertTrigger(source);
  return Object.freeze({
    id: `trigger:${source.id}`,
    mechanics: ['triggers'],
    triggers: [structuredClone(source)],
  });
}
