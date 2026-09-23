import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { authoringValueAt } from '../contracts/authoring-error';
import type { DefinitionToValidate } from '../contracts/definition-validation';
import {
  jsonPatternComponentPath,
  jsonPatternCompositionPath,
} from './json-pattern-diagnostics';
import { authoringPathOf } from '../contracts/authoring-origin';

export function jsonCompilationOrigin(
  error: unknown,
  gameId: string,
  document: unknown,
): string | undefined {
  const origin = authoringPathOf(error);
  const contentPrefix = `${gameId}.content.`;
  if (origin?.startsWith(contentPrefix))
    return origin.slice(contentPrefix.length);
  if (origin?.startsWith('patterns['))
    return jsonPatternCompositionPath(document, origin);
  if (!origin?.startsWith('definition.')) return undefined;
  const field = origin
    .slice('definition.'.length)
    .replace(/^initialization\./, 'setup.');
  // Extension contributions also enter the compiled definition. Only attribute
  // a conflict to the JSON document when that source field actually exists.
  return authoringValueAt(document, field) === undefined ? undefined : field;
}

/** Preserve the SDK error family while giving authoring adapters typed provenance. */
export class DefinitionValidationError extends GameConfigurationError {
  readonly component?: { id: string; component: string };

  constructor(
    definition: DefinitionToValidate,
    readonly path: string,
    readonly reason: string,
  ) {
    super(
      `Définition ${definition.id || '<sans identifiant>'}.${path}: ${reason}`,
    );
    const match = /^components\[(\d+)\]/.exec(path);
    const component = match
      ? definition.components?.[Number(match[1])]
      : undefined;
    if (component)
      this.component = { id: component.id, component: component.component };
  }
}

export function jsonDefinitionFailure(
  error: DefinitionValidationError,
  document: unknown,
): string | undefined {
  if (error.path.startsWith('content.'))
    return error.path.slice('content.'.length);
  if (error.path.startsWith('initialization.'))
    return `setup.${error.path.slice('initialization.'.length)}`;
  if (error.component) {
    const components = authoringValueAt(document, 'components');
    const sourceComponents: readonly unknown[] = Array.isArray(components)
      ? components
      : [];
    const matches = (entry: unknown) =>
      authoringValueAt(entry, 'id') === error.component?.id &&
      authoringValueAt(entry, 'component') === error.component?.component;
    const originalIndex = Number(/^components\[(\d+)\]/.exec(error.path)?.[1]);
    const index = matches(sourceComponents[originalIndex])
      ? originalIndex
      : sourceComponents.findIndex(matches);
    if (index < 0)
      return jsonPatternComponentPath(
        authoringValueAt(document, 'patterns'),
        error.component,
        error.path.replace(/^components\[\d+\]\.?/, ''),
      );
    return error.path.replace(/^components\[\d+\]/, `components[${index}]`);
  }
  if (/^(?:initialPhase|phases|actions|resourceIds)(?:[.[]|$)/.test(error.path))
    return error.path;
  return undefined;
}
