import {
  defineAction,
  gameInput,
  rejectRule,
} from '../../../core/application/public-api';
import {
  GERARD_PRESIDENT_SPECIAL_CARDS,
  type GerardPresidentNameCard,
  type GerardPresidentThemeCard,
} from './content';
import type { GerardState } from './state';
import {
  GERARD_EXTRA_NAMES,
  GERARD_GHOST_NAMES,
  GERARD_JUDGE,
  GERARD_JURY_OVERRIDE,
  GERARD_PHASES,
  GERARD_SUBMISSIONS,
  GERARD_TARGET_SCORE,
  GERARD_THEME_SECRET,
  NAME_HANDS,
  SPECIAL_HANDS,
  advanceSubmission,
  allowedNameCount,
  clearSpecialAttackers,
  closeRound,
  combinations,
  gerardMasterId,
  juryId,
  pendingPlayers,
  sameSpecialInput,
  specialInputs,
  syncTurn,
  validateTargets,
  type SpecialInput,
} from './support';

export const setTheme = defineAction<GerardState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Le maître pioche et révèle le prochain thème.',
  available: ({ actor, ctx }) =>
    GERARD_PHASES.is(ctx, 'waiting-theme') && gerardMasterId(ctx) === actor.id,
  execute: ({ state, actor, ctx }) => {
    if (
      !GERARD_PHASES.is(ctx, 'waiting-theme') ||
      gerardMasterId(ctx) !== actor.id
    ) {
      rejectRule('Seul le maître peut révéler le thème');
    }
    const theme = ctx.cards.drawOrRecycle<GerardPresidentThemeCard>('themes');
    if (!theme) rejectRule('Plus aucun thème disponible');
    state.currentThemeId = theme.id;
    state.secondThemeId = null;
    ctx.counters.set(GERARD_THEME_SECRET, 0);
    const { participantPlayerIds: pendingPlayerIds } =
      ctx.submissionFlow.openForJudge({
        submissionId: GERARD_SUBMISSIONS,
        judgeId: GERARD_JUDGE,
        players: ctx.players.all().map((player) => player.id),
        secret: true,
      });
    const nextPhase = pendingPlayerIds.length
      ? 'collecting-names'
      : 'choosing-winner';
    ctx.round.start(gerardMasterId(ctx));
    ctx.counters.set(GERARD_JURY_OVERRIDE, 0);
    ctx.counters.set(GERARD_GHOST_NAMES, 0);
    clearSpecialAttackers(ctx);
    GERARD_PHASES.transition(ctx, nextPhase);
    ctx.turn.to(pendingPlayerIds[0] ?? actor.id);
  },
});

export const playName = defineAction<GerardState, { names: string[] }>({
  input: gameInput.object({
    names: gameInput.array(gameInput.string({ min: 1, max: 80 }), {
      min: 1,
      max: 3,
    }),
  }),
  documentation: 'Soumet secrètement un à trois prénoms autorisés.',
  available: ({ actor, ctx }) =>
    GERARD_PHASES.is(ctx, 'collecting-names') &&
    pendingPlayers(ctx)[0] === actor.id,
  validate: ({ state, actor, input, ctx }) => {
    const allowed = allowedNameCount(actor.id, ctx);
    const names = new Set(input.names);
    const hand = ctx.cards.hand<GerardPresidentNameCard>(NAME_HANDS, actor.id);
    return (
      input.names.length > 0 &&
      input.names.length <= allowed &&
      names.size === input.names.length &&
      !input.names.includes(state.lockedNameId ?? '') &&
      input.names.every((cardId) => hand.some((card) => card.id === cardId))
    );
  },
  enumerate: ({ state, actor, ctx }) => {
    if (pendingPlayers(ctx)[0] !== actor.id) return [];
    const allowed = allowedNameCount(actor.id, ctx);
    const hand = ctx.cards
      .hand<GerardPresidentNameCard>(NAME_HANDS, actor.id)
      .map((card) => card.id)
      .filter((cardId) => cardId !== state.lockedNameId);
    return combinations(hand, allowed).map((names) => ({ names }));
  },
  execute: ({ state, actor, input, ctx }) => {
    const allowed = allowedNameCount(actor.id, ctx);
    const distinct = [...new Set(input.names)];
    const hand = ctx.cards.hand<GerardPresidentNameCard>(NAME_HANDS, actor.id);
    if (
      distinct.length !== input.names.length ||
      distinct.length > allowed ||
      distinct.includes(state.lockedNameId ?? '') ||
      !distinct.every((cardId) => hand.some((card) => card.id === cardId))
    ) {
      rejectRule('Soumission de prénoms invalide');
    }
    for (const cardId of distinct) {
      const card = hand.find((candidate) => candidate.id === cardId);
      if (!card) rejectRule('Carte prénom absente de la main');
      ctx.cards.take(NAME_HANDS, actor.id, card);
    }
    ctx.submissionFlow.submit(GERARD_SUBMISSIONS, actor.id, distinct);
    ctx.resources.set(actor.id, GERARD_EXTRA_NAMES, 0);
    advanceSubmission(actor.id, ctx);
  },
});

