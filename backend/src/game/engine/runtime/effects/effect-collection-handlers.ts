import type { GameContext } from '../definitions/game-author-context';
import type { PrimitiveEffectHandlers } from './effect-primitive-executor';
import type { EffectTargetResolver } from './effect-target-resolver';
import { evaluateNumericExpression } from './numeric-expression-evaluator';

type CollectionKinds =
  | 'move'
  | 'move-to'
  | 'move-relative-to'
  | 'move-to-tag'
  | 'draw-cards'
  | 'draw-to-zone'
  | 'shuffle-cards'
  | 'discard-random'
  | 'discard-random-inventory';

export function createCollectionHandlers<TState extends object>(
  context: GameContext<TState>,
  targets: EffectTargetResolver<TState>,
): Pick<PrimitiveEffectHandlers, CollectionKinds> {
  const draw = (deckId: string, recycle?: boolean) =>
    recycle ? context.cards.drawOrRecycle(deckId) : context.cards.draw(deckId);
  return {
    move: (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.movement.move(
          instruction.trackId,
          playerId,
          evaluateNumericExpression(instruction.spaces, context, playerId),
        ),
      ),
    'move-to': (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.movement.moveTo(
          instruction.trackId,
          playerId,
          evaluateNumericExpression(instruction.position, context, playerId),
        ),
      ),
    'move-relative-to': (instruction) => {
      const reference = targets.targets(instruction.reference, instruction);
      if (!reference) return false;
      if (reference[0] == null) return true;
      return targets.applyToTargets(instruction, (playerId) =>
        context.movement.moveTo(
          instruction.trackId,
          playerId,
          context.movement.position(instruction.trackId, reference[0]) +
            evaluateNumericExpression(
              instruction.offset ?? 0,
              context,
              playerId,
            ),
        ),
      );
    },
    'move-to-tag': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        const position = context.movement.taggedPosition(
          instruction.trackId,
          playerId,
          instruction.tag,
          instruction.direction,
          instruction.includeCurrent,
        );
        if (position != null)
          context.movement.moveTo(instruction.trackId, playerId, position);
      }),
    'draw-cards': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1) {
          const card = draw(instruction.deckId, instruction.recycle);
          if (card == null) break;
          context.cards.give(instruction.handId, playerId, card);
        }
      }),
    'draw-to-zone': (instruction) => {
      for (let count = 0; count < instruction.count; count += 1) {
        const card = draw(instruction.deckId, instruction.recycle);
        if (card == null) break;
        context.cards.putInZone(instruction.zoneId, card);
      }
      return true;
    },
    'shuffle-cards': (instruction) => {
      context.cards.shuffle(instruction.deckId);
      return true;
    },
    'discard-random': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1)
          if (
            !context.cards.discardRandom(
              instruction.handId,
              instruction.deckId,
              playerId,
            )
          )
            break;
      }),
    'discard-random-inventory': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1)
          if (
            !context.inventory.removeRandom(instruction.inventoryId, playerId)
          )
            break;
      }),
  };
}
