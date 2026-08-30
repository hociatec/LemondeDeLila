import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { TurnPolicy } from '../kits/turn-kit';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { GameActionMap } from './game-definition-contracts';

export function assertNoImplicitActionOverrides<TState extends object>(
  patternActions: GameActionMap<TState>,
  gameActions: GameActionMap<TState>,
  gameId: string,
): void {
  for (const [actionId, action] of Object.entries(gameActions)) {
    if (!(actionId in patternActions) || action.overrides === actionId)
      continue;
    throw new GameConfigurationError(
      `Action "${actionId}" fournie par un pattern et redéfinie par "${gameId}" sans overrideAction() explicite`,
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
  for (const component of gameComponents) {
    const key = `${component.component}:${component.id}`;
    if (patternKeys.has(key) && component.overrides !== key) {
      throw new GameConfigurationError(
        `Composant "${key}" fourni par un pattern et redéfini par "${gameId}" sans overrideComponent() explicite`,
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
  throw new GameConfigurationError(
    `Politique de tour fournie par un pattern et redéfinie par "${gameId}" sans overrideTurn() explicite`,
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
        throw new GameConfigurationError(
          `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
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
    throw new GameConfigurationError(
      'Initialisation scores fournie par un pattern et redéfinie sans overrideInitialization(["scores"], ...) explicite',
    );
  }
  const patternPawns = new Set((pattern.pawns ?? []).map((pawn) => pawn.setId));
  for (const pawn of game.pawns ?? []) {
    const overrideKey = `pawns.${pawn.setId}`;
    if (patternPawns.has(pawn.setId) && !overrides.has(overrideKey)) {
      throw new GameConfigurationError(
        `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
      );
    }
  }
}

function sameTurnPolicy(left: TurnPolicy, right: TurnPolicy): boolean {
  return left.kind === right.kind && left.actionPoints === right.actionPoints;
}
