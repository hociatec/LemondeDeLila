import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import type { EffectSource, GameEffectInstruction } from './effects-kit';

type ControlEffectInstruction = Extract<
  GameEffectInstruction,
  { kind: 'conditional' | 'reaction' | 'choose-player' | 'custom' }
>;
export type PrimitiveEffectInstruction = Exclude<
  GameEffectInstruction,
  ControlEffectInstruction
>;
export type PrimitiveEffectHandlers = {
  [TKind in PrimitiveEffectInstruction['kind']]: (
    instruction: Extract<PrimitiveEffectInstruction, { kind: TKind }>,
  ) => boolean;
};

export type EffectEngineDebugSnapshot = {
  queueLength: number;
  queueKinds: string[];
  currentSource: EffectSource | null;
  actorPlayerId: number | null;
  chosenPlayerId: number | null;
  awaitingChoiceId: string | null;
  awaitingReactionChoiceId: string | null;
  awaitingPlayerChoiceId: string | null;
  completeTurnWhenDrained: boolean;
};

export function executeRegisteredPrimitive(
  handlers: PrimitiveEffectHandlers,
  instruction: PrimitiveEffectInstruction,
): boolean {
  switch (instruction.kind) {
    case 'extra-turn':
      return handlers['extra-turn'](instruction);
    case 'roll-dice':
      return handlers['roll-dice'](instruction);
    case 'complete-turn':
      return handlers['complete-turn'](instruction);
    case 'reverse-turn-order':
      return handlers['reverse-turn-order'](instruction);
    case 'transfer-resource':
      return handlers['transfer-resource'](instruction);
    case 'give-card':
      return handlers['give-card'](instruction);
    case 'steal-card':
      return handlers['steal-card'](instruction);
    case 'swap-hands':
      return handlers['swap-hands'](instruction);
    case 'swap-positions':
      return handlers['swap-positions'](instruction);
    case 'steal-random-inventory':
      return handlers['steal-random-inventory'](instruction);
    case 'swap-inventories':
      return handlers['swap-inventories'](instruction);
    case 'exchange-random-inventory':
      return handlers['exchange-random-inventory'](instruction);
    case 'move':
      return handlers.move(instruction);
    case 'move-to':
      return handlers['move-to'](instruction);
    case 'draw-cards':
      return handlers['draw-cards'](instruction);
    case 'discard-random':
      return handlers['discard-random'](instruction);
    case 'discard-random-inventory':
      return handlers['discard-random-inventory'](instruction);
    case 'gain-resource':
      return handlers['gain-resource'](instruction);
    case 'lose-resource':
      return handlers['lose-resource'](instruction);
    case 'gain-score':
      return handlers['gain-score'](instruction);
    case 'skip-turn':
      return handlers['skip-turn'](instruction);
    case 'add-status':
      return handlers['add-status'](instruction);
    case 'remove-status':
      return handlers['remove-status'](instruction);
  }
  throw new GameStateViolationError(
    `Primitive d'effet non enregistrée: ${JSON.stringify(instruction satisfies never)}`,
  );
}
