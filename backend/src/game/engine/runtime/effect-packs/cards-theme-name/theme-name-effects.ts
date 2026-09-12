import { gameInput } from '../../actions/game-input-schema';
import type {
  ThemeNameCardsSpecialEffect,
  ThemeNameCardsThemeCard,
} from './program';
import type { DefinedGameEffectResolver } from '../../contracts/effect-resolver';
import { defineEffect } from '../../effects/effects-core';
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
  return {
    'cards-theme-name.double-prenom': special(
      'double-prenom',
      ({ actorId, ctx }) => {
        ctx.resources.set(actorId, THEME_NAME.extraNames, 1);
      },
    ),
    'cards-theme-name.mega-combo': special('mega-combo', ({ actorId, ctx }) => {
      ctx.resources.set(actorId, THEME_NAME.extraNames, 2);
    }),
    'cards-theme-name.double-theme': special(
      'double-theme',
      ({ state, ctx }) => {
        setThemeNameCardsState(
          state,
          'secondThemeId',
          ctx.cards.drawOrRecycle<ThemeNameCardsThemeCard>('themes')?.id ??
            null,
        );
      },
    ),
    'cards-theme-name.interdiction': special(
      'interdiction',
      ({ state, name }) => {
        setThemeNameCardsState(state, 'lockedNameId', name);
      },
    ),
    'cards-theme-name.defense-totale': special(
      'defense-totale',
      ({ actorId, ctx }) => {
        ctx.status.add(actorId, THEME_NAME.defense, { scope: 'round' });
      },
    ),
    'cards-theme-name.main-fantome': special(
      'main-fantome',
      ({ targetId, ctx }) => {
        if (targetId == null) return;
        const name = support.takeRandomName(targetId, ctx);
        ctx.submissions.replace(
          THEME_NAME.submissions,
          targetId,
          name ? [name.id] : [],
        );
        support.updateCollectionPhase(ctx);
      },
    ),
    'cards-theme-name.echange-force': special(
      'echange-force',
      ({ actorId, targetId, ctx }) => {
        if (targetId != null)
          support.exchangeRandomNames(actorId, targetId, ctx);
      },
    ),
    'cards-theme-name.panique-generale': special(
      'panique-generale',
      ({ ctx }) => {
        for (const player of ctx.players.all())
          support.redrawNames(player.id, 3, ctx);
      },
    ),
    'cards-theme-name.sabotage': special('sabotage', ({ targetId, ctx }) => {
      if (targetId != null) support.discardRandomName(targetId, ctx);
    }),
    'cards-theme-name.retour-envoyeur': special(
      'retour-envoyeur',
      ({ actorId, ctx }) => {
        const attacker = support.takeSpecialAttacker(actorId, ctx);
        if (attacker != null) support.discardRandomName(attacker, ctx);
      },
    ),
    'cards-theme-name.theme-secret': special('theme-secret', ({ ctx }) => {
      ctx.counters.set(THEME_NAME.themeSecret, 1);
    }),
    'cards-theme-name.chuchotement-confus': special(
      'chuchotement-confus',
      ({ targetId, ctx }) => {
        if (targetId == null) return;
        const neighborId = ctx.players.after(targetId)?.id ?? null;
        if (neighborId != null)
          support.exchangeRandomNames(targetId, neighborId, ctx);
      },
    ),
    'cards-theme-name.inversion': special('inversion', ({ ctx }) => {
      ctx.submissions.reorderPending(
        THEME_NAME.submissions,
        support.pendingPlayers(ctx).reverse(),
      );
    }),
    'cards-theme-name.jury-mystere': special(
      'jury-mystere',
      ({ actorId, targetId, ctx }) => {
        ctx.counters.set(
          THEME_NAME.juryOverride,
          targetId ?? ctx.random.pick(ctx.players.otherIds(actorId)) ?? 0,
        );
      },
    ),
    'cards-theme-name.effet-domino': special('effet-domino', ({ ctx }) => {
      for (const playerId of support.pendingPlayers(ctx))
        ctx.resources.add(playerId, THEME_NAME.extraNames, 1);
    }),
    'cards-theme-name.prenom-fantome': special('prenom-fantome', ({ ctx }) => {
      ctx.counters.add(THEME_NAME.ghostNames, 1);
    }),
    'cards-theme-name.inversion-role': special(
      'inversion-role',
      ({ actorId, ctx }) => {
        ctx.judge.setCurrent(THEME_NAME.judge, actorId);
      },
    ),
    'cards-theme-name.chaos-temporel': special('chaos-temporel', ({ ctx }) => {
      support.discardSubmissions(ctx);
      ctx.submissionFlow.open({
        id: THEME_NAME.submissions,
        players: ctx.players.otherIds(support.masterId(ctx)),
        secret: true,
      });
      support.updateCollectionPhase(ctx);
    }),
    'cards-theme-name.ultra-sabotage': special(
      'ultra-sabotage',
      ({ targetId, secondaryTargetId, ctx }) => {
        if (targetId != null) support.discardRandomName(targetId, ctx);
        if (secondaryTargetId != null && secondaryTargetId !== targetId)
          support.discardRandomName(secondaryTargetId, ctx);
      },
    ),
    'cards-theme-name.prenom-volant': special(
      'prenom-volant',
      ({ actorId, targetId, ctx }) => {
        if (targetId == null) return;
        const name = support.takeRandomName(targetId, ctx);
        if (name) ctx.cards.give(THEME_NAME.names, actorId, name);
      },
    ),
  };
}
function isAttack(effect: ThemeNameCardsSpecialEffect) {
  return ['sabotage', 'ultra-sabotage', 'main-fantome'].includes(effect);
}
