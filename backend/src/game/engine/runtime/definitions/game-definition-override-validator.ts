import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { TurnPolicy } from '../kits/turn-kit';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import { withAuthoringPath } from '../contracts/authoring-origin';
import { authoringProperty } from '../contracts/authoring-diagnostics';

export function assertNoImplicitActionOverrides<TState extends object>(
  patternActions: GameActionMap<TState>,
  gameActions: GameActionMap<TState>,
  gameId: string,
): void {
  for (const [actionId, action] of Object.entries(gameActions)) {
    const inherited = Object.hasOwn(patternActions, actionId);
    if (
      action.overrides != null &&
      (!inherited || action.overrides !== actionId)
    ) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Action "${actionId}" de "${gameId}": cible de remplacement inconnue ou incohérente`,
        ),
        `${authoringProperty('actions', actionId)}.overrides`,
      );
    }
    if (!inherited || action.overrides === actionId) continue;
    throw withAuthoringPath(
      new GameConfigurationError(
        `Action "${actionId}" fournie par un pattern et redéfinie par "${gameId}" sans overrideAction() explicite`,
      ),
      authoringProperty('actions', actionId),
    );
  }
}

export function assertNoImplicitComponentOverrides(
  patternComponents: readonly GameComponentDefinition[],
  gameComponents: readonly GameComponentDefinition[],
  gameId: string,
): void {
  const patternKeys = new Set(
    patternComponents.map(
      (component) => `${component.component}:${component.id}`,
    ),
  );
  for (const [index, component] of gameComponents.entries()) {
    const key = `${component.component}:${component.id}`;
    if (
      component.overrides != null &&
      (component.overrides !== key || !patternKeys.has(key))
    ) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Composant "${key}" de "${gameId}": cible de remplacement inconnue ou incohérente`,
        ),
        `components[${index}].overrides`,
      );
    }
    if (patternKeys.has(key) && component.overrides !== key) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Composant "${key}" fourni par un pattern et redéfini par "${gameId}" sans overrideComponent() explicite`,
        ),
        `components[${index}].id`,
      );
    }
  }
}

export function assertNoImplicitTurnOverride(
  pattern: TurnPolicy | undefined,
  game: TurnPolicy | undefined,
  gameId: string,
): void {
  if (!pattern || !game || sameTurnPolicy(pattern, game) || game.overrides)
    return;
  throw withAuthoringPath(
    new GameConfigurationError(
      `Politique de tour fournie par un pattern et redéfinie par "${gameId}" sans overrideTurn() explicite`,
    ),
    'turn',
  );
}

export function assertNoImplicitInitializationOverrides(
  pattern: GameInitialization,
  game: GameInitialization,
): void {
  const overrides = new Set(game.overrides ?? []);
  const assertKeys = (
    kind: 'resources' | 'counters' | 'tracks',
    labels: Readonly<Record<string, unknown>> | undefined,
    inherited: Readonly<Record<string, unknown>> | undefined,
  ) => {
    for (const key of Object.keys(labels ?? {})) {
      if (!(key in (inherited ?? {}))) continue;
      const overrideKey = `${kind}.${key}`;
      if (!overrides.has(overrideKey)) {
        throw withAuthoringPath(
          new GameConfigurationError(
            `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
          ),
          authoringProperty(`initialization.${kind}`, key),
        );
      }
    }
  };
  assertKeys('resources', game.resources, pattern.resources);
  assertKeys('counters', game.counters, pattern.counters);
  assertKeys('tracks', game.tracks, pattern.tracks);
  if (
    game.scores != null &&
    pattern.scores != null &&
    !overrides.has('scores')
  ) {
    throw withAuthoringPath(
      new GameConfigurationError(
        'Initialisation scores fournie par un pattern et redéfinie sans overrideInitialization(["scores"], ...) explicite',
      ),
      'initialization.scores',
    );
  }
  const patternPawns = new Set((pattern.pawns ?? []).map((pawn) => pawn.setId));
  for (const [index, pawn] of (game.pawns ?? []).entries()) {
    const overrideKey = `pawns.${pawn.setId}`;
    if (patternPawns.has(pawn.setId) && !overrides.has(overrideKey)) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
        ),
        `initialization.pawns[${index}].setId`,
      );
    }
  }
}

function sameTurnPolicy(left: TurnPolicy, right: TurnPolicy): boolean {
  return left.kind === right.kind && left.actionPoints === right.actionPoints;
}
