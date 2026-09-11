import { rejectRule } from '../../../engine/sdk/public-api';
import {
  GERARD_PRESIDENT_SPECIAL_CARDS,
  type GerardPresidentNameCard,
} from './content';
import {
  GERARD_DEFENSE,
  GERARD_EXTRA_NAMES,
  GERARD_JURY_OVERRIDE,
  GERARD_SPECIAL_ATTACKERS,
  NAME_HANDS,
  RuleContext,
  SpecialInput,
} from './game-constants';

export function takeRandomName(
  playerId: number,
  ctx: RuleContext,
): GerardPresidentNameCard | null {
  const hand = ctx.cards.hand<GerardPresidentNameCard>(NAME_HANDS, playerId);
  const name = ctx.random.pick(hand);
  return name ? ctx.cards.take(NAME_HANDS, playerId, name) : null;
}

export function discardRandomName(playerId: number, ctx: RuleContext): void {
  ctx.cards.discardRandom<GerardPresidentNameCard>(
    NAME_HANDS,
    'names',
    playerId,
  );
}

export function exchangeRandomNames(
  first: number,
  second: number,
  ctx: RuleContext,
): void {
  ctx.cards.exchangeRandom<GerardPresidentNameCard>(NAME_HANDS, first, second);
}

export function redrawNames(
  playerId: number,
  count: number,
  ctx: RuleContext,
): void {
  for (let index = 0; index < count; index += 1) {
    discardRandomName(playerId, ctx);
  }
  refillHand(NAME_HANDS, 'names', playerId, 10, ctx);
}

export function refillHand<TCard extends string | number | object>(
  handId: string,
  deckId: string,
  playerId: number,
  target: number,
  ctx: RuleContext,
): void {
  while (ctx.cards.hand<TCard>(handId, playerId).length < target) {
    const card = ctx.cards.drawOrRecycle<TCard>(deckId);
    if (!card) return;
    ctx.cards.give(handId, playerId, card);
  }
}

export function specialInputs(
  actorId: number,
  cardId: string,
  ctx: RuleContext,
): SpecialInput[] {
  const effect = GERARD_PRESIDENT_SPECIAL_CARDS.find(
    (card) => card.id === cardId,
  )?.effect;
  if (effect === 'interdiction') {
    return ctx.cards
      .hand<GerardPresidentNameCard>(NAME_HANDS, actorId)
      .map((name) => ({ cardId, name: name.id }));
  }
  const targeted = [
    'sabotage',
    'main-fantome',
    'echange-force',
    'chuchotement-confus',
    'jury-mystere',
    'prenom-volant',
    'ultra-sabotage',
  ].includes(effect ?? '');
  const targets = targeted ? ctx.players.otherIds(actorId) : [];
  if (effect === 'ultra-sabotage') {
    return targets.flatMap((targetPlayerId, index) =>
      targets.slice(index + 1).map((secondaryTargetId) => ({
        cardId,
        targetPlayerId,
        secondaryTargetId,
      })),
    );
  }
  return targeted
    ? targets.map((targetPlayerId) => ({ cardId, targetPlayerId }))
    : [{ cardId }];
}

export function validateTargets(
  actorId: number,
  input: SpecialInput,
  ctx: RuleContext,
): void {
  for (const target of [input.targetPlayerId, input.secondaryTargetId]) {
    if (target != null && (target === actorId || !ctx.players.get(target))) {
      rejectRule('Cible Gérard invalide');
    }
  }
}

export function sameSpecialInput(
  left: SpecialInput,
  right: SpecialInput,
): boolean {
  return (
    left.cardId === right.cardId &&
    left.targetPlayerId === right.targetPlayerId &&
    left.secondaryTargetId === right.secondaryTargetId &&
    left.name === right.name
  );
}

export function combinations(values: string[], maximum: number): string[][] {
  const result: string[][] = [];
  const visit = (start: number, selected: string[]) => {
    if (selected.length > 0) result.push([...selected]);
    if (selected.length === maximum) return;
    for (let index = start; index < values.length; index += 1) {
      selected.push(values[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return result;
}

export function consumeDefense(playerId: number, ctx: RuleContext): boolean {
  return ctx.status.consume(playerId, GERARD_DEFENSE);
}

export function gerardJuryOverride(ctx: RuleContext): number | null {
  return ctx.counters.get(GERARD_JURY_OVERRIDE) || null;
}

export function allowedNameCount(playerId: number, ctx: RuleContext): number {
  return Math.min(3, 1 + ctx.resources.get(playerId, GERARD_EXTRA_NAMES));
}

export function addSpecialAttacker(
  targetId: number,
  attackerId: number,
  ctx: RuleContext,
): void {
  ctx.status.add(targetId, GERARD_SPECIAL_ATTACKERS, {
    scope: 'round',
    data: { playerIds: [...specialAttackers(targetId, ctx), attackerId] },
  });
}

export function takeSpecialAttacker(
  targetId: number,
  ctx: RuleContext,
): number | null {
  const [attackerId, ...remaining] = specialAttackers(targetId, ctx);
  if (attackerId == null) return null;
  if (remaining.length === 0) {
    ctx.status.remove(targetId, GERARD_SPECIAL_ATTACKERS);
  } else {
    ctx.status.add(targetId, GERARD_SPECIAL_ATTACKERS, {
      scope: 'round',
      data: { playerIds: remaining },
    });
  }
  return attackerId;
}

function specialAttackers(playerId: number, ctx: RuleContext): number[] {
  const value = ctx.status.get(playerId, GERARD_SPECIAL_ATTACKERS)?.data
    .playerIds;
  return Array.isArray(value)
    ? value.filter(
        (candidate): candidate is number => typeof candidate === 'number',
      )
    : [];
}

export function clearSpecialAttackers(ctx: RuleContext): void {
  for (const player of ctx.players.all()) {
    ctx.status.remove(player.id, GERARD_SPECIAL_ATTACKERS);
  }
}
