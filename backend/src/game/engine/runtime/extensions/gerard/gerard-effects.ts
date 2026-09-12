import { gameInput } from '../../actions/game-input-schema';
import type { GerardSpecialEffect, GerardThemeCard } from './program';
import type { DefinedGameEffectResolver } from '../../contracts/effect-resolver';
import { defineEffect } from '../../effects/effects-core';
import {
  GERARD,
  type GerardContext,
  type GerardState,
  type createGerardSupport,
  setGerardState,
} from './gerard-support';

type SpecialData = {
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
};
type Support = ReturnType<typeof createGerardSupport>;
type Execution = {
  state: GerardState;
  actorId: number;
  targetId: number | null;
  secondaryTargetId: number | null;
  name: string | null;
  ctx: GerardContext;
};

export function createGerardEffects(support: Support) {
  function special(
    effect: GerardSpecialEffect,
    apply: (input: Execution) => void,
  ): DefinedGameEffectResolver<GerardState, SpecialData> {
    return defineEffect<GerardState, SpecialData>({
      input: gameInput.object({
        targetPlayerId: gameInput.optional(gameInput.playerId()),
        secondaryTargetId: gameInput.optional(gameInput.playerId()),
        name: gameInput.optional(gameInput.string({ min: 1, max: 80 })),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId == null) return;
        const targetId = data.targetPlayerId ?? null;
        const defended =
          targetId != null && ctx.status.consume(targetId, GERARD.defense);
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
    'gerard.double-prenom': special('double-prenom', ({ actorId, ctx }) => {
      ctx.resources.set(actorId, GERARD.extraNames, 1);
    }),
    'gerard.mega-combo': special('mega-combo', ({ actorId, ctx }) => {
      ctx.resources.set(actorId, GERARD.extraNames, 2);
    }),
    'gerard.double-theme': special('double-theme', ({ state, ctx }) => {
      setGerardState(
        state,
        'secondThemeId',
        ctx.cards.drawOrRecycle<GerardThemeCard>('themes')?.id ?? null,
      );
    }),
    'gerard.interdiction': special('interdiction', ({ state, name }) => {
      setGerardState(state, 'lockedNameId', name);
    }),
    'gerard.defense-totale': special('defense-totale', ({ actorId, ctx }) => {
      ctx.status.add(actorId, GERARD.defense, { scope: 'round' });
    }),
    'gerard.main-fantome': special('main-fantome', ({ targetId, ctx }) => {
      if (targetId == null) return;
      const name = support.takeRandomName(targetId, ctx);
      ctx.submissions.replace(
        GERARD.submissions,
        targetId,
        name ? [name.id] : [],
      );
      support.updateCollectionPhase(ctx);
    }),
    'gerard.echange-force': special(
      'echange-force',
      ({ actorId, targetId, ctx }) => {
        if (targetId != null)
          support.exchangeRandomNames(actorId, targetId, ctx);
      },
    ),
    'gerard.panique-generale': special('panique-generale', ({ ctx }) => {
      for (const player of ctx.players.all())
        support.redrawNames(player.id, 3, ctx);
    }),
    'gerard.sabotage': special('sabotage', ({ targetId, ctx }) => {
      if (targetId != null) support.discardRandomName(targetId, ctx);
    }),
    'gerard.retour-envoyeur': special('retour-envoyeur', ({ actorId, ctx }) => {
      const attacker = support.takeSpecialAttacker(actorId, ctx);
      if (attacker != null) support.discardRandomName(attacker, ctx);
    }),
    'gerard.theme-secret': special('theme-secret', ({ ctx }) => {
      ctx.counters.set(GERARD.themeSecret, 1);
    }),
    'gerard.chuchotement-confus': special(
      'chuchotement-confus',
      ({ targetId, ctx }) => {
        if (targetId == null) return;
        const neighborId = ctx.players.after(targetId)?.id ?? null;
        if (neighborId != null)
          support.exchangeRandomNames(targetId, neighborId, ctx);
      },
    ),
    'gerard.inversion': special('inversion', ({ ctx }) => {
      ctx.submissions.reorderPending(
        GERARD.submissions,
        support.pendingPlayers(ctx).reverse(),
      );
    }),
    'gerard.jury-mystere': special(
      'jury-mystere',
      ({ actorId, targetId, ctx }) => {
        ctx.counters.set(
          GERARD.juryOverride,
          targetId ?? ctx.random.pick(ctx.players.otherIds(actorId)) ?? 0,
        );
      },
    ),
    'gerard.effet-domino': special('effet-domino', ({ ctx }) => {
      for (const playerId of support.pendingPlayers(ctx))
        ctx.resources.add(playerId, GERARD.extraNames, 1);
    }),
    'gerard.prenom-fantome': special('prenom-fantome', ({ ctx }) => {
      ctx.counters.add(GERARD.ghostNames, 1);
    }),
    'gerard.inversion-role': special('inversion-role', ({ actorId, ctx }) => {
      ctx.judge.setCurrent(GERARD.judge, actorId);
    }),
    'gerard.chaos-temporel': special('chaos-temporel', ({ ctx }) => {
      support.discardSubmissions(ctx);
      ctx.submissionFlow.open({
        id: GERARD.submissions,
        players: ctx.players.otherIds(support.masterId(ctx)),
        secret: true,
      });
      support.updateCollectionPhase(ctx);
    }),
    'gerard.ultra-sabotage': special(
      'ultra-sabotage',
      ({ targetId, secondaryTargetId, ctx }) => {
        if (targetId != null) support.discardRandomName(targetId, ctx);
        if (secondaryTargetId != null && secondaryTargetId !== targetId)
          support.discardRandomName(secondaryTargetId, ctx);
      },
    ),
    'gerard.prenom-volant': special(
      'prenom-volant',
      ({ actorId, targetId, ctx }) => {
        if (targetId == null) return;
        const name = support.takeRandomName(targetId, ctx);
        if (name) ctx.cards.give(GERARD.names, actorId, name);
      },
    ),
  };
}
function isAttack(effect: GerardSpecialEffect) {
  return ['sabotage', 'ultra-sabotage', 'main-fantome'].includes(effect);
}
