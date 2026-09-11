import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';
import { assertEffectInstructions } from '../effects/game-effect-definition-validator';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import { freezeGameContent } from './game-content';
import type { GameInputSchema } from '../actions/game-input-schema';
import {
  assertEffectJson,
  effectJsonSchema,
} from '../contracts/effect-json-schema';

export type EffectContentReferences = {
  decks?: readonly string[];
  hands?: readonly string[];
  inventories?: readonly string[];
  tracks?: readonly string[];
  diceSets?: readonly string[];
  effects?: readonly string[];
  resources?: readonly string[];
};

export function effectContentSchema(
  references: EffectContentReferences = {},
): GameInputSchema<readonly GameEffectInstruction[]> {
  return {
    parse: (value) => effectContent(value, references),
    describe: () => structuredClone(effectJsonSchema),
  };
}

/** Parse executable content with the same grammar used by definition compilation. */
export function effectContent(
  value: unknown,
  references: EffectContentReferences = {},
): readonly GameEffectInstruction[] {
  const entries = (ids: readonly string[] = []) =>
    ids.map((id) => [id, true] as const);
  try {
    // TypeScript builders may materialize optional properties as undefined.
    // Preserve them (and the existing content fingerprint) while validating the same grammar.
    assertEffectJson(value, 'effects', true);
    assertEffectInstructions(
      value,
      'effects',
      {
        decks: new Map(entries(references.decks)),
        hands: new Map(entries(references.hands)),
        inventories: new Map(entries(references.inventories)),
        tracks: new Set(references.tracks),
        diceSets: new Set(references.diceSets),
        effects: Object.fromEntries(entries(references.effects)),
        resources:
          references.resources == null
            ? undefined
            : new Set(references.resources),
      },
      (path, reason) => {
        throw new GameContentValidationError(`${path}: ${reason}`);
      },
    );
    return freezeGameContent(structuredClone(value));
  } catch (error) {
    if (error instanceof GameContentValidationError) throw error;
    throw new GameContentValidationError(
      error instanceof Error ? error.message : 'Séquence d’effets invalide',
    );
  }
}
