import type { GameContext } from '../game-rule-context';
import type { EffectEngineState } from './effects-kit';
import type { PrimitiveEffectHandlers } from './effect-primitive-executor';
import type { EffectTargetResolver } from './effect-target-resolver';

type HandlerGroup<TKind extends keyof PrimitiveEffectHandlers> = Pick<
  PrimitiveEffectHandlers,
  TKind
>;
type HandlerInput<TState extends object> = {
  state: EffectEngineState;
  context: GameContext<TState>;
  targets: EffectTargetResolver<TState>;
};

function createControlHandlers<TState extends object>({
  state,
  context,
  targets,
}: HandlerInput<TState>): HandlerGroup<
  | 'extra-turn'
  | 'roll-dice'
  | 'complete-turn'
  | 'reverse-turn-order'
  | 'transfer-resource'
> {
  return {
    'extra-turn': (instruction) => {
      context.turn.extra(instruction.count ?? 1);
      return true;
    },
    'roll-dice': (instruction) => {
      context.dice.roll(instruction.diceId ?? 'main');
      return true;
    },
    'complete-turn': () => {
      state.completeTurnWhenDrained = true;
      return true;
    },
    'reverse-turn-order': () => {
      context.turn.reverse();
      return true;
    },
    'transfer-resource': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (fromPlayerId, toPlayerId) =>
          context.resources.transfer(
            fromPlayerId,
            toPlayerId,
            instruction.resource,
            instruction.amount,
          ),
      ),
  };
}

function createCardHandlers<TState extends object>({
  context,
  targets,
}: HandlerInput<TState>): HandlerGroup<
  'give-card' | 'steal-card' | 'swap-hands'
> {
  return {
    'give-card': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (fromPlayerId, toPlayerId) =>
          context.cards.transfer(
            instruction.handId,
            fromPlayerId,
            toPlayerId,
            instruction.cardId,
          ),
      ),
    'steal-card': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (fromPlayerId, toPlayerId) => {
          for (let count = 0; count < (instruction.count ?? 1); count += 1) {
            if (
              !context.cards.stealRandom(
                instruction.handId,
                fromPlayerId,
                toPlayerId,
              )
            )
              break;
          }
        },
      ),
    'swap-hands': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (leftPlayerId, rightPlayerId) =>
          context.cards.swapHands(
            instruction.handId,
            leftPlayerId,
            rightPlayerId,
          ),
      ),
  };
}

function createInventoryHandlers<TState extends object>({
  context,
  targets,
}: HandlerInput<TState>): HandlerGroup<
  | 'swap-positions'
  | 'steal-random-inventory'
  | 'swap-inventories'
  | 'exchange-random-inventory'
> {
  return {
    'swap-positions': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (left, right) =>
          context.movement.swap(instruction.trackId, left, right),
      ),
    'steal-random-inventory': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (from, to) => {
          for (let count = 0; count < (instruction.count ?? 1); count += 1) {
            if (
              !context.inventory.stealRandom(instruction.inventoryId, from, to)
            )
              break;
          }
        },
      ),
    'swap-inventories': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (left, right) =>
          context.inventory.swap(instruction.inventoryId, left, right),
      ),
    'exchange-random-inventory': (instruction) =>
      targets.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (left, right) =>
          context.inventory.exchangeRandom(
            instruction.inventoryId,
            left,
            right,
          ),
      ),
  };
}

function createCollectionHandlers<TState extends object>({
  context,
  targets,
}: HandlerInput<TState>): HandlerGroup<
  | 'move'
  | 'move-to'
  | 'draw-cards'
  | 'discard-random'
  | 'discard-random-inventory'
> {
  return {
    move: (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.movement.move(
          instruction.trackId,
          playerId,
          instruction.spaces,
        ),
      ),
    'move-to': (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.movement.moveTo(
          instruction.trackId,
          playerId,
          instruction.position,
        ),
      ),
    'draw-cards': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1) {
          const card = instruction.recycle
            ? context.cards.drawOrRecycle(instruction.deckId)
            : context.cards.draw(instruction.deckId);
          if (card == null) break;
          context.cards.give(instruction.handId, playerId, card);
        }
      }),
    'discard-random': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1) {
          if (
            !context.cards.discardRandom(
              instruction.handId,
              instruction.deckId,
              playerId,
            )
          )
            break;
        }
      }),
    'discard-random-inventory': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1) {
          if (
            !context.inventory.removeRandom(instruction.inventoryId, playerId)
          )
            break;
        }
      }),
  };
}

function createPlayerValueHandlers<TState extends object>({
  context,
  targets,
}: HandlerInput<TState>): HandlerGroup<
  | 'gain-resource'
  | 'lose-resource'
  | 'gain-score'
  | 'skip-turn'
  | 'add-status'
  | 'remove-status'
> {
  return {
    'gain-resource': (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.resources.add(
          playerId,
          instruction.resource,
          instruction.amount,
        ),
      ),
    'lose-resource': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        const available = context.resources.get(playerId, instruction.resource);
        const amount = instruction.allowPartial
          ? Math.min(instruction.amount, available)
          : instruction.amount;
        if (amount > 0)
          context.resources.remove(playerId, instruction.resource, amount);
      }),
    'gain-score': (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.score.add(playerId, instruction.amount),
      ),
    'skip-turn': (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.turn.skip(playerId, instruction.count ?? 1),
      ),
    'add-status': (instruction) =>
      targets.applyToTargets(instruction, (playerId) => {
        const turns = instruction.stack
          ? (context.status.get(playerId, instruction.status)?.remaining ?? 0) +
            (instruction.turns ?? 1)
          : instruction.turns;
        context.status.add(playerId, instruction.status, {
          turns,
          scope: instruction.scope,
          data: instruction.data,
        });
      }),
    'remove-status': (instruction) =>
      targets.applyToTargets(instruction, (playerId) =>
        context.status.remove(playerId, instruction.status),
      ),
  };
}

/** Application adapters for primitive effects, isolated from queue resolution. */
export function createPrimitiveEffectHandlers<TState extends object>(
  input: HandlerInput<TState>,
): PrimitiveEffectHandlers {
  return {
    ...createControlHandlers(input),
    ...createCardHandlers(input),
    ...createInventoryHandlers(input),
    ...createCollectionHandlers(input),
    ...createPlayerValueHandlers(input),
  };
}
