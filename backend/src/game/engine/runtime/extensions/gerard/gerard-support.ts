import type { GerardNameCard, GerardProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { completeRound } from '../../recipes/gameplay/track-round.recipes';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';

export type GerardState = Record<string, never>;
export type GerardContext = GameContext<GerardState>;
export type GerardPhase =
  'waiting-theme' | 'collecting-names' | 'choosing-winner';
export type GerardPhases = {
  is(ctx: GerardContext, phase: GerardPhase): boolean;
  transition(ctx: GerardContext, phase: GerardPhase): void;
};
export type SpecialInput = {
  cardId: string;
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
};

export const GERARD = {
  names: 'names',
  specials: 'specials',
  extraNames: 'gerard.extra-names',
  defense: 'gerard.defense',
  attackers: 'gerard.special-attackers',
  themeSecret: 'gerard.theme-secret',
  juryOverride: 'gerard.jury-override',
  ghostNames: 'gerard.ghost-names',
  submissions: 'gerard.names',
  judge: 'gerard.judge',
} as const;

export function gerardState(
  state: GerardState,
  key: 'currentThemeId' | 'secondThemeId' | 'lockedNameId',
) {
  const value = Reflect.get(state, key);
  return typeof value === 'string' ? value : null;
}
export function setGerardState(
  state: GerardState,
  key: 'currentThemeId' | 'secondThemeId' | 'lockedNameId',
  value: string | null,
) {
  Reflect.set(state, key, value);
}

export function createGerardSupport(
  program: GerardProgram,
  phases: GerardPhases,
) {
  const nameById = new Map(program.names.map((card) => [card.id, card]));
  const themeById = new Map(program.themes.map((card) => [card.id, card]));

  function masterId(ctx: GerardContext) {
    return ctx.judge.current(GERARD.judge);
  }
  function juryId(ctx: GerardContext) {
    return ctx.counters.get(GERARD.juryOverride) || masterId(ctx);
  }
  function pendingPlayers(ctx: GerardContext) {
    return ctx.submissions.pendingPlayers(GERARD.submissions);
  }
  function updateCollectionPhase(ctx: GerardContext) {
    const next = pendingPlayers(ctx).length
      ? 'collecting-names'
      : 'choosing-winner';
    phases.transition(ctx, next);
    if (next === 'choosing-winner')
      ctx.submissionFlow.reveal(GERARD.submissions);
    syncTurn(ctx);
  }
  function syncTurn(ctx: GerardContext) {
    const next = phases.is(ctx, 'collecting-names')
      ? pendingPlayers(ctx)[0]
      : phases.is(ctx, 'choosing-winner')
        ? juryId(ctx)
        : masterId(ctx);
    if (next != null) ctx.turn.to(next);
  }
  function discardSubmissions(ctx: GerardContext) {
    for (const cardId of Object.values(
      ctx.submissions.values<string[]>(GERARD.submissions),
    ).flat()) {
      const card = nameById.get(cardId);
      if (card) ctx.cards.discard('names', card);
    }
  }
  function closeRound(
    state: GerardState,
    winnerId: number,
    ctx: GerardContext,
  ) {
    completeRound(ctx, {
      winnerPlayerIds: [winnerId],
      reset: () => {
        discardSubmissions(ctx);
        for (const key of ['currentThemeId', 'secondThemeId'] as const) {
          const themeId = gerardState(state, key);
          const theme = themeId ? themeById.get(themeId) : null;
          if (theme) ctx.cards.discard('themes', theme);
        }
        for (const player of ctx.players.all()) {
          ctx.cards.drawManyToHand(
            'names',
            GERARD.names,
            player.id,
            Math.max(0, 10 - ctx.cards.hand(GERARD.names, player.id).length),
            { recycle: true },
          );
          ctx.cards.drawManyToHand(
            'specials',
            GERARD.specials,
            player.id,
            Math.max(0, 2 - ctx.cards.hand(GERARD.specials, player.id).length),
            { recycle: true },
          );
        }
        const nextMaster = ctx.submissionFlow.nextJudge(GERARD.judge);
        setGerardState(state, 'currentThemeId', null);
        setGerardState(state, 'secondThemeId', null);
        setGerardState(state, 'lockedNameId', null);
        ctx.submissionFlow.reset(GERARD.submissions);
        for (const player of ctx.players.all()) {
          ctx.resources.set(player.id, GERARD.extraNames, 0);
          ctx.status.remove(player.id, GERARD.defense);
        }
        clearSpecialAttackers(ctx);
        ctx.counters.set(GERARD.themeSecret, 0);
        ctx.counters.set(GERARD.juryOverride, 0);
        ctx.counters.set(GERARD.ghostNames, 0);
        phases.transition(ctx, 'waiting-theme');
        ctx.turn.to(nextMaster);
      },
      next: false,
    });
  }
  function takeRandomName(playerId: number, ctx: GerardContext) {
    const hand = ctx.cards.hand<GerardNameCard>(GERARD.names, playerId);
    const name = ctx.random.pick(hand);
    return name ? ctx.cards.take(GERARD.names, playerId, name) : null;
  }
  function discardRandomName(playerId: number, ctx: GerardContext) {
    ctx.cards.discardRandom<GerardNameCard>(GERARD.names, 'names', playerId);
  }
  function exchangeRandomNames(
    first: number,
    second: number,
    ctx: GerardContext,
  ) {
    ctx.cards.exchangeRandom<GerardNameCard>(GERARD.names, first, second);
  }
  function redrawNames(playerId: number, count: number, ctx: GerardContext) {
    for (let index = 0; index < count; index += 1)
      discardRandomName(playerId, ctx);
    ctx.cards.drawManyToHand(
      'names',
      GERARD.names,
      playerId,
      Math.max(0, 10 - ctx.cards.hand(GERARD.names, playerId).length),
      { recycle: true },
    );
  }
  function specialInputs(
    actorId: number,
    cardId: string,
    ctx: GerardContext,
  ): SpecialInput[] {
    const effect = program.specialCards.find(
      (card) => card.id === cardId,
    )?.effect;
    if (effect === 'interdiction')
      return ctx.cards
        .hand<GerardNameCard>(GERARD.names, actorId)
        .map((name) => ({ cardId, name: name.id }));
    const targeted = [
      'sabotage',
      'main-fantome',
      'echange-force',
      'chuchotement-confus',
      'jury-mystere',
      'prenom-volant',
      'ultra-sabotage',
    ].includes(effect ?? '');
    const targets = targeted
      ? ctx.players.otherIds(actorId).filter((playerId) => {
          if (effect !== 'main-fantome') return true;
          const session = ctx.submissions.session(GERARD.submissions);
          return (
            session != null &&
            !session.revealed &&
            session.participantPlayerIds.includes(playerId)
          );
        })
      : [];
    if (effect === 'ultra-sabotage')
      return targets.flatMap((targetPlayerId, index) =>
        targets.slice(index + 1).map((secondaryTargetId) => ({
          cardId,
          targetPlayerId,
          secondaryTargetId,
        })),
      );
    return targeted
      ? targets.map((targetPlayerId) => ({ cardId, targetPlayerId }))
      : [{ cardId }];
  }
  function validateTargets(
    actorId: number,
    input: SpecialInput,
    ctx: GerardContext,
  ) {
    for (const target of [input.targetPlayerId, input.secondaryTargetId])
      if (target != null && (target === actorId || !ctx.players.get(target)))
        rejectRule('Cible Gérard invalide');
  }
  function allowedNameCount(playerId: number, ctx: GerardContext) {
    return Math.min(3, 1 + ctx.resources.get(playerId, GERARD.extraNames));
  }
  function addSpecialAttacker(
    targetId: number,
    attackerId: number,
    ctx: GerardContext,
  ) {
    ctx.status.add(targetId, GERARD.attackers, {
      scope: 'round',
      data: { playerIds: [...specialAttackers(targetId, ctx), attackerId] },
    });
  }
  function takeSpecialAttacker(targetId: number, ctx: GerardContext) {
    const [attackerId, ...remaining] = specialAttackers(targetId, ctx);
    if (attackerId == null) return null;
    if (remaining.length === 0) ctx.status.remove(targetId, GERARD.attackers);
    else
      ctx.status.add(targetId, GERARD.attackers, {
        scope: 'round',
        data: { playerIds: remaining },
      });
    return attackerId;
  }
  function specialAttackers(playerId: number, ctx: GerardContext) {
    const value = ctx.status.get(playerId, GERARD.attackers)?.data.playerIds;
    return Array.isArray(value)
      ? value.filter(
          (candidate): candidate is number => typeof candidate === 'number',
        )
      : [];
  }
  function clearSpecialAttackers(ctx: GerardContext) {
    for (const player of ctx.players.all())
      ctx.status.remove(player.id, GERARD.attackers);
  }

  return {
    nameById,
    themeById,
    masterId,
    juryId,
    pendingPlayers,
    updateCollectionPhase,
    syncTurn,
    discardSubmissions,
    closeRound,
    takeRandomName,
    discardRandomName,
    exchangeRandomNames,
    redrawNames,
    specialInputs,
    validateTargets,
    allowedNameCount,
    addSpecialAttacker,
    takeSpecialAttacker,
    clearSpecialAttackers,
  };
}

export function sameSpecialInput(left: SpecialInput, right: SpecialInput) {
  return (
    left.cardId === right.cardId &&
    left.targetPlayerId === right.targetPlayerId &&
    left.secondaryTargetId === right.secondaryTargetId &&
    left.name === right.name
  );
}

export function combinations(values: string[], maximum: number) {
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
