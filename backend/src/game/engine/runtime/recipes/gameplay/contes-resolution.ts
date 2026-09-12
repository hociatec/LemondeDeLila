import type {
  ContesCard,
  ContesCardType,
  ContesOptionEffect,
  ContesProgram,
  ContesTargetEffect,
} from '../../contracts/contes-program';
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { GameContext } from '../../definitions/game-author-context';
import { gameEffects } from '../../effects/effects-dsl';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import { drawAndResolve, drawEvent } from './card-dice.recipes';
type State = Record<string, never>;
type Context = GameContext<State>;
type Pending =
  | { kind: 'reroll'; actorId: number; roll: number }
  | {
      kind: 'option';
      actorId: number;
      effect: ContesOptionEffect;
      targetId?: number;
    }
  | {
      kind: 'laughter';
      actorId: number;
      order: number[];
      picks: Record<number, number>;
    }
  | { kind: 'abundance'; actorId: number; cardIds: number[] }
  | { kind: 'token'; actorId: number; targetId: number; tokens: string[] };
type Resolution = { playerId: number; types: ContesCardType[] };

export function createContesResolution(program: ContesProgram) {
  const { statuses, resources } = program;

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
    tile: ContesProgram['tiles'][number] | undefined,
    depth: number,
    ctx: Context,
  ) {
    if (!tile) return;
    ctx.events.message('game.pawn.landed', { playerId, tileId: position });
    if (tile.type === 'finish')
      ctx.match.finish({ winners: [playerId], reason: 'story-road-finished' });
    else if (tile.type === 'conte')
      drawCard(state, playerId, 'conte', depth, ctx);
    else if (tile.type === 'bonus') {
      if (!ctx.status.has(playerId, statuses.noBonus))
        drawCard(state, playerId, 'bonus', depth, ctx);
    } else if (tile.type === 'malus') {
      if (!consumeMalusProtection(state, playerId, depth, ctx))
        drawCard(state, playerId, 'malus', depth, ctx);
    } else if (tile.type === 'surprise')
      drawCard(state, playerId, 'surprise', depth, ctx);
  }
  function drawCard(
    state: State,
    playerId: number,
    type: ContesCardType,
    depth: number,
    ctx: Context,
  ) {
    if (depth > program.maxChainDepth || ctx.choice.current()) return;
    drawAndResolve<State, ContesCard>(ctx, {
      deckId: type,
      playerId,
      resolve: (card) => applyCard(state, playerId, card, depth + 1, ctx),
    });
  }
  function applyCard(
    _state: State,
    playerId: number,
    card: ContesCard,
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
    effect: ContesTargetEffect,
    cardId: number | undefined,
    ctx: Context,
  ) {
    if (effect === 'move-other-two') moveAndResolve(state, targetId, 2, 0, ctx);
    else if (effect === 'swap-next-turns')
      ctx.turn.swapUpcoming(actorId, targetId);
    else if (effect === 'give-bonus') {
      if (cardId == null) rejectRule('Carte Ã  donner absente');
      const card = program.decks.bonus.find((entry) => entry.id === cardId);
      if (!card) rejectRule('Carte Bonus absente');
      applyCard(state, targetId, card, 0, ctx);
    } else if (effect === 'swap-positions' || effect === 'wish-swap')
      ctx.movement.swap(program.trackId, actorId, targetId);
    else if (effect === 'steal-token' || effect === 'song-steal')
      requestToken(actorId, targetId, ctx);
    else if (effect === 'travelling-book') {
      const actorPosition = ctx.movement.position(program.trackId, actorId);
      ctx.movement.moveTo(program.trackId, targetId, actorPosition);
      moveAndResolve(state, targetId, 1, 0, ctx);
    } else requestOption(actorId, 'gold-key-type', ctx, targetId);
  }
  function scheduleTarget(
    actorId: number,
    effect: ContesTargetEffect,
    ctx: Context,
    cardId?: number,
  ) {
    ctx.effects.schedule(
      gameEffects.custom(
        'contes.target',
        { actorId, effect, ...(cardId == null ? {} : { cardId }) },
        gameEffects.target.chosenFrom(
          ctx.players.otherIds(actorId),
          'contes.' + effect,
          false,
          actorId,
        ),
      ),
      gameEffects.completeTurn(),
    );
  }
  function requestOption(
    actorId: number,
    effect: ContesOptionEffect,
    ctx: Context,
    targetId?: number,
  ) {
    const options =
      effect === 'song'
        ? ['move-three', 'steal-bonus']
        : effect === 'wish'
          ? ['move-two', 'swap', 'draw-bonus']
          : ['bonus', 'malus'];
    const pending: Pending = {
      kind: 'option',
      actorId,
      effect,
      targetId,
    };
    ctx.choice.one({
      id: 'contes.option',
      player: actorId,
      options,
      data: pending,
    });
  }
  function requestLaughter(actorId: number, ctx: Context) {
    const pending: Extract<Pending, { kind: 'laughter' }> = {
      kind: 'laughter',
      actorId,
      order: ctx.players.all().map((player) => player.id),
      picks: {},
    };
    requestNumber(actorId, ctx, pending);
  }
  function requestNumber(
    playerId: number,
    ctx: Context,
    pending: Extract<Pending, { kind: 'laughter' }>,
  ) {
    ctx.choice.one({
      id: 'contes.number',
      player: playerId,
      options: [1, 2, 3],
      data: pending,
    });
  }
  function requestAbundance(actorId: number, ctx: Context) {
    const cards = [
      ctx.cards.drawOrRecycle<ContesCard>('bonus'),
      ctx.cards.drawOrRecycle<ContesCard>('bonus'),
    ].filter((card): card is ContesCard => card != null);
    for (const card of cards) ctx.cards.discard('bonus', card);
    if (cards.length === 0) return;
    const pending: Pending = {
      kind: 'abundance',
      actorId,
      cardIds: cards.map((card) => card.id),
    };
    ctx.choice.one({
      id: 'contes.card',
      player: actorId,
      options: cards.map((card) => card.id),
      data: pending,
      label: (id) => cards.find((card) => card.id === id)?.title ?? String(id),
    });
  }
  function drawBonusGift(_state: State, actorId: number, ctx: Context) {
    const card = drawEvent<State, ContesCard>(ctx, {
      deckId: 'bonus',
      playerId: actorId,
      recycle: true,
      discard: true,
    });
    if (card) scheduleTarget(actorId, 'give-bonus', ctx, card.id);
  }
  function requestToken(actorId: number, targetId: number, ctx: Context) {
    const tokens = listTokens(targetId, ctx);
    if (tokens.length === 0) return;
    const pending: Pending = {
      kind: 'token',
      actorId,
      targetId,
      tokens,
    };
    ctx.choice.one({
      id: 'contes.token',
      player: actorId,
      options: tokens,
      data: pending,
    });
  }
  function listTokens(playerId: number, ctx: Context) {
    const tokens: string[] = [];
    if (ctx.resources.has(playerId, resources.reroll, 1))
      tokens.push('parchemin');
    if (ctx.resources.has(playerId, resources.shield, 1))
      tokens.push('amulette');
    if (ctx.status.has(playerId, statuses.cape)) tokens.push('cape');
    if (ctx.status.has(playerId, statuses.keyOfGold)) tokens.push('cle-or');
    if (ctx.status.has(playerId, statuses.replaceOne)) tokens.push('feuille');
    if (ctx.status.has(playerId, statuses.reverseNextTurn))
      tokens.push('livre-envers');
    if (ctx.status.has(playerId, statuses.protectNextMalus))
      tokens.push('dragon-papier');
    return tokens;
  }
  function transferToken(
    fromId: number,
    toId: number,
    token: string,
    ctx: Context,
  ) {
    if (token === 'parchemin') {
      ctx.resources.transfer(fromId, toId, resources.reroll, 1);
      return;
    }
    if (token === 'amulette') {
      ctx.resources.transfer(fromId, toId, resources.shield, 1);
      return;
    }
    const statusId =
      token === 'cape'
        ? statuses.cape
        : token === 'cle-or'
          ? statuses.keyOfGold
          : token === 'feuille'
            ? statuses.replaceOne
            : token === 'livre-envers'
              ? statuses.reverseNextTurn
              : statuses.protectNextMalus;
    ctx.status.remove(fromId, statusId);
    ctx.status.add(toId, statusId, { scope: 'until-used' });
  }
  function queueDraws(playerId: number, types: ContesCardType[], ctx: Context) {
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
    if (ctx.status.consume(playerId, statuses.cape)) {
      moveAndResolve(state, playerId, 1, depth, ctx);
      return true;
    }
    if (ctx.resources.has(playerId, resources.shield, 1)) {
      ctx.resources.remove(playerId, resources.shield, 1);
      return true;
    }
    return ctx.status.consume(playerId, statuses.protectNextMalus);
  }
  function previousMalus(
    state: State,
    playerId: number,
    depth: number,
    ctx: Context,
  ) {
    let target = ctx.movement.position(program.trackId, playerId) - 1;
    while (target > 0 && program.tiles[target].type !== 'malus') target -= 1;
    ctx.movement.moveTo(program.trackId, playerId, Math.max(0, target));
    if (target > 0) drawCard(state, playerId, 'malus', depth, ctx);
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
  function requirePending<TKind extends Pending['kind']>(
    ctx: Context,
    kind: TKind,
    actorId: number,
  ): Extract<Pending, { kind: TKind }> {
    const pending = ctx.choice.consumeContinuation<Pending>();
    if (!pending || pending.kind !== kind || pending.actorId !== actorId)
      rejectRule('Choix Contes ' + kind + ' absent');
    return pending as Extract<Pending, { kind: TKind }>;
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
