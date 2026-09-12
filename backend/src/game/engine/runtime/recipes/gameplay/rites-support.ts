import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type {
  RiteFamilyCard,
  RitesProgram,
} from '../../extensions/rites/program';
import type { GameContext } from '../../definitions/game-author-context';
import { gameEffects } from '../../effects/effects-dsl';
import { drawEvent } from './card-dice.recipes';

export type RitesState = Record<string, never>;
export type RitesContext = GameContext<RitesState>;
export type RitesPending =
  | { kind: 'draw-one'; playerId: number; cardIds: string[] }
  | { kind: 'resurrection'; playerId: number }
  | { kind: 'free-family'; playerId: number }
  | { kind: 'reveal-and-steal'; playerId: number };
export type RitesSteal = { targetPlayerId: number; cardId: string };

export const RITES = {
  deck: 'rites',
  hands: 'players',
  families: 'rite-families',
  specials: 'rites-specials-played',
  peace: 'rites.peace',
  silence: 'rites.silence',
} as const;

export function createRitesSupport(source: RitesProgram) {
  const program = structuredClone(source);
  const byId = new Map(program.cards.map((card) => [card.id, card]));
  const familyCards = program.cards.filter(
    (card): card is RiteFamilyCard => card.type === 'family',
  );
  const familyIds = [...new Set(familyCards.map((card) => card.familyId))];

  function enumerate(playerId: number, ctx: RitesContext) {
    const represented = new Set(
      ctx.cards
        .hand<string>(RITES.hands, playerId)
        .map((cardId) => byId.get(cardId))
        .filter((card): card is RiteFamilyCard => card?.type === 'family')
        .map((card) => card.familyId),
    );
    return ctx.players.others(playerId).flatMap((target) =>
      familyCards
        .filter((card) => represented.has(card.familyId))
        .map((card) => ({
          cardId: card.id,
          targetPlayerId: target.id,
        })),
    );
  }

  function transfer(
    fromId: number,
    toId: number,
    cardId: string,
    ctx: RitesContext,
  ) {
    ctx.cards.transfer(RITES.hands, fromId, toId, cardId);
  }

  function completeFamilies(playerId: number, ctx: RitesContext) {
    for (const familyId of familyIds)
      ctx.cards.completeSet(RITES.families, playerId, familyId, {
        discard: false,
      });
  }

  function determineVictory(ctx: RitesContext) {
    const completed = ctx.cards.completedSetCounts(RITES.families);
    const total = Object.values(completed).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (total < familyIds.length) return;
    const ranked = ctx.ranking.rank(
      ctx.players.all().map((player) => player.id),
      { value: (id) => completed[id] ?? 0, direction: 'desc' },
      {
        value: (id) => ctx.inventory.count(RITES.specials, id),
        direction: 'desc',
      },
    );
    const winnerId = ranked[0]?.playerId;
    if (winnerId != null)
      ctx.match.finish({ winners: [winnerId], reason: 'five-families' });
  }

  function statusOwner(statusId: string, ctx: RitesContext) {
    return (
      ctx.players.all().find((player) => ctx.status.has(player.id, statusId))
        ?.id ?? null
    );
  }

  function retarget(effect: GameEffectInstruction, playerId: number) {
    if (effect.kind === 'swap-hands')
      return {
        ...effect,
        left:
          effect.left.kind === 'self'
            ? gameEffects.target.player(playerId)
            : effect.left,
        right:
          effect.right.kind === 'chosen-opponent'
            ? { ...effect.right, chooserPlayerId: playerId }
            : effect.right,
      };
    if (
      effect.kind === 'custom' ||
      effect.kind === 'add-status' ||
      effect.kind === 'remove-status' ||
      effect.kind === 'gain-resource' ||
      effect.kind === 'lose-resource' ||
      effect.kind === 'skip-turn'
    )
      return effect.target?.kind === 'self'
        ? { ...effect, target: gameEffects.target.player(playerId) }
        : effect;
    return effect;
  }

  function handleDrawn(playerId: number, cardId: string, ctx: RitesContext) {
    const card = byId.get(cardId);
    if (!card) return;
    if (card.type === 'family') {
      ctx.cards.give(RITES.hands, playerId, cardId);
      completeFamilies(playerId, ctx);
      return;
    }
    ctx.cards.discard(RITES.deck, cardId);
    ctx.inventory.add(RITES.specials, playerId, cardId);
    const silenceOwnerId = statusOwner(RITES.silence, ctx);
    if (silenceOwnerId != null && silenceOwnerId !== playerId) return;
    ctx.effects.schedule(
      ...card.effects.map((effect) => retarget(effect, playerId)),
    );
  }

  function draw(playerId: number, ctx: RitesContext) {
    const cardId = drawEvent<RitesState, string>(ctx, {
      deckId: RITES.deck,
      playerId,
      recycle: true,
    });
    if (cardId) handleDrawn(playerId, cardId, ctx);
  }

  function cardName(cardId: string) {
    return byId.get(cardId)?.name ?? cardId;
  }

  function finishChoice(ctx: RitesContext) {
    determineVictory(ctx);
    if (ctx.match.lifecycle() !== 'finished' && ctx.choice.current() == null)
      ctx.turn.complete();
  }

  function drawTwo(playerId: number, ctx: RitesContext) {
    const cardIds = [
      ctx.cards.drawOrRecycle<string>(RITES.deck),
      ctx.cards.drawOrRecycle<string>(RITES.deck),
    ].filter((cardId): cardId is string => cardId != null);
    if (cardIds.length === 0) return;
    if (cardIds.length === 1) {
      handleDrawn(playerId, cardIds[0], ctx);
      return;
    }
    ctx.choice.one({
      id: 'rites.card',
      player: playerId,
      options: cardIds,
      data: {
        kind: 'draw-one',
        playerId,
        cardIds,
      } satisfies RitesPending,
      label: cardName,
    });
  }

  function resurrection(playerId: number, ctx: RitesContext) {
    const options = ctx.cards
      .discardPile<string>(RITES.deck)
      .filter((cardId) => byId.get(cardId)?.type === 'family');
    if (options.length === 0) return;
    ctx.choice.one({
      id: 'rites.card',
      player: playerId,
      options,
      data: { kind: 'resurrection', playerId } satisfies RitesPending,
      label: cardName,
    });
  }

  function freeFamily(playerId: number, ctx: RitesContext) {
    const hand = ctx.cards.hand<string>(RITES.hands, playerId);
    const choices: string[][] = [];
    for (let left = 0; left < hand.length; left += 1)
      for (let middle = left + 1; middle < hand.length; middle += 1)
        for (let right = middle + 1; right < hand.length; right += 1) {
          const cardIds = [hand[left], hand[middle], hand[right]];
          const families = new Set(
            cardIds.map((id) => {
              const card = byId.get(id);
              return card?.type === 'family' ? card.familyId : null;
            }),
          );
          if (families.size === 3 && !families.has(null)) choices.push(cardIds);
        }
    if (choices.length === 0) return;
    ctx.choice.one({
      id: 'rites.family',
      player: playerId,
      options: choices,
      data: { kind: 'free-family', playerId } satisfies RitesPending,
      label: (ids) => ids.map(cardName).join(', '),
    });
  }

  function steal(playerId: number, ctx: RitesContext) {
    const options = ctx.players.others(playerId).flatMap((player) =>
      ctx.cards.hand<string>(RITES.hands, player.id).map((cardId) => ({
        targetPlayerId: player.id,
        cardId,
      })),
    );
    if (options.length === 0) return;
    ctx.choice.one({
      id: 'rites.steal',
      player: playerId,
      options,
      data: { kind: 'reveal-and-steal', playerId } satisfies RitesPending,
      label: (choice) => cardName(choice.cardId),
    });
  }

  return {
    program,
    byId,
    familyCards,
    familyIds,
    enumerate,
    transfer,
    completeFamilies,
    determineVictory,
    handleDrawn,
    draw,
    drawTwo,
    resurrection,
    freeFamily,
    steal,
    finishChoice,
    peaceTurns(ctx: RitesContext) {
      return ctx.players
        .all()
        .reduce(
          (remaining, player) =>
            Math.max(
              remaining,
              ctx.status.get(player.id, RITES.peace)?.remaining ?? 0,
            ),
          0,
        );
    },
  };
}
