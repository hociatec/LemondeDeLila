import type { ThemeNameCardsNameCard, ThemeNameCardsProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { completeRound } from '../../recipes/gameplay/track-round.recipes';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';

export type ThemeNameCardsState = Record<string, never>;
export type ThemeNameCardsContext = GameContext<ThemeNameCardsState>;
export type ThemeNameCardsPhase =
  'waiting-theme' | 'collecting-names' | 'choosing-winner';
export type ThemeNameCardsPhases = {
  is(ctx: ThemeNameCardsContext, phase: ThemeNameCardsPhase): boolean;
  transition(ctx: ThemeNameCardsContext, phase: ThemeNameCardsPhase): void;
};
export type SpecialInput = {
  cardId: string;
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
};

export const THEME_NAME = {
  names: 'names',
  specials: 'specials',
  extraNames: 'cards-theme-name.extra-names',
  defense: 'cards-theme-name.defense',
  attackers: 'cards-theme-name.special-attackers',
  themeSecret: 'cards-theme-name.theme-secret',
  juryOverride: 'cards-theme-name.jury-override',
  ghostNames: 'cards-theme-name.ghost-names',
  submissions: 'cards-theme-name.names',
  judge: 'cards-theme-name.judge',
} as const;

export function themeNameCardsState(
  state: ThemeNameCardsState,
  key: 'currentThemeId' | 'secondThemeId' | 'lockedNameId',
) {
  const value = Reflect.get(state, key);
  return typeof value === 'string' ? value : null;
}
export function setThemeNameCardsState(
  state: ThemeNameCardsState,
  key: 'currentThemeId' | 'secondThemeId' | 'lockedNameId',
  value: string | null,
) {
  Reflect.set(state, key, value);
}

export function createThemeNameCardsSupport(
  program: ThemeNameCardsProgram,
  phases: ThemeNameCardsPhases,
) {
  const nameById = new Map(program.names.map((card) => [card.id, card]));
  const themeById = new Map(program.themes.map((card) => [card.id, card]));

  function masterId(ctx: ThemeNameCardsContext) {
    return ctx.judge.current(THEME_NAME.judge);
  }
  function juryId(ctx: ThemeNameCardsContext) {
    return ctx.counters.get(THEME_NAME.juryOverride) || masterId(ctx);
  }
  function pendingPlayers(ctx: ThemeNameCardsContext) {
    return ctx.submissions.pendingPlayers(THEME_NAME.submissions);
  }
  function updateCollectionPhase(ctx: ThemeNameCardsContext) {
    const next = pendingPlayers(ctx).length
      ? 'collecting-names'
      : 'choosing-winner';
    phases.transition(ctx, next);
    if (next === 'choosing-winner')
      ctx.submissionFlow.reveal(THEME_NAME.submissions);
    syncTurn(ctx);
  }
  function syncTurn(ctx: ThemeNameCardsContext) {
    const next = phases.is(ctx, 'collecting-names')
      ? pendingPlayers(ctx)[0]
      : phases.is(ctx, 'choosing-winner')
        ? juryId(ctx)
        : masterId(ctx);
    if (next != null) ctx.turn.to(next);
  }
  function discardSubmissions(ctx: ThemeNameCardsContext) {
    for (const cardId of Object.values(
      ctx.submissions.values<string[]>(THEME_NAME.submissions),
    ).flat()) {
      const card = nameById.get(cardId);
      if (card) ctx.cards.discard('names', card);
    }
  }
  function closeRound(
    state: ThemeNameCardsState,
    winnerId: number,
    ctx: ThemeNameCardsContext,
  ) {
    completeRound(ctx, {
      winnerPlayerIds: [winnerId],
      reset: () => {
        discardSubmissions(ctx);
        for (const key of ['currentThemeId', 'secondThemeId'] as const) {
          const themeId = themeNameCardsState(state, key);
          const theme = themeId ? themeById.get(themeId) : null;
          if (theme) ctx.cards.discard('themes', theme);
        }
        for (const player of ctx.players.all()) {
          ctx.cards.drawManyToHand(
            'names',
            THEME_NAME.names,
            player.id,
            Math.max(
              0,
              10 - ctx.cards.hand(THEME_NAME.names, player.id).length,
            ),
            { recycle: true },
          );
          ctx.cards.drawManyToHand(
            'specials',
            THEME_NAME.specials,
            player.id,
            Math.max(
              0,
              2 - ctx.cards.hand(THEME_NAME.specials, player.id).length,
            ),
            { recycle: true },
          );
        }
        const nextMaster = ctx.submissionFlow.nextJudge(THEME_NAME.judge);
        setThemeNameCardsState(state, 'currentThemeId', null);
        setThemeNameCardsState(state, 'secondThemeId', null);
        setThemeNameCardsState(state, 'lockedNameId', null);
        ctx.submissionFlow.reset(THEME_NAME.submissions);
        for (const player of ctx.players.all()) {
          ctx.resources.set(player.id, THEME_NAME.extraNames, 0);
          ctx.status.remove(player.id, THEME_NAME.defense);
        }
        clearSpecialAttackers(ctx);
        ctx.counters.set(THEME_NAME.themeSecret, 0);
        ctx.counters.set(THEME_NAME.juryOverride, 0);
        ctx.counters.set(THEME_NAME.ghostNames, 0);
        phases.transition(ctx, 'waiting-theme');
        ctx.turn.to(nextMaster);
      },
      next: false,
    });
  }
  function takeRandomName(playerId: number, ctx: ThemeNameCardsContext) {
    const hand = ctx.cards.hand<ThemeNameCardsNameCard>(
      THEME_NAME.names,
      playerId,
    );
    const name = ctx.random.pick(hand);
    return name ? ctx.cards.take(THEME_NAME.names, playerId, name) : null;
  }
  function discardRandomName(playerId: number, ctx: ThemeNameCardsContext) {
    ctx.cards.discardRandom<ThemeNameCardsNameCard>(
      THEME_NAME.names,
      'names',
      playerId,
    );
  }
  function exchangeRandomNames(
    first: number,
    second: number,
    ctx: ThemeNameCardsContext,
  ) {
    ctx.cards.exchangeRandom<ThemeNameCardsNameCard>(
      THEME_NAME.names,
      first,
      second,
    );
  }
  function redrawNames(
    playerId: number,
    count: number,
    ctx: ThemeNameCardsContext,
  ) {
    for (let index = 0; index < count; index += 1)
      discardRandomName(playerId, ctx);
    ctx.cards.drawManyToHand(
      'names',
      THEME_NAME.names,
      playerId,
      Math.max(0, 10 - ctx.cards.hand(THEME_NAME.names, playerId).length),
      { recycle: true },
    );
  }
  function specialInputs(
    actorId: number,
    cardId: string,
    ctx: ThemeNameCardsContext,
  ): SpecialInput[] {
    const effect = program.specialCards.find(
      (card) => card.id === cardId,
    )?.effect;
    if (effect === 'interdiction')
      return ctx.cards
        .hand<ThemeNameCardsNameCard>(THEME_NAME.names, actorId)
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
          const session = ctx.submissions.session(THEME_NAME.submissions);
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
    ctx: ThemeNameCardsContext,
  ) {
    for (const target of [input.targetPlayerId, input.secondaryTargetId])
      if (target != null && (target === actorId || !ctx.players.get(target)))
        rejectRule('Cible Gérard invalide');
  }
  function allowedNameCount(playerId: number, ctx: ThemeNameCardsContext) {
    return Math.min(3, 1 + ctx.resources.get(playerId, THEME_NAME.extraNames));
  }
  function addSpecialAttacker(
    targetId: number,
    attackerId: number,
    ctx: ThemeNameCardsContext,
  ) {
    ctx.status.add(targetId, THEME_NAME.attackers, {
      scope: 'round',
      data: { playerIds: [...specialAttackers(targetId, ctx), attackerId] },
    });
  }
  function takeSpecialAttacker(targetId: number, ctx: ThemeNameCardsContext) {
    const [attackerId, ...remaining] = specialAttackers(targetId, ctx);
    if (attackerId == null) return null;
    if (remaining.length === 0)
      ctx.status.remove(targetId, THEME_NAME.attackers);
    else
      ctx.status.add(targetId, THEME_NAME.attackers, {
        scope: 'round',
        data: { playerIds: remaining },
      });
    return attackerId;
  }
  function specialAttackers(playerId: number, ctx: ThemeNameCardsContext) {
    const value = ctx.status.get(playerId, THEME_NAME.attackers)?.data
      .playerIds;
    return Array.isArray(value)
      ? value.filter(
          (candidate): candidate is number => typeof candidate === 'number',
        )
      : [];
  }
  function clearSpecialAttackers(ctx: ThemeNameCardsContext) {
    for (const player of ctx.players.all())
      ctx.status.remove(player.id, THEME_NAME.attackers);
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
