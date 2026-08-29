import { defineEffect, gameInput } from '../../../engine/sdk/public-api';
import type { DefinedGameEffectResolver } from '../../../engine/sdk/public-api';
import { type GerardPresidentThemeCard } from './content';
import type { GerardSpecialEffect } from './special-cards';
import type { GerardState } from './state';
import {
  GERARD_DEFENSE,
  GERARD_EXTRA_NAMES,
  GERARD_GHOST_NAMES,
  GERARD_JUDGE,
  GERARD_JURY_OVERRIDE,
  GERARD_SUBMISSIONS,
  GERARD_THEME_SECRET,
  NAME_HANDS,
  addSpecialAttacker,
  consumeDefense,
  discardRandomName,
  discardSubmissions,
  exchangeRandomNames,
  gerardMasterId,
  pendingPlayers,
  redrawNames,
  takeRandomName,
  takeSpecialAttacker,
  updateCollectionPhase,
  type RuleContext,
} from './support';

type GerardSpecialData = {
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
};

type GerardSpecialExecution = {
  state: GerardState;
  actorId: number;
  targetId: number | null;
  secondaryTargetId: number | null;
  name: string | null;
  ctx: RuleContext;
};

function gerardSpecial(
  effect: GerardSpecialEffect,
  apply: (input: GerardSpecialExecution) => void,
): DefinedGameEffectResolver<GerardState, GerardSpecialData> {
  return defineEffect<GerardState, GerardSpecialData>({
    input: gameInput.object({
      targetPlayerId: gameInput.optional(gameInput.playerId()),
      secondaryTargetId: gameInput.optional(gameInput.playerId()),
      name: gameInput.optional(gameInput.string({ min: 1, max: 80 })),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId == null) return;
      const targetId = data.targetPlayerId ?? null;
      const defended = targetId != null && consumeDefense(targetId, ctx);
      if (targetId != null) addSpecialAttacker(targetId, actorPlayerId, ctx);
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

export const GERARD_EFFECTS = {
  'gerard.double-prenom': gerardSpecial('double-prenom', ({ actorId, ctx }) => {
    ctx.resources.set(actorId, GERARD_EXTRA_NAMES, 1);
  }),
  'gerard.mega-combo': gerardSpecial('mega-combo', ({ actorId, ctx }) => {
    ctx.resources.set(actorId, GERARD_EXTRA_NAMES, 2);
  }),
  'gerard.double-theme': gerardSpecial('double-theme', ({ state, ctx }) => {
    state.secondThemeId =
      ctx.cards.drawOrRecycle<GerardPresidentThemeCard>('themes')?.id ?? null;
  }),
  'gerard.interdiction': gerardSpecial('interdiction', ({ state, name }) => {
    state.lockedNameId = name;
  }),
  'gerard.defense-totale': gerardSpecial(
    'defense-totale',
    ({ actorId, ctx }) => {
      ctx.status.add(actorId, GERARD_DEFENSE, { scope: 'round' });
    },
  ),
  'gerard.main-fantome': gerardSpecial('main-fantome', ({ targetId, ctx }) => {
    if (targetId == null) return;
    const name = takeRandomName(targetId, ctx);
    ctx.submissions.replace(
      GERARD_SUBMISSIONS,
      targetId,
      name ? [name.id] : [],
    );
    updateCollectionPhase(ctx);
  }),
  'gerard.echange-force': gerardSpecial(
    'echange-force',
    ({ actorId, targetId, ctx }) => {
      if (targetId != null) exchangeRandomNames(actorId, targetId, ctx);
    },
  ),
  'gerard.panique-generale': gerardSpecial('panique-generale', ({ ctx }) => {
    for (const player of ctx.players.all()) redrawNames(player.id, 3, ctx);
  }),
  'gerard.sabotage': gerardSpecial('sabotage', ({ targetId, ctx }) => {
    if (targetId != null) discardRandomName(targetId, ctx);
  }),
  'gerard.retour-envoyeur': gerardSpecial(
    'retour-envoyeur',
    ({ actorId, ctx }) => {
      const attacker = takeSpecialAttacker(actorId, ctx);
      if (attacker != null) discardRandomName(attacker, ctx);
    },
  ),
  'gerard.theme-secret': gerardSpecial('theme-secret', ({ ctx }) => {
    ctx.counters.set(GERARD_THEME_SECRET, 1);
  }),
  'gerard.chuchotement-confus': gerardSpecial(
    'chuchotement-confus',
    ({ targetId, ctx }) => {
      if (targetId == null) return;
      const neighborId = ctx.players.after(targetId)?.id ?? null;
      if (neighborId != null) exchangeRandomNames(targetId, neighborId, ctx);
    },
  ),
  'gerard.inversion': gerardSpecial('inversion', ({ ctx }) => {
    ctx.submissions.reorderPending(
      GERARD_SUBMISSIONS,
      pendingPlayers(ctx).reverse(),
    );
  }),
  'gerard.jury-mystere': gerardSpecial(
    'jury-mystere',
    ({ actorId, targetId, ctx }) => {
      ctx.counters.set(
        GERARD_JURY_OVERRIDE,
        targetId ?? ctx.random.pick(ctx.players.otherIds(actorId)) ?? 0,
      );
    },
  ),
  'gerard.effet-domino': gerardSpecial('effet-domino', ({ ctx }) => {
    for (const playerId of pendingPlayers(ctx)) {
      ctx.resources.add(playerId, GERARD_EXTRA_NAMES, 1);
    }
  }),
  'gerard.prenom-fantome': gerardSpecial('prenom-fantome', ({ ctx }) => {
    ctx.counters.add(GERARD_GHOST_NAMES, 1);
  }),
  'gerard.inversion-role': gerardSpecial(
    'inversion-role',
    ({ actorId, ctx }) => {
      ctx.judge.setCurrent(GERARD_JUDGE, actorId);
    },
  ),
  'gerard.chaos-temporel': gerardSpecial('chaos-temporel', ({ ctx }) => {
    discardSubmissions(ctx);
    ctx.submissionFlow.open({
      id: GERARD_SUBMISSIONS,
      players: ctx.players.otherIds(gerardMasterId(ctx)),
      secret: true,
    });
    updateCollectionPhase(ctx);
  }),
  'gerard.ultra-sabotage': gerardSpecial(
    'ultra-sabotage',
    ({ targetId, secondaryTargetId, ctx }) => {
      if (targetId != null) discardRandomName(targetId, ctx);
      if (secondaryTargetId != null && secondaryTargetId !== targetId) {
        discardRandomName(secondaryTargetId, ctx);
      }
    },
  ),
  'gerard.prenom-volant': gerardSpecial(
    'prenom-volant',
    ({ actorId, targetId, ctx }) => {
      if (targetId == null) return;
      const name = takeRandomName(targetId, ctx);
      if (name) ctx.cards.give(NAME_HANDS, actorId, name);
    },
  ),
} as const;

function isAttack(effect: GerardSpecialEffect): boolean {
  return ['sabotage', 'ultra-sabotage', 'main-fantome'].includes(effect);
}
