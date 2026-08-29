import { GameNotFoundError } from '../../domain/errors/game-domain.errors';
import type {
  EffectEngineState,
  EffectSource,
  GameEffectInstruction,
  GameEffectResolverShape,
} from './effects-kit';
import type { GameContext } from './game-rule-context';

export function executeCustomEffect<TState extends object>(input: {
  instruction: Extract<GameEffectInstruction, { kind: 'custom' }>;
  resolvers: Readonly<Record<string, GameEffectResolverShape<TState>>>;
  gameState: () => TState;
  engineState: EffectEngineState;
  source: EffectSource | null;
  context: GameContext<TState>;
  targets: () => number[] | null;
}): boolean {
  const resolver = input.resolvers[input.instruction.effectId];
  if (!resolver) {
    throw new GameNotFoundError(
      `Effet de jeu inconnu: ${input.instruction.effectId}`,
    );
  }
  const targetPlayerIds = input.instruction.target ? input.targets() : [];
  if (!targetPlayerIds) return false;
  resolver.resolveRaw({
    state: input.gameState(),
    actorPlayerId: input.engineState.actorPlayerId,
    source: input.source,
    targetPlayerIds,
    data: input.instruction.data ?? {},
    ctx: input.context,
  });
  input.context.events.engine('game.effect.resolved', {
    effectId: input.instruction.effectId,
  });
  return true;
}
