import type { GameContext } from '../../definitions/game-author-context';
import type {
  BoardGameProgram,
  BoardLanding,
} from '../../contracts/board-game-program';
import { GameStateViolationError } from '../../../../core/domain/errors/game-domain.errors';
import { resolveTrackMovement } from './movement-quiz.recipes';

export type BoardContinuation =
  | { kind: 'direction'; actorId: number; distance: number }
  | { kind: 'quiz'; actorId: number; sessionId: string }
  | { kind: 'take'; actorId: number; targetId: number }
  | { kind: 'give'; actorId: number; targetId: number; take: string };

/** Movement remains owned by Movement; this interpreter only orders landing rules. */
export class BoardLandingResolver<TState extends object> {
  constructor(
    readonly program: BoardGameProgram,
    readonly pendingDrawFlag: string,
  ) {}

  move(
    playerId: number,
    distance: number,
    depth: number,
    ctx: GameContext<TState>,
  ): void {
    const before = ctx.movement.position(this.program.trackId, playerId);
    resolveTrackMovement({
      ctx,
      trackId: this.program.trackId,
      playerId,
      distance,
      depth,
      maxDepth: this.program.maxDepth,
      tiles: this.program.tiles,
      onLand: () => {
        if (
          distance > 0 &&
          before + distance >= this.program.tiles.length &&
          this.program.scorePerForwardLap
        )
          ctx.score.add(playerId, this.program.scorePerForwardLap);
        const position = ctx.movement.position(this.program.trackId, playerId);
        for (const operation of this.program.tiles[position]?.operations ??
          []) {
          this.resolve(operation, playerId, depth + 1, ctx);
          if (ctx.choice.current() || ctx.match.lifecycle() === 'finished')
            break;
        }
      },
    });
  }

  nearest(
    playerId: number,
    tag: string,
    depth: number,
    ctx: GameContext<TState>,
  ): void {
    const position = ctx.movement.position(this.program.trackId, playerId);
    for (let distance = 1; distance < this.program.tiles.length; distance++) {
      if (
        this.program.tiles[
          (position + distance) % this.program.tiles.length
        ].tags?.includes(tag)
      ) {
        this.move(playerId, distance, depth, ctx);
        return;
      }
    }
  }

  collect(
    playerId: number,
    sourceId: string | undefined,
    ctx: GameContext<TState>,
  ): void {
    const collection = this.program.collection;
    if (!collection)
      throw new GameStateViolationError('Missing board collection');
    const source =
      collection.sources[sourceId ?? collection.defaultSourceId] ??
      collection.sources[collection.defaultSourceId];
    const item = ctx.random.pick(source);
    if (!item) return;
    const required =
      ctx.inventory.has(collection.requiredInventoryId, playerId, item) &&
      !ctx.inventory.has(collection.collectedInventoryId, playerId, item);
    ctx.inventory.add(
      required
        ? collection.collectedInventoryId
        : collection.overflowInventoryId,
      playerId,
      item,
    );
    ctx.events.message(
      required ? collection.collectedMessage : collection.overflowMessage,
      { playerId, itemId: item },
    );
  }

  quiz(playerId: number, ctx: GameContext<TState>): void {
    const config = this.program.quiz;
    if (!config) throw new GameStateViolationError('Missing board quiz');
    const session = ctx.quiz.ask(config.bankId, [playerId]);
    if (!session) return;
    ctx.choice.one({
      id: config.choiceId,
      player: playerId,
      options: session.question.choices.map((_, index) => index),
      label: (index) => session.question.choices[index] ?? String(index),
      data: {
        kind: 'quiz',
        actorId: playerId,
        sessionId: session.id,
      } satisfies BoardContinuation,
    });
    ctx.events.message('game.quiz.started', {
      playerId,
      questionId: session.question.id,
    });
  }

  exchange(actorId: number, targetId: number, ctx: GameContext<TState>): void {
    const config = this.program.exchange;
    if (!config) throw new GameStateViolationError('Missing board exchange');
    const cards = ctx.inventory.items(config.inventoryId, targetId);
    if (!cards.length) return;
    ctx.choice.one({
      id: config.takeChoiceId,
      player: actorId,
      options: cards,
      data: { kind: 'take', actorId, targetId } satisfies BoardContinuation,
    });
  }

  private resolve(
    operation: BoardLanding,
    playerId: number,
    depth: number,
    ctx: GameContext<TState>,
  ): void {
    switch (operation.kind) {
      case 'move':
        this.move(playerId, operation.distance, depth, ctx);
        return;
      case 'random-move':
        this.move(
          playerId,
          (operation.minimum +
            ctx.random.int(operation.maximum - operation.minimum + 1)) *
            operation.direction,
          depth,
          ctx,
        );
        return;
      case 'choose-direction':
        if (!this.program.directionChoiceId)
          throw new GameStateViolationError('Missing direction choice');
        ctx.choice.one({
          id: this.program.directionChoiceId,
          player: playerId,
          options: ['forward', 'backward'],
          data: {
            kind: 'direction',
            actorId: playerId,
            distance: operation.distance,
          } satisfies BoardContinuation,
        });
        return;
      case 'skip':
        ctx.turn.skip(playerId, operation.turns);
        return;
      case 'draw':
        ctx.turn.flags.set(this.pendingDrawFlag, {
          playerId,
          deckId: operation.deckId,
        });
        return;
      case 'collect':
        this.collect(playerId, operation.sourceId, ctx);
        return;
      case 'quiz':
        this.quiz(playerId, ctx);
        return;
      case 'nearest':
        this.nearest(playerId, operation.tag, depth, ctx);
        return;
      case 'finish':
        ctx.match.finish({ winners: [playerId], reason: operation.reason });
        return;
      case 'finish-collection': {
        const collection = this.program.collection;
        if (!collection)
          throw new GameStateViolationError('Missing board collection');
        if (
          ctx.score.get(playerId) >= operation.minimumScore &&
          ctx.inventory
            .items(collection.requiredInventoryId, playerId)
            .every((item) =>
              ctx.inventory.has(
                collection.collectedInventoryId,
                playerId,
                item,
              ),
            )
        ) {
          ctx.match.finish({ winners: [playerId], reason: operation.reason });
        }
      }
    }
  }
}
