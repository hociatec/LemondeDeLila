import type { DeclarativeTrigger } from '../contracts/declarative-trigger';
import {
  assertAuthorJson,
  validateAuthorSchema,
} from '../contracts/json-author-schema';
import { declarativeTriggerSchema } from '../contracts/declarative-trigger-schema';
import { effectJsonDefinitions } from '../contracts/effect-json-schema';
import { AuthoringError } from '../contracts/authoring-error';

/** Triggers run atomically; interactive effects belong to the regular action queue. */
export function assertTrigger(source: DeclarativeTrigger): void {
  assertAuthorJson(source, 'trigger', true);
  validateAuthorSchema(
    source,
    declarativeTriggerSchema,
    effectJsonDefinitions,
    'trigger',
    true,
  );
  const inspect = (value: unknown, path: string): void => {
    if (value === null || typeof value !== 'object') return;
    if (
      'kind' in value &&
      [
        'custom',
        'reaction',
        'choose-player',
        'chosen-player',
        'chosen-opponent',
      ].includes(String(value.kind))
    )
      throw new AuthoringError(path, 'non-interactive primitive', value);
    for (const [key, child] of Object.entries(value)) {
      // Opaque status metadata is data, not executable instructions.
      if (key !== 'data') inspect(child, `${path}.${key}`);
    }
  };
  inspect(source, 'trigger');
}
