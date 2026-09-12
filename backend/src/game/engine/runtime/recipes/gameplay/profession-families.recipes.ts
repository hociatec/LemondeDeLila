import type {
  ProfessionFamiliesProgram,
  ProfessionFamilyCard,
} from '../../extensions/profession-families/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEffect } from '../../effects/effects-core';
import { gameInput } from '../../actions/game-input-schema';
import { drawEvent } from './card-dice.recipes';
import { requestCardFromPlayer } from './card-actions.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

export function professionFamiliesRules(source: ProfessionFamiliesProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const professions = program.cards.filter((card) => card.type === 'metier');
  const enumerate = (playerId: number, ctx: Context) => {
    const hand = ctx.cards.hand<string>(program.handId, playerId);
    const ownedFamilies = ctx.status.has(playerId, program.freeRequestStatus)
      ? new Set(program.familyIds)
      : new Set(
          hand
            .map((cardId) => cards.get(cardId)?.family)
            .filter((family): family is string => family != null),
        );
    return ctx.players
      .others(playerId)
      .flatMap((target) =>
        professions
          .filter((card) => card.family && ownedFamilies.has(card.family))
          .map((card) => ({ cardId: card.id, targetPlayerId: target.id })),
      );
  };
  const request = requestCardFromPlayer<State>({
    handId: program.handId,
    requests: ({ playerId, ctx }) => enumerate(playerId, ctx),
    beforeRequest: ({ playerId, ctx }) => {
      ctx.status.remove(playerId, program.freeRequestStatus);
    },
    onReceived: ({ playerId, cardId, ctx }) => {
      ctx.events.message('game.card.received', { playerId, cardId });
      completeFamily(program, cards, playerId, cardId, ctx);
      maybeFinish(program, ctx);
    },
    onMiss: ({ playerId, ctx }) => {
      const count = 1 + ctx.resources.get(playerId, program.extraDrawResource);
      ctx.resources.set(playerId, program.extraDrawResource, 0);
      for (let index = 0; index < count; index += 1)
        drawCard(program, cards, playerId, ctx);
      maybeFinish(program, ctx);
    },
  });
  return { request, enumerate, effects: effects(program, cards) };
}
function drawCard(
  program: ProfessionFamiliesProgram,
  cards: ReadonlyMap<string, ProfessionFamilyCard>,
  playerId: number,
  ctx: Context,
): void {
  const cardId = drawEvent<State, string>(ctx, {
    deckId: program.deckId,
    playerId,
    recycle: true,
  });
  if (!cardId) return;
  const card = cards.get(cardId);
  if (!card) return ctx.reject('UNKNOWN_PROFESSION_CARD', { cardId });
  if (card.type === 'special') {
    ctx.cards.discard(program.deckId, cardId);
    ctx.effects.schedule(...card.effects);
    return;
  }
  ctx.cards.give(program.handId, playerId, cardId);
  ctx.events.message('game.card.drawn', {
    playerId,
    cardId,
    deckId: program.deckId,
  });
  completeFamily(program, cards, playerId, cardId, ctx);
}

function completeFamily(
  program: ProfessionFamiliesProgram,
  cards: ReadonlyMap<string, ProfessionFamilyCard>,
  playerId: number,
  cardId: string,
  ctx: Context,
): void {
  const family = cards.get(cardId)?.family;
  if (!family || !ctx.cards.completeSet(program.setsId, playerId, family))
    return;
  ctx.events.message(`${program.eventNamespace}.family.completed`, {
    playerId,
    familyId: family,
  });
}

function effects(
  program: ProfessionFamiliesProgram,
  cards: ReadonlyMap<string, ProfessionFamilyCard>,
) {
  const empty = gameInput.object({});
  return {
    'les-mains.exchange-random': defineEffect<State, Record<string, never>>({
      input: empty,
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null) exchangeRandom(program, actorPlayerId, ctx);
      },
    }),
    'les-mains.complete-vanished': defineEffect<State, Record<string, never>>({
      input: empty,
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          completeVanished(program, cards, actorPlayerId, ctx);
      },
    }),
    'les-mains.mix-hands': defineEffect<State, Record<string, never>>({
      input: empty,
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null) mixHands(program, actorPlayerId, ctx);
      },
    }),
    'les-mains.pass-knowledge': defineEffect<State, Record<string, never>>({
      input: empty,
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          passKnowledge(program, cards, actorPlayerId, ctx);
      },
    }),
    'les-mains.log-special': defineEffect<State, { cardId: string }>({
      input: gameInput.object({ cardId: gameInput.cardId() }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          ctx.events.message(`${program.eventNamespace}.special.applied`, {
            playerId: actorPlayerId,
            cardId: data.cardId,
          });
      },
    }),
  };
}

