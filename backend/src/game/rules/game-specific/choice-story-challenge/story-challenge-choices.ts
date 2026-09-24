import type { GameContext } from '../../../engine/sdk/public-api';
import type {
  StoryChallengeProgram,
  StoryChallengeCard,
  StoryChallengeOptionEffect,
} from './program';
import type { StoryChallengePendingResolution as Pending } from './story-challenge-resolution.types';
import { rejectRule } from '../../../engine/sdk/extension-api';
type Context = GameContext<Record<string, never>>;
export function createStoryChallengeChoices(program: StoryChallengeProgram) {
  function requestOption(
    actorId: number,
    effect: StoryChallengeOptionEffect,
    ctx: Context,
    targetId?: number,
  ) {
    const options = program.optionRules[effect].map((rule) => rule.id);
    const pending: Pending = {
      kind: 'option',
      actorId,
      effect,
      targetId,
    };
    ctx.choice.one({
      id: 'choice-story-challenge.option',
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
      id: 'choice-story-challenge.number',
      player: playerId,
      options: [...program.numberOptions],
      data: pending,
    });
  }
  function requestAbundance(actorId: number, ctx: Context) {
    const cards = Array.from({ length: program.choiceDrawCount }, () =>
      ctx.cards.drawOrRecycle<StoryChallengeCard>(program.deckRoles.reward),
    ).filter((card): card is StoryChallengeCard => card != null);
    for (const card of cards) ctx.cards.discard(program.deckRoles.reward, card);
    if (cards.length === 0) return;
    const pending: Pending = {
      kind: 'abundance',
      actorId,
      cardIds: cards.map((card) => card.id),
    };
    ctx.choice.one({
      id: 'choice-story-challenge.card',
      player: actorId,
      options: cards.map((card) => card.id),
      data: pending,
      label: (id) => cards.find((card) => card.id === id)?.title ?? String(id),
    });
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
      id: 'choice-story-challenge.token',
      player: actorId,
      options: tokens,
      data: pending,
    });
  }
  function listTokens(playerId: number, ctx: Context) {
    return program.tokens
      .filter((token) =>
        'resource' in token
          ? ctx.resources.has(playerId, token.resource, 1)
          : ctx.status.has(playerId, token.status),
      )
      .map((token) => token.id);
  }
  function transferToken(
    fromId: number,
    toId: number,
    token: string,
    ctx: Context,
  ) {
    const rule = program.tokens.find((entry) => entry.id === token);
    if (!rule) return rejectRule('Unknown transferable token');
    if ('resource' in rule)
      ctx.resources.transfer(fromId, toId, rule.resource, 1);
    else {
      ctx.status.remove(fromId, rule.status);
      ctx.status.add(toId, rule.status, { scope: 'until-used' });
    }
  }
  function requirePending<TKind extends Pending['kind']>(
    ctx: Context,
    kind: TKind,
    actorId: number,
  ): Extract<Pending, { kind: TKind }> {
    const pending = ctx.choice.consumeContinuation<Pending>();
    if (!pending || pending.kind !== kind || pending.actorId !== actorId)
      rejectRule('Choix StoryChallenge ' + kind + ' absent');
    return pending as Extract<Pending, { kind: TKind }>;
  }
  return {
    requestOption,
    requestLaughter,
    requestNumber,
    requestAbundance,
    requestToken,
    transferToken,
    requirePending,
  };
}
