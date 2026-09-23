import { authoringProperty } from '../contracts/authoring-diagnostics';
import type {
  DefinitionToValidate,
  ValidationFailure,
} from '../contracts/definition-validation';

export function assertPhaseGraph(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  const phases = definition.phases ?? {};
  const names = Object.keys(phases);
  if (names.length > 512) fail('phases', 'trop de phases');
  if (names.length === 0) fail('phases', 'au moins une phase est requise');
  const edges = new Map<string, readonly string[]>();
  for (const [name, candidate] of Object.entries(phases)) {
    const phase: unknown = candidate;
    if (!isRecord(phase))
      fail(`${authoringProperty('phases', name)}`, 'objet de phase requis');
    if (name.length > 128)
      fail(`${authoringProperty('phases', name)}`, 'nom de phase trop long');
    if (phase.terminal !== undefined && typeof phase.terminal !== 'boolean')
      fail(`${authoringProperty('phases', name)}.terminal`, 'booléen requis');
    if (
      phase.transitions !== undefined &&
      (!Array.isArray(phase.transitions) ||
        phase.transitions.length > 512 ||
        !phase.transitions.every(
          (target: unknown) =>
            typeof target === 'string' && target.length <= 128,
        ))
    )
      fail(
        `${authoringProperty('phases', name)}.transitions`,
        'liste de noms de phases requise',
      );
    if (phase.next !== undefined && typeof phase.next !== 'string')
      fail(`${authoringProperty('phases', name)}.next`, 'nom de phase requis');
    const transitions: string[] = Array.isArray(phase.transitions)
      ? phase.transitions.filter(
          (target): target is string => typeof target === 'string',
        )
      : [];
    const exits = [
      ...new Set([...transitions, ...(phase.next ? [phase.next] : [])]),
    ];
    if (phase.terminal && exits.length > 0)
      fail(
        `${authoringProperty('phases', name)}`,
        'une phase terminale ne peut pas déclarer de sortie',
      );
    if (
      !phase.terminal &&
      exits.filter((target) => target !== name).length === 0
    )
      fail(
        `${authoringProperty('phases', name)}`,
        'sortie requise ou phase explicitement terminale',
      );
    for (const [index, target] of transitions.entries()) {
      if (!Object.hasOwn(phases, target))
        fail(
          `${authoringProperty('phases', name)}.transitions[${index}]`,
          `phase inconnue « ${target} »`,
        );
    }
    if (phase.next && !Object.hasOwn(phases, phase.next))
      fail(
        `${authoringProperty('phases', name)}.next`,
        `phase inconnue « ${phase.next} »`,
      );
    edges.set(name, exits);
  }
  const pending = [definition.initialPhase ?? names[0]];
  const reached = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (reached.has(current)) continue;
    reached.add(current);
    pending.push(...(edges.get(current) ?? []));
  }
  for (const name of names) {
    if (!reached.has(name))
      fail(
        `${authoringProperty('phases', name)}`,
        'phase inaccessible depuis la phase initiale',
      );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
