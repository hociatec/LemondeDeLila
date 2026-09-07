import type { GameStateEntity } from '../../../core/application/contracts/game-state.model';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { DeclarativeState } from '../definitions/game-definition';

export function loadDeclarativeState<TState extends object>(
  state: GameStateEntity,
  gameId: string,
  schemaVersion: number,
  contentVersion: string,
  rulesVersion: string,
): DeclarativeState<TState> {
  const runtime = structuredClone(state) as DeclarativeState<TState>;
  const storedSchemaVersion = runtime.engine.schemaVersion;
  const storedContentVersion = runtime.engine.contentVersion;
  const storedRulesVersion = runtime.engine.rulesVersion;

  if (
    storedSchemaVersion !== schemaVersion ||
    storedContentVersion !== contentVersion ||
    storedRulesVersion !== rulesVersion
  ) {
    throw new GameStateViolationError(
      `État ${gameId} incompatible avec le runtime courant`,
      {
        gameId,
        storedSchemaVersion,
        schemaVersion,
        storedContentVersion,
        contentVersion,
        storedRulesVersion,
        rulesVersion,
      },
    );
  }

  return runtime;
}
