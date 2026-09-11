import { completeRound } from '../../../engine/sdk/public-api';
import {
  GERARD_PRESIDENT_NAME_BY_ID,
  GERARD_PRESIDENT_THEME_BY_ID,
} from './content';
import type { GerardState } from './state';
import {
  NAME_HANDS,
  SPECIAL_HANDS,
  GERARD_EXTRA_NAMES,
  GERARD_DEFENSE,
  GERARD_THEME_SECRET,
  GERARD_JURY_OVERRIDE,
  GERARD_GHOST_NAMES,
  GERARD_SUBMISSIONS,
  GERARD_JUDGE,
  RuleContext,
  GERARD_PHASES,
} from './game-constants';
import {
  refillHand,
  gerardJuryOverride,
  clearSpecialAttackers,
} from './special-card-rules';

export function updateCollectionPhase(ctx: RuleContext): void {
  const nextPhase = pendingPlayers(ctx).length
    ? 'collecting-names'
    : 'choosing-winner';
  GERARD_PHASES.transition(ctx, nextPhase);
  if (nextPhase === 'choosing-winner') {
    ctx.submissionFlow.reveal(GERARD_SUBMISSIONS);
  }
  syncTurn(ctx);
}

export function syncTurn(ctx: RuleContext): void {
  const next = GERARD_PHASES.is(ctx, 'collecting-names')
    ? pendingPlayers(ctx)[0]
    : GERARD_PHASES.is(ctx, 'choosing-winner')
      ? juryId(ctx)
      : gerardMasterId(ctx);
  if (next != null) ctx.turn.to(next);
}

export function closeRound(
  state: GerardState,
  winnerId: number,
  ctx: RuleContext,
): void {
  completeRound(ctx, {
    winnerPlayerIds: [winnerId],
    reset: () => {
      discardSubmissions(ctx);
      if (state.currentThemeId) {
        const theme = GERARD_PRESIDENT_THEME_BY_ID[state.currentThemeId];
        if (theme) ctx.cards.discard('themes', theme);
      }
      if (state.secondThemeId) {
        const theme = GERARD_PRESIDENT_THEME_BY_ID[state.secondThemeId];
        if (theme) ctx.cards.discard('themes', theme);
      }
      for (const player of ctx.players.all()) {
        refillHand(NAME_HANDS, 'names', player.id, 10, ctx);
        refillHand(SPECIAL_HANDS, 'specials', player.id, 2, ctx);
      }
      const masterId = ctx.submissionFlow.nextJudge(GERARD_JUDGE);
      state.currentThemeId = null;
      state.secondThemeId = null;
      state.lockedNameId = null;
      ctx.submissionFlow.reset(GERARD_SUBMISSIONS);
      for (const player of ctx.players.all()) {
        ctx.resources.set(player.id, GERARD_EXTRA_NAMES, 0);
        ctx.status.remove(player.id, GERARD_DEFENSE);
      }
      clearSpecialAttackers(ctx);
      ctx.counters.set(GERARD_THEME_SECRET, 0);
      ctx.counters.set(GERARD_JURY_OVERRIDE, 0);
      ctx.counters.set(GERARD_GHOST_NAMES, 0);
      GERARD_PHASES.transition(ctx, 'waiting-theme');
      ctx.turn.to(masterId);
    },
    next: false,
  });
}

export function discardSubmissions(ctx: RuleContext): void {
  for (const cardId of Object.values(
    ctx.submissions.values<string[]>(GERARD_SUBMISSIONS),
  ).flat()) {
    const card = GERARD_PRESIDENT_NAME_BY_ID[cardId];
    if (card) ctx.cards.discard('names', card);
  }
}

export function juryId(ctx: RuleContext): number {
  return gerardJuryOverride(ctx) ?? gerardMasterId(ctx);
}

export function gerardMasterId(ctx: RuleContext): number {
  return ctx.judge.current(GERARD_JUDGE);
}

export function pendingPlayers(ctx: RuleContext): number[] {
  return ctx.submissions.pendingPlayers(GERARD_SUBMISSIONS);
}