export const playSpecial = defineAction<GerardState, SpecialInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.optional(gameInput.playerId()),
    secondaryTargetId: gameInput.optional(gameInput.playerId()),
    name: gameInput.optional(gameInput.string({ min: 1, max: 80 })),
  }),
  documentation: 'Joue une carte spéciale et applique son effet immédiatement.',
  available: ({ ctx }) => !GERARD_PHASES.is(ctx, 'choosing-winner'),
  validate: ({ actor, input, ctx }) =>
    specialInputs(actor.id, input.cardId, ctx).some((candidate) =>
      sameSpecialInput(candidate, input),
    ),
  enumerate: ({ actor, ctx }) =>
    ctx.cards
      .hand<string>(SPECIAL_HANDS, actor.id)
      .flatMap((cardId) => specialInputs(actor.id, cardId, ctx)),
  execute: ({ actor, input, ctx }) => {
    const card = GERARD_PRESIDENT_SPECIAL_CARDS.find(
      (candidate) => candidate.id === input.cardId,
    );
    if (
      !card ||
      !ctx.cards.hand<string>(SPECIAL_HANDS, actor.id).includes(card.id)
    ) {
      rejectRule('Carte spéciale absente de la main');
    }
    validateTargets(actor.id, input, ctx);
    ctx.cards.play(SPECIAL_HANDS, 'specials', actor.id, card.id);
    ctx.effects.schedule(
      ...card.effects.map((effect) =>
        effect.kind === 'custom'
          ? {
              ...effect,
              data: {
                targetPlayerId: input.targetPlayerId,
                secondaryTargetId: input.secondaryTargetId,
                name: input.name,
              },
            }
          : effect,
      ),
    );
    syncTurn(ctx);
  },
});

export const chooseWinner = defineAction<GerardState, { winnerId: number }>({
  input: gameInput.object({ winnerId: gameInput.playerId() }),
  documentation: 'Le jury attribue la manche à une soumission révélée.',
  available: ({ actor, ctx }) =>
    GERARD_PHASES.is(ctx, 'choosing-winner') && juryId(ctx) === actor.id,
  validate: ({ input, ctx }) =>
    (ctx.submissions.values<string[]>(GERARD_SUBMISSIONS)[input.winnerId]
      ?.length ?? 0) > 0,
  enumerate: ({ actor, ctx }) =>
    GERARD_PHASES.is(ctx, 'choosing-winner') && juryId(ctx) === actor.id
      ? Object.entries(
          ctx.submissions.values<string[]>(GERARD_SUBMISSIONS),
        ).flatMap(([winnerId, names]) =>
          names.length > 0 ? [{ winnerId: Number(winnerId) }] : [],
        )
      : [],
  execute: ({ state, actor, input, ctx }) => {
    if (!GERARD_PHASES.is(ctx, 'choosing-winner') || juryId(ctx) !== actor.id) {
      rejectRule('Ce joueur ne fait pas partie du jury');
    }
    if (
      !ctx.submissions.values<string[]>(GERARD_SUBMISSIONS)[input.winnerId]
        ?.length
    ) {
      rejectRule('Le gagnant doit avoir soumis un prénom');
    }
    const score = ctx.score.add(input.winnerId, 1);
    if (score >= GERARD_TARGET_SCORE) {
      ctx.match.finish({
        winners: [input.winnerId],
        reason: 'president-7-points',
      });
      return;
    }
    closeRound(state, input.winnerId, ctx);
  },
});

export const pass = defineAction<GerardState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Passe pendant la collecte des prénoms.',
  available: ({ actor, ctx }) =>
    GERARD_PHASES.is(ctx, 'collecting-names') &&
    pendingPlayers(ctx)[0] === actor.id,
  execute: ({ actor, ctx }) => {
    ctx.submissionFlow.submit(GERARD_SUBMISSIONS, actor.id, []);
    advanceSubmission(actor.id, ctx);
  },
});

export const GERARD_ACTIONS = {
  set_theme: setTheme,
  play_name: playName,
  play_special: playSpecial,
  choose_winner: chooseWinner,
  pass,
};
