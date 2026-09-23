import { gameEffects } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type {
  PawScoringProgram,
  PawScoringCard,
  PawScoringObstacle,
  PawScoringParade,
  PawScoringPower,
} from './program';

type Context = GameContext<Record<string, never>>;
type CardInput = { cardId: string; targetPlayerId?: number };
export function createPawScoringCardRules(program: PawScoringProgram) {
  const mechanics = program.mechanics;
  const obstacles = new Map(mechanics.obstacles.map((rule) => [rule.id, rule]));
  const powerRules = new Map(mechanics.powers.map((rule) => [rule.id, rule]));
  const ignores = (active: readonly string[], obstacle: string) =>
    active.some((id) => powerRules.get(id)?.ignores.includes(obstacle));
  const bypassesActivation = (playerId: number, ctx: Context) =>
    powers(playerId, ctx).some((id) => powerRules.get(id)?.bypassesActivation);
  const cardById = new Map(program.cards.map((card) => [card.id, card]));
  const status = Object.fromEntries(
    Object.entries(mechanics.statuses).map(([key, suffix]) => [
      key,
      program.statusPrefix + suffix,
    ]),
  ) as Record<keyof typeof mechanics.statuses, string>;
  function playable(actorId: number, ctx: Context): CardInput[] {
    if (ctx.effects.sourcePlayerId() !== actorId) return [];
    const blocked = isBlocked(actorId, ctx);
    return ctx.cards.hand<string>(program.handId, actorId).flatMap((cardId) => {
      const card = cardById.get(cardId);
      if (!card || (blocked && card.type !== 'parade' && card.type !== 'bot'))
        return [];
      if (card.type === 'pattes')
        return canPlayPattes(actorId, card.value, ctx) ? [{ cardId }] : [];
      if (card.type === 'obstacle')
        return ctx.players
          .all()
          .filter(
            (player) =>
              player.id !== actorId &&
              canReceiveObstacle(player.id, card.obstacle, ctx),
          )
          .map((player) => ({ cardId, targetPlayerId: player.id }));
      if (card.type === 'parade')
        return canPlayParade(actorId, card.parade, ctx) ? [{ cardId }] : [];
      return canPlayPower(actorId, card.bot, ctx) ? [{ cardId }] : [];
    });
  }
  function effectsForPlay(card: PawScoringCard, targetId: number | null) {
    if (card.type !== 'obstacle' || targetId == null) return card.effects;
    return card.effects.map((effect) =>
      effect.kind === 'add-status'
        ? { ...effect, target: gameEffects.target.player(targetId) }
        : effect,
    );
  }
  function canPlayPattes(playerId: number, value: number, ctx: Context) {
    const obstacle = currentObstacle(playerId, ctx);
    const maximum =
      obstacle == null || ignores(powers(playerId, ctx), obstacle)
        ? undefined
        : obstacles.get(obstacle)?.maximumMove;
    return (
      (ctx.status.has(playerId, status.activated) ||
        bypassesActivation(playerId, ctx)) &&
      !isBlocked(playerId, ctx) &&
      (maximum == null || value <= maximum) &&
      mechanics.moveLimits.every(
        (limit) =>
          value !== limit.value ||
          ctx.resources.get(playerId, program.statusPrefix + limit.resource) <
            limit.uses,
      ) &&
      value > 0 &&
      ctx.movement.position(program.trackId, playerId) + value <= program.goal
    );
  }
  function canReceiveObstacle(
    playerId: number,
    obstacle: PawScoringObstacle,
    ctx: Context,
  ) {
    if (ignores(powers(playerId, ctx), obstacle)) return false;
    if (
      ctx.status.has(playerId, status.obstacleLock) &&
      !bypassesActivation(playerId, ctx)
    )
      return false;
    return currentObstacle(playerId, ctx) == null;
  }
  function canPlayParade(
    playerId: number,
    parade: PawScoringParade,
    ctx: Context,
  ) {
    if (
      powers(playerId, ctx).some((power) =>
        powerRules.get(power)?.disablesCounters.includes(parade),
      )
    )
      return false;
    const obstacle = currentObstacle(playerId, ctx);
    return obstacle
      ? obstacles.get(obstacle)?.counter === parade
      : parade === mechanics.activationCounter &&
          !ctx.status.has(playerId, status.activationUsed);
  }
  function canPlayPower(
    playerId: number,
    power: PawScoringPower,
    ctx: Context,
  ) {
    const obstacle = currentObstacle(playerId, ctx);
    return obstacle == null || ignores([power], obstacle);
  }
  function applyParade(
    playerId: number,
    parade: PawScoringParade,
    ctx: Context,
  ) {
    const obstacle = currentObstacle(playerId, ctx);
    const removes =
      obstacle != null && obstacles.get(obstacle)?.counter === parade;
    if (removes) ctx.status.remove(playerId, status.obstacle);
    if (parade === mechanics.activationCounter) {
      addRoundStatus(playerId, status.activated, ctx);
      addRoundStatus(playerId, status.activationUsed, ctx);
      ctx.status.remove(playerId, status.obstacleLock);
    } else if (removes) {
      ctx.status.remove(playerId, status.activated);
      ctx.status.remove(playerId, status.activationUsed);
      addRoundStatus(playerId, status.obstacleLock, ctx);
    }
  }
  function applyPower(playerId: number, power: PawScoringPower, ctx: Context) {
    addRoundStatus(playerId, status.power + power, ctx);
    const obstacle = currentObstacle(playerId, ctx);
    if (obstacle && ignores([power], obstacle)) {
      ctx.status.remove(playerId, status.obstacle);
      ctx.status.remove(playerId, status.activationUsed);
      if (!powerRules.get(power)?.bypassesActivation) {
        ctx.status.remove(playerId, status.activated);
        addRoundStatus(playerId, status.obstacleLock, ctx);
      } else ctx.status.remove(playerId, status.obstacleLock);
    }
  }
  function mustCounter(playerId: number, ctx: Context) {
    return isBlocked(playerId, ctx) && playable(playerId, ctx).length > 0;
  }
  function isBlocked(playerId: number, ctx: Context) {
    const obstacle = currentObstacle(playerId, ctx);
    return (
      obstacle != null &&
      obstacles.get(obstacle)?.blocks === true &&
      !ignores(powers(playerId, ctx), obstacle)
    );
  }

  function powers(playerId: number, ctx: Context): PawScoringPower[] {
    return ctx.status
      .list(playerId)
      .filter((entry) => entry.id.startsWith(status.power))
      .map((entry) => entry.id.slice(status.power.length))
      .filter((power): power is PawScoringPower => powerRules.has(power));
  }
  function currentObstacle(
    playerId: number,
    ctx: Context,
  ): PawScoringObstacle | null {
    const value = ctx.status.get(playerId, status.obstacle)?.data.obstacle;
    return typeof value === 'string' && obstacles.has(value) ? value : null;
  }
  function addRoundStatus(playerId: number, statusId: string, ctx: Context) {
    ctx.status.add(playerId, statusId, { scope: 'round' });
  }
  return {
    status,
    cardById,
    playable,
    effectsForPlay,
    mustCounter,
    applyParade,
    applyPower,
  };
}
