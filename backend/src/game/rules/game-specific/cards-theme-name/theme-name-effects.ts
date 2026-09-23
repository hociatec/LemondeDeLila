import { gameInput, defineEffect } from '../../../engine/sdk/public-api';
import type { DefinedGameEffectResolver } from '../../../engine/sdk/public-api';
import type {
  ThemeNameCardsSpecialEffect,
  ThemeNameCardsThemeCard,
} from './program';
import {
  THEME_NAME,
  type ThemeNameCardsContext,
  type ThemeNameCardsState,
  type createThemeNameCardsSupport,
  setThemeNameCardsState,
} from './theme-name-support';

type SpecialData = {
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
};
type Support = ReturnType<typeof createThemeNameCardsSupport>;
type Execution = {
  state: ThemeNameCardsState;
  actorId: number;
  targetId: number | null;
  secondaryTargetId: number | null;
  name: string | null;
  ctx: ThemeNameCardsContext;
};

export function createThemeNameCardsEffects(support: Support) {
  function special(
    effect: ThemeNameCardsSpecialEffect,
    apply: (input: Execution) => void,
  ): DefinedGameEffectResolver<ThemeNameCardsState, SpecialData> {
    return defineEffect<ThemeNameCardsState, SpecialData>({
      input: gameInput.object({
        targetPlayerId: gameInput.optional(gameInput.playerId()),
        secondaryTargetId: gameInput.optional(gameInput.playerId()),
        name: gameInput.optional(gameInput.string({ min: 1, max: 80 })),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId == null) return;
        const targetId = data.targetPlayerId ?? null;
        const defended =
          targetId != null && ctx.status.consume(targetId, THEME_NAME.defense);
        if (targetId != null)
          support.addSpecialAttacker(targetId, actorPlayerId, ctx);
        if (defended && isAttack(effect)) return;
        apply({
          state,
          actorId: actorPlayerId,
          targetId,
          secondaryTargetId: data.secondaryTargetId ?? null,
          name: data.name ?? null,
          ctx,
        });
      },
    });
  }
  const operations = {
    'add-one-submission': special('add-one-submission', ({ actorId, ctx }) => {
      ctx.resources.set(actorId, THEME_NAME.extraNames, 1);
    }),
    'add-two-submissions': special(
      'add-two-submissions',
      ({ actorId, ctx }) => {
        ctx.resources.set(actorId, THEME_NAME.extraNames, 2);
      },
    ),
    'draw-second-prompt': special('draw-second-prompt', ({ state, ctx }) => {
      setThemeNameCardsState(
        state,
        'secondThemeId',
        ctx.cards.drawOrRecycle<ThemeNameCardsThemeCard>('themes')?.id ?? null,
      );
    }),
    'lock-card': special('lock-card', ({ state, name }) => {
      setThemeNameCardsState(state, 'lockedNameId', name);
    }),
    protect: special('protect', ({ actorId, ctx }) => {
      ctx.status.add(actorId, THEME_NAME.defense, { scope: 'round' });
    }),
    'random-submit': special('random-submit', ({ targetId, ctx }) => {
      if (targetId == null) return;
      const name = support.takeRandomName(targetId, ctx);
      ctx.submissions.replace(
        THEME_NAME.submissions,
        targetId,
        name ? [name.id] : [],
      );
      support.updateCollectionPhase(ctx);
    }),
    'exchange-with-target': special(
      'exchange-with-target',
      ({ actorId, targetId, ctx }) => {
        if (targetId != null)
          support.exchangeRandomNames(actorId, targetId, ctx);
      },
    ),
    'redraw-all': special('redraw-all', ({ ctx }) => {
      for (const player of ctx.players.all())
        support.redrawNames(player.id, support.program.redrawCount, ctx);
    }),
    'discard-target': special('discard-target', ({ targetId, ctx }) => {
      if (targetId != null) support.discardRandomName(targetId, ctx);
    }),
    'discard-attacker': special('discard-attacker', ({ actorId, ctx }) => {
      const attacker = support.takeSpecialAttacker(actorId, ctx);
      if (attacker != null) support.discardRandomName(attacker, ctx);
    }),
    'hide-prompt': special('hide-prompt', ({ ctx }) => {
      ctx.counters.set(THEME_NAME.themeSecret, 1);
    }),
    'exchange-with-neighbor': special(
      'exchange-with-neighbor',
      ({ targetId, ctx }) => {
        if (targetId == null) return;
        const neighborId = ctx.players.after(targetId)?.id ?? null;
        if (neighborId != null)
          support.exchangeRandomNames(targetId, neighborId, ctx);
      },
    ),
    'reverse-pending': special('reverse-pending', ({ ctx }) => {
      ctx.submissions.reorderPending(
        THEME_NAME.submissions,
        support.pendingPlayers(ctx).reverse(),
      );
    }),
    'select-judge': special('select-judge', ({ actorId, targetId, ctx }) => {
      ctx.counters.set(
        THEME_NAME.juryOverride,
        targetId ?? ctx.random.pick(ctx.players.otherIds(actorId)) ?? 0,
      );
    }),
    'increment-pending-submissions': special(
      'increment-pending-submissions',
      ({ ctx }) => {
        for (const playerId of support.pendingPlayers(ctx))
          ctx.resources.add(playerId, THEME_NAME.extraNames, 1);
      },
    ),
    'add-neutral-submission': special('add-neutral-submission', ({ ctx }) => {
      ctx.counters.add(THEME_NAME.ghostNames, 1);
    }),
    'become-judge': special('become-judge', ({ actorId, ctx }) => {
      ctx.judge.setCurrent(THEME_NAME.judge, actorId);
    }),
    'reopen-submissions': special('reopen-submissions', ({ ctx }) => {
      support.discardSubmissions(ctx);
      ctx.submissionFlow.open({
        id: THEME_NAME.submissions,
        players: ctx.players.otherIds(support.masterId(ctx)),
        secret: true,
      });
      support.updateCollectionPhase(ctx);
    }),
    'discard-two-targets': special(
      'discard-two-targets',
      ({ targetId, secondaryTargetId, ctx }) => {
        if (targetId != null) support.discardRandomName(targetId, ctx);
        if (secondaryTargetId != null && secondaryTargetId !== targetId)
          support.discardRandomName(secondaryTargetId, ctx);
      },
    ),
    'steal-from-target': special(
      'steal-from-target',
      ({ actorId, targetId, ctx }) => {
        if (targetId == null) return;
        const name = support.takeRandomName(targetId, ctx);
        if (name) ctx.cards.give(THEME_NAME.names, actorId, name);
      },
    ),
  };
  return Object.fromEntries(
    support.program.specialRules.map((rule) => [
      rule.effectId,
      operations[rule.operation],
    ]),
  );
}
function isAttack(effect: ThemeNameCardsSpecialEffect) {
  return ['discard-target', 'discard-two-targets', 'random-submit'].includes(
    effect,
  );
}