function exchangeRandom(
  program: ProfessionFamiliesProgram,
  playerId: number,
  ctx: Context,
): void {
  const ownHand = ctx.cards.hand<string>(program.handId, playerId);
  const target = ctx.random.pick(
    ctx.players
      .all()
      .filter(
        (player) =>
          player.id !== playerId &&
          ctx.cards.hand(program.handId, player.id).length > 0,
      ),
  );
  if (!target || ownHand.length === 0) return;
  const stolen = ctx.cards.stealRandom<string>(
    program.handId,
    target.id,
    playerId,
  );
  if (stolen == null) return;
  const ownCard = ctx.random.pick(ownHand);
  if (ownCard) ctx.cards.transfer(program.handId, playerId, target.id, ownCard);
}

function completeVanished(
  program: ProfessionFamiliesProgram,
  cards: ReadonlyMap<string, ProfessionFamilyCard>,
  playerId: number,
  ctx: Context,
): void {
  if (ctx.status.has(playerId, program.vanishedStatus)) return;
  const hand = ctx.cards.hand<string>(program.handId, playerId);
  const completed = ctx.cards.playerCompletedSets(program.setsId, playerId);
  const selected = program.familyIds
    .filter((family) => !completed.includes(family))
    .map((family) => ({
      family,
      cards: hand.filter((cardId) => cards.get(cardId)?.family === family),
    }))
    .sort(
      (left, right) =>
        right.cards.length - left.cards.length ||
        program.familyIds.indexOf(left.family) -
          program.familyIds.indexOf(right.family),
    )[0];
  if (!selected || selected.cards.length === 0) return;
  ctx.cards.completeSet(program.setsId, playerId, selected.family, {
    allowIncomplete: true,
  });
  ctx.status.add(playerId, program.vanishedStatus, { scope: 'match' });
}

function mixHands(
  program: ProfessionFamiliesProgram,
  playerId: number,
  ctx: Context,
): void {
  const target = ctx.random.pick(
    ctx.players
      .all()
      .filter(
        (player) =>
          player.id !== playerId &&
          ctx.cards.hand(program.handId, player.id).length > 0,
      ),
  );
  if (target) ctx.cards.shuffleHands(program.handId, [playerId, target.id]);
}

function passKnowledge(
  program: ProfessionFamiliesProgram,
  cards: ReadonlyMap<string, ProfessionFamilyCard>,
  playerId: number,
  ctx: Context,
): void {
  const ownFamilies = new Set(
    ctx.cards
      .hand<string>(program.handId, playerId)
      .map((cardId) => cards.get(cardId)?.family),
  );
  const candidates = ctx.players.others(playerId).flatMap((player) =>
    ctx.cards
      .hand<string>(program.handId, player.id)
      .filter((cardId) => ownFamilies.has(cards.get(cardId)?.family))
      .map((cardId) => ({ playerId: player.id, cardId })),
  );
  const selected = ctx.random.pick(candidates);
  if (!selected) return;
  ctx.cards.transfer(
    program.handId,
    selected.playerId,
    playerId,
    selected.cardId,
  );
  completeFamily(program, cards, playerId, selected.cardId, ctx);
}

function maybeFinish(program: ProfessionFamiliesProgram, ctx: Context): void {
  const counts = ctx.cards.completedSetCounts(program.setsId);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const empty =
    ctx.cards.deckCount(program.deckId) === 0 &&
    ctx.cards.discardCount(program.deckId) === 0;
  const handless = ctx.players
    .all()
    .some((player) => ctx.cards.hand(program.handId, player.id).length === 0);
  if (total < program.familyIds.length && !(empty && handless)) return;
  const winners = ctx.ranking.leaders(
    ctx.players.all().map((player) => player.id),
    { value: (playerId) => counts[playerId] ?? 0 },
  );
  ctx.match.finish({ winners, reason: program.finishReason });
}
