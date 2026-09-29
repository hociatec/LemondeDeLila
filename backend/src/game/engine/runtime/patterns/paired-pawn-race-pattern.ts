import { defineEmptyAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import {
  defineActorEffect,
  defineEffect,
  defineEmptyEffect,
} from '../effects/effects-core';
import { drawAndResolve } from '../recipes/gameplay-recipes';
import { definePattern } from './gameplay-pattern-core';
type State = Record<string, never>;
type Context = GameContext<State>;
type Rule = {
  kind: 'none' | 'gain' | 'draw' | 'move' | 'skip' | 'meeting' | 'finish';
  amount: number;
};
export type PairedPawnRaceOptions = {
  rollRecipe: string;
  trackId: string;
  diceId: string;
  deckId: string;
  tokenResource: string;
  bonusRerollStatus: string;
  tokensToWin: number;
  maxDepth: number;
  finishReason: string;
  eventNamespace: string;
  tiles: readonly {
    id: number;
    title: string;
    description?: string;
    type: string;
  }[];
  cards: readonly {
    id: number;
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
  transferAmount: number;
  sharedAdvance: number;
  meetingAdvance: number;
  rollMinimum: number;
  rollAdvance: number;
  tileRules: Readonly<Record<string, Rule>>;
};
export function pairedPawnRace(source: PairedPawnRaceOptions) {
  const program = structuredClone(source);
  const applyTile = (
    playerId: number,
    position: number,
    depth: number,
    ctx: Context,
  ): void => {
    if (depth > program.maxDepth || ctx.choice.current() != null) return;
    const tile = program.tiles[position];
    if (!tile) return;
    const rule = program.tileRules[tile.type];
    if (rule.kind === 'gain')
      ctx.resources.add(playerId, program.tokenResource, rule.amount);
    else if (rule.kind === 'draw') drawCard(playerId, ctx);
    else if (rule.kind === 'move')
      moveAndApply(playerId, rule.amount, depth + 1, ctx);
    else if (rule.kind === 'skip') ctx.turn.skip(playerId, rule.amount);
    else if (rule.kind === 'meeting')
      ctx.effects.schedule(
        {
          kind: 'custom',
          effectId: 'pairedPawn.meeting',
          data: {},
          target: {
            kind: 'chosen-opponent',
            optional: false,
            choiceId: 'pairedPawn.meeting',
          },
        },
        { kind: 'complete-turn' },
      );
    else if (rule.kind === 'finish')
      finishOrRewind(playerId, position, depth + 1, ctx);
  };
  const setPosition = (playerId: number, position: number, ctx: Context) => {
    ctx.movement.move(
      program.trackId,
      playerId,
      position - ctx.movement.position(program.trackId, playerId),
    );
  };
  const moveAndApply = (
    playerId: number,
    delta: number,
    depth: number,
    ctx: Context,
  ): void => {
    if (ctx.choice.current() != null) return;
    const position = ctx.movement.move(program.trackId, playerId, delta);
    applyTile(playerId, position, depth, ctx);
  };
  const drawCard = (playerId: number, ctx: Context) =>
    drawAndResolve<
      State,
      { id: number; effects: readonly GameEffectInstruction[] }
    >(ctx, {
      deckId: program.deckId,
      playerId,
      resolve: (card) => ctx.effects.schedule(...card.effects),
    });
  const finishOrRewind = (
    playerId: number,
    position: number,
    depth: number,
    ctx: Context,
  ): void => {
    const tokens = ctx.resources.get(playerId, program.tokenResource);
    if (tokens >= program.tokensToWin)
      return ctx.match.finish({
        winners: [playerId],
        reason: program.finishReason,
      });
    const rewind = Math.min(position, program.tokensToWin - tokens);
    setPosition(playerId, position - rewind, ctx);
    applyTile(playerId, position - rewind, depth, ctx);
  };
  const moveToType = (
    playerId: number,
    type: string,
    direction: 1 | -1,
    ctx: Context,
  ): void => {
    let index = ctx.movement.position(program.trackId, playerId) + direction;
    while (index >= 0 && index < program.tiles.length) {
      if (program.tiles[index]?.type === type) {
        setPosition(playerId, index, ctx);
        applyTile(playerId, index, 0, ctx);
        return;
      }
      index += direction;
    }
  };
  return definePattern({
    id: `paired-pawn-race:${program.trackId}`,
    mechanics: ['race', 'cards', 'resources', 'effects'],
    actions: {
      [program.rollRecipe]: defineEmptyAction<State>({
        execute: ({ actor, ctx }) => {
          const extraDice = ctx.status.consume(
            actor.id,
            program.bonusRerollStatus,
          )
            ? 1
            : 0;
          const total = ctx.dice.rollWith(program.diceId, { extraDice }).total;
          const last = program.tiles.length - 1;
          const current = ctx.movement.position(program.trackId, actor.id);
          const rawTarget = current + total;
          const target =
            rawTarget > last
              ? Math.max(0, last - (rawTarget - last))
              : rawTarget;
          setPosition(actor.id, target, ctx);
          ctx.events.message('game.pawn.moved', {
            playerId: actor.id,
            distance: total,
            target,
          });
          applyTile(actor.id, target, 0, ctx);
          if (
            ctx.match.lifecycle() !== 'finished' &&
            ctx.choice.current() == null
          )
            ctx.turn.end();
        },
        documentation: 'Lance le dé et résout la chaîne de cases.',
      }),
    },
    effects: {
      'pairedPawn.move': defineEffect<State, { delta: number }>({
        input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
        apply: ({ targetPlayerIds, data, ctx }) =>
          targetPlayerIds.forEach((id) => moveAndApply(id, data.delta, 0, ctx)),
      }),
      'pairedPawn.move-to-type': defineEffect<
        State,
        { type: string; direction: 'forward' | 'backward' }
      >({
        input: gameInput.object({
          type: gameInput.enum(Object.keys(program.tileRules)),
          direction: gameInput.enum(['forward', 'backward']),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            moveToType(
              actorPlayerId,
              data.type,
              data.direction === 'forward' ? 1 : -1,
              ctx,
            );
        },
      }),
      'pairedPawn.transfer-token': defineEmptyEffect<State>(
        ({ actorPlayerId, targetPlayerIds, ctx }) => {
          const targetId = targetPlayerIds[0];
          if (
            actorPlayerId != null &&
            targetId != null &&
            ctx.resources.has(
              actorPlayerId,
              program.tokenResource,
              program.transferAmount,
            )
          )
            ctx.resources.transfer(
              actorPlayerId,
              targetId,
              program.tokenResource,
              program.transferAmount,
            );
        },
      ),
      'pairedPawn.share-advance': defineEmptyEffect<State>(
        ({ targetPlayerIds, ctx }) => {
          const id = targetPlayerIds[0];
          if (id != null) moveAndApply(id, program.sharedAdvance, 0, ctx);
        },
      ),
      'pairedPawn.meeting': defineEmptyEffect<State>(
        ({ actorPlayerId, targetPlayerIds, ctx }) => {
          if (actorPlayerId != null)
            moveAndApply(actorPlayerId, program.meetingAdvance, 0, ctx);
          const id = targetPlayerIds[0];
          if (id != null && ctx.match.lifecycle() !== 'finished')
            moveAndApply(id, program.meetingAdvance, 0, ctx);
        },
      ),
      'pairedPawn.roll-move': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) =>
          moveAndApply(
            actorPlayerId,
            ctx.dice.roll(program.diceId).total,
            0,
            ctx,
          ),
      ),
      'pairedPawn.roll-threshold-move': defineEmptyEffect<State>(
        ({ actorPlayerId, ctx }) => {
          if (
            actorPlayerId != null &&
            ctx.dice.roll(program.diceId).total >= program.rollMinimum
          )
            moveAndApply(actorPlayerId, program.rollAdvance, 0, ctx);
        },
      ),
    },
  });
}
