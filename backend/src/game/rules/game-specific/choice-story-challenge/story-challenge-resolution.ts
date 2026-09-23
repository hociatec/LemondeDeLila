import {
  gameEffects,
  drawAndResolve,
  drawEvent,
} from '../../../engine/sdk/public-api';
import type {
  GameEffectInstruction,
  GameContext,
} from '../../../engine/sdk/public-api';
import { createStoryChallengeChoices } from './story-challenge-choices';
import { consumeFirstProtection } from '../../recipes/protection-cost';
import { rejectRule } from '../../../core/domain/errors/game-domain.errors';
import type {
  StoryChallengeCard,
  StoryChallengeCardType,
  StoryChallengeProgram,
  StoryChallengeTargetEffect,
} from './program';
import type { StoryChallengeDrawResolution as Resolution } from './story-challenge-resolution.types';
type State = Record<string, never>;
type Context = GameContext<State>;
export function createStoryChallengeResolution(program: StoryChallengeProgram) {
  const { statuses, resources } = program;
  const {
    requestOption,
    requestLaughter,
    requestNumber,
    requestAbundance,
    requestToken,
    transferToken,
    requirePending,
  } = createStoryChallengeChoices(program);
  function applyRoll(
    state: State,
    playerId: number,
    value: number,
    ctx: Context,
  ) {
    const delta = ctx.status.consume(playerId, statuses.reverseNextTurn)
      ? -value
      : value;
    moveAndResolve(state, playerId, delta, 0, ctx);
  }
  function moveAndResolve(
    state: State,
    playerId: number,
    delta: number,
    depth: number,
    ctx: Context,
  ) {
    ctx.movement.moveAndResolve({
      trackId: program.trackId,
      playerId,
      distance: delta,
      tiles: program.tiles,
      depth: depth + 1,
      maxDepth: program.maxChainDepth,
      blocked: () => ctx.match.lifecycle() === 'finished',
      onLand: ({ position, tile }) => {
        releaseBlockedPlayers(playerId, ctx);
        applyTile(state, playerId, position, tile, depth + 1, ctx);
      },
    });
  }
  function applyTile(
    state: State,
    playerId: number,
    position: number,
    tile: StoryChallengeProgram['tiles'][number] | undefined,
    depth: number,
    ctx: Context,
  ) {
    if (!tile) return;
    ctx.events.message('game.pawn.landed', { playerId, tileId: position });
    if (tile.type === 'finish')
      ctx.match.finish({ winners: [playerId], reason: program.finishReason });
    else if (tile.type === program.deckRoles.story)
      drawCard(state, playerId, program.deckRoles.story, depth, ctx);
    else if (tile.type === program.deckRoles.reward) {
      if (!ctx.status.has(playerId, statuses.noBonus))
        drawCard(state, playerId, program.deckRoles.reward, depth, ctx);
    } else if (tile.type === program.deckRoles.penalty) {
      if (!consumeMalusProtection(state, playerId, depth, ctx))
        drawCard(state, playerId, program.deckRoles.penalty, depth, ctx);
    } else if (tile.type === program.deckRoles.event)
      drawCard(state, playerId, program.deckRoles.event, depth, ctx);
  }
  function drawCard(
    state: State,
    playerId: number,
    type: StoryChallengeCardType,
    depth: number,
    ctx: Context,
  ) {
    if (depth > program.maxChainDepth || ctx.choice.current()) return;
    drawAndResolve<State, StoryChallengeCard>(ctx, {
      deckId: type,
      playerId,
      resolve: (card) => applyCard(state, playerId, card, depth + 1, ctx),
    });
  }
  function applyCard(
    _state: State,
    playerId: number,
    card: StoryChallengeCard,
    _depth: number,
    ctx: Context,
  ) {
    ctx.effects.schedule(
      ...card.effects.map((effect) => retargetEffect(effect, playerId)),
    );
  }
  function retargetEffect(
    effect: GameEffectInstruction,
    playerId: number,
  ): GameEffectInstruction {
    if (
      effect.kind === 'custom' ||
      effect.kind === 'gain-resource' ||
      effect.kind === 'lose-resource' ||
      effect.kind === 'gain-score' ||
      effect.kind === 'skip-turn' ||
      effect.kind === 'add-status' ||
      effect.kind === 'remove-status' ||
      effect.kind === 'move' ||
      effect.kind === 'move-to' ||
      effect.kind === 'draw-cards' ||
      effect.kind === 'discard-random'
    )
      return effect.target?.kind === 'self'
        ? { ...effect, target: gameEffects.target.player(playerId) }
        : effect;
    return effect;
  }
  function applyTarget(
    state: State,
    actorId: number,
    targetId: number,
    effect: StoryChallengeTargetEffect,
    cardId: number | undefined,
    ctx: Context,
  ) {
    const rule = program.targetRules[effect];
    if (!rule) return rejectRule('Unknown target operation');
    if (rule.kind === 'move')
      moveAndResolve(state, targetId, rule.delta, 0, ctx);
    else if (rule.kind === 'swap-turns')
      ctx.turn.swapUpcoming(actorId, targetId);
    else if (rule.kind === 'give-card') {
      const card = program.decks[rule.deck].find(
        (entry) => entry.id === cardId,
      );
      if (!card) return rejectRule('Unknown card to give');
      applyCard(state, targetId, card, 0, ctx);
    } else if (rule.kind === 'swap-positions')
      ctx.movement.swap(program.trackId, actorId, targetId);
    else if (rule.kind === 'steal-token') requestToken(actorId, targetId, ctx);
    else if (rule.kind === 'follow') {
      ctx.movement.moveTo(
        program.trackId,
        targetId,
        ctx.movement.position(program.trackId, actorId),
      );
      moveAndResolve(state, targetId, rule.delta, 0, ctx);
    } else if (rule.kind === 'option')
      requestOption(actorId, rule.optionId, ctx, targetId);
  }
  function scheduleTarget(
    actorId: number,
    effect: StoryChallengeTargetEffect,
    ctx: Context,
    cardId?: number,
  ) {
    ctx.effects.schedule(
      gameEffects.custom(
        'choice-story-challenge.target',
        { actorId, effect, ...(cardId == null ? {} : { cardId }) },
        gameEffects.target.chosenFrom(
          ctx.players.otherIds(actorId),
          'choice-story-challenge.' + effect,
          false,
          actorId,
        ),
      ),
      gameEffects.completeTurn(),
    );
  }
  function drawBonusGift(_state: State, actorId: number, ctx: Context) {
    const card = drawEvent<State, StoryChallengeCard>(ctx, {
      deckId: program.deckRoles.reward,
      playerId: actorId,
      recycle: true,
      discard: true,
    });
    if (card) scheduleTarget(actorId, program.giftTargetEffect, ctx, card.id);
  }
  function queueDraws(
    playerId: number,
    types: StoryChallengeCardType[],
    ctx: Context,
  ) {
    const resolution = ctx.turn.flags.get<Resolution>(program.resolutionFlag);
    ctx.turn.flags.set(program.resolutionFlag, {
      playerId,
      types: [...(resolution?.types ?? []), ...types],
    });
  }
  function drainDraws(state: State, ctx: Context) {
    let depth = 0;
    let resolution = ctx.turn.flags.get<Resolution>(program.resolutionFlag);
    while (
      ctx.choice.current() == null &&
      resolution &&
      depth < program.maxChainDepth
    ) {
      const [type, ...remainingTypes] = resolution.types;
      const playerId = resolution.playerId;
      if (!type || playerId == null) break;
      ctx.turn.flags.set(program.resolutionFlag, {
        playerId,
        types: remainingTypes,
      });
      drawCard(state, playerId, type, depth, ctx);
      resolution = ctx.turn.flags.get<Resolution>(program.resolutionFlag);
      depth += 1;
    }
  }
  function consumeMalusProtection(
    state: State,
    playerId: number,
    depth: number,
    ctx: Context,
  ) {
    const protection = consumeFirstProtection(ctx, playerId, [
      { status: statuses.cape },
      { resource: resources.shield, amount: 1 },
      { status: statuses.protectNextMalus },
    ]);
    if (protection === 0) {
      moveAndResolve(state, playerId, program.protectionAdvance, depth, ctx);
    }
    return protection !== undefined;
  }
  function previousMalus(
    state: State,
    playerId: number,
    depth: number,
    ctx: Context,
  ) {
    let target = ctx.movement.position(program.trackId, playerId) - 1;
    while (
      target > 0 &&
      program.tiles[target].type !== program.deckRoles.penalty
    )
      target -= 1;
    ctx.movement.moveTo(program.trackId, playerId, Math.max(0, target));
    if (target > 0)
      drawCard(state, playerId, program.deckRoles.penalty, depth, ctx);
  }
  function swapClosestBehind(playerId: number, ctx: Context) {
    const own = ctx.movement.position(program.trackId, playerId);
    const candidates = ctx.players
      .all()
      .filter(
        (player) =>
          player.id !== playerId &&
          ctx.movement.position(program.trackId, player.id) < own,
      )
      .map((player) => player.id);
    const target = ctx.ranking.rank(candidates, {
      value: (id) => ctx.movement.position(program.trackId, id),
      direction: 'desc',
    })[0];
    if (target) ctx.movement.swap(program.trackId, playerId, target.playerId);
  }
  function releaseBlockedPlayers(moverId: number, ctx: Context) {
    const reached = ctx.movement.position(program.trackId, moverId);
    for (const player of ctx.players.all()) {
      const blocked = blockedPosition(ctx, player.id);
      if (player.id !== moverId && blocked != null && reached >= blocked)
        ctx.status.remove(player.id, statuses.blocked);
    }
  }
  function blockedPosition(ctx: Context, playerId: number) {
    const value = ctx.status.get(playerId, statuses.blocked)?.data.position;
    return typeof value === 'number' ? value : null;
  }
  function drainResolution(state: State, ctx: Context) {
    drainDraws(state, ctx);
    if (ctx.choice.current()) return;
    ctx.turn.flags.consume(program.resolutionFlag);
    ctx.turn.complete();
  }
  function extendTurnStatus(
    playerId: number,
    statusId: string,
    turns: number,
    ctx: Context,
  ) {
    const remaining = ctx.status.get(playerId, statusId)?.remaining ?? 0;
    ctx.status.add(playerId, statusId, {
      turns: remaining + turns,
      scope: 'turn',
    });
  }
  return {
    applyRoll,
    moveAndResolve,
    drawCard,
    applyCard,
    applyTarget,
    scheduleTarget,
    requestOption,
    requestLaughter,
    requestNumber,
    requestAbundance,
    drawBonusGift,
    queueDraws,
    drainResolution,
    extendTurnStatus,
    previousMalus,
    swapClosestBehind,
    blockedPosition,
    transferToken,
    requirePending,
  };
}
