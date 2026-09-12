import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-kit';
import { defineCardsSchema } from '../../cards/typed-cards';
import type {
  ThemeNameCardsNameCard,
  ThemeNameCardsProgram,
  ThemeNameCardsThemeCard,
} from './program';
import { defineGamePhases } from '../../kits/phase-kit';
import { cardGame } from '../../patterns/gameplay-pattern-track-card';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import { createThemeNameCardsEffects } from './theme-name-effects';
import {
  combinations,
  createThemeNameCardsSupport,
  THEME_NAME,
  themeNameCardsState,
  setThemeNameCardsState,
  type ThemeNameCardsState,
  type ThemeNameCardsContext,
  type SpecialInput,
} from './theme-name-support';

export function themeNameCardsRules(source: ThemeNameCardsProgram) {
  const program = structuredClone(source);
  const phases = defineGamePhases<ThemeNameCardsState>()({
    initialPhase: 'waiting-theme',
    phases: {
      'waiting-theme': {
        transitions: ['collecting-names', 'choosing-winner'],
      },
      'collecting-names': { transitions: ['choosing-winner'] },
      'choosing-winner': {
        transitions: ['waiting-theme', 'collecting-names'],
      },
    },
  });
  const support = createThemeNameCardsSupport(program, phases);
  const createActions = () => {
    const setTheme = defineAction<ThemeNameCardsState, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Le maître pioche et révèle le prochain thème.',
      available: ({ actor, ctx }) =>
        phases.is(ctx, 'waiting-theme') && support.masterId(ctx) === actor.id,
      execute: ({ state, actor, ctx }) => {
        if (
          !phases.is(ctx, 'waiting-theme') ||
          support.masterId(ctx) !== actor.id
        )
          rejectRule('Seul le maître peut révéler le thème');
        const theme =
          ctx.cards.drawOrRecycle<ThemeNameCardsThemeCard>('themes');
        if (!theme) rejectRule('Plus aucun thème disponible');
        setThemeNameCardsState(state, 'currentThemeId', theme.id);
        setThemeNameCardsState(state, 'secondThemeId', null);
        ctx.counters.set(THEME_NAME.themeSecret, 0);
        const { participantPlayerIds } = ctx.submissionFlow.openForJudge({
          submissionId: THEME_NAME.submissions,
          judgeId: THEME_NAME.judge,
          players: ctx.players.all().map((player) => player.id),
          secret: true,
        });
        const next = participantPlayerIds.length
          ? 'collecting-names'
          : 'choosing-winner';
        ctx.round.start(support.masterId(ctx));
        ctx.counters.set(THEME_NAME.juryOverride, 0);
        ctx.counters.set(THEME_NAME.ghostNames, 0);
        support.clearSpecialAttackers(ctx);
        phases.transition(ctx, next);
        ctx.turn.to(participantPlayerIds[0] ?? actor.id);
      },
    });
    const playName = defineAction<ThemeNameCardsState, { names: string[] }>({
      input: gameInput.object({
        names: gameInput.array(gameInput.string({ min: 1, max: 80 }), {
          min: 1,
          max: 3,
        }),
      }),
      documentation: 'Soumet secrètement un à trois prénoms autorisés.',
      available: ({ actor, ctx }) =>
        phases.is(ctx, 'collecting-names') &&
        support.pendingPlayers(ctx)[0] === actor.id,
      validate: ({ state, actor, input, ctx }) => {
        const allowed = support.allowedNameCount(actor.id, ctx);
        const names = new Set(input.names);
        const hand = ctx.cards.hand<ThemeNameCardsNameCard>(
          THEME_NAME.names,
          actor.id,
        );
        return (
          input.names.length > 0 &&
          input.names.length <= allowed &&
          names.size === input.names.length &&
          !input.names.includes(
            themeNameCardsState(state, 'lockedNameId') ?? '',
          ) &&
          input.names.every((id) => hand.some((card) => card.id === id))
        );
      },
      enumerate: ({ state, actor, ctx }) => {
        if (support.pendingPlayers(ctx)[0] !== actor.id) return [];
        const allowed = support.allowedNameCount(actor.id, ctx);
        const locked = themeNameCardsState(state, 'lockedNameId');
        const hand = ctx.cards
          .hand<ThemeNameCardsNameCard>(THEME_NAME.names, actor.id)
          .map((card) => card.id)
          .filter((id) => id !== locked);
        return combinations(hand, allowed).map((names) => ({ names }));
      },
      execute: ({ state, actor, input, ctx }) => {
        const allowed = support.allowedNameCount(actor.id, ctx);
        const distinct = [...new Set(input.names)];
        const hand = ctx.cards.hand<ThemeNameCardsNameCard>(
          THEME_NAME.names,
          actor.id,
        );
        if (
          distinct.length !== input.names.length ||
          distinct.length > allowed ||
          distinct.includes(themeNameCardsState(state, 'lockedNameId') ?? '') ||
          !distinct.every((id) => hand.some((card) => card.id === id))
        )
          rejectRule('Soumission de prénoms invalide');
        for (const cardId of distinct) {
          const card = hand.find((candidate) => candidate.id === cardId);
          if (!card) rejectRule('Carte prénom absente de la main');
          ctx.cards.take(THEME_NAME.names, actor.id, card);
        }
        ctx.submissionFlow.submit(THEME_NAME.submissions, actor.id, distinct);
        ctx.resources.set(actor.id, THEME_NAME.extraNames, 0);
        support.updateCollectionPhase(ctx);
      },
    });
    const playSpecial = defineAction<ThemeNameCardsState, SpecialInput>({
      input: gameInput.object({
        cardId: gameInput.cardId(),
        targetPlayerId: gameInput.optional(gameInput.playerId()),
        secondaryTargetId: gameInput.optional(gameInput.playerId()),
        name: gameInput.optional(gameInput.string({ min: 1, max: 80 })),
      }),
      documentation: 'Joue une carte spéciale et applique son effet.',
      available: ({ ctx }) => phases.is(ctx, 'collecting-names'),
      validate: ({ actor, input, ctx }) =>
        support
          .specialInputs(actor.id, input.cardId, ctx)
          .some((candidate) => sameInput(candidate, input)),
      enumerate: ({ actor, ctx }) =>
        ctx.cards
          .hand<string>(THEME_NAME.specials, actor.id)
          .flatMap((cardId) => support.specialInputs(actor.id, cardId, ctx)),
      execute: ({ actor, input, ctx }) => {
        const card = program.specialCards.find(
          (candidate) => candidate.id === input.cardId,
        );
        if (!card) rejectRule('Carte spéciale absente de la main');
        support.validateTargets(actor.id, input, ctx);
        ctx.cards.play(THEME_NAME.specials, 'specials', actor.id, card.id);
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
        support.syncTurn(ctx);
      },
    });
    const chooseWinner = defineAction<
      ThemeNameCardsState,
      { winnerId: number }
    >({
      input: gameInput.object({ winnerId: gameInput.playerId() }),
      documentation: 'Le jury attribue la manche à une soumission révélée.',
      available: ({ actor, ctx }) =>
        phases.is(ctx, 'choosing-winner') && support.juryId(ctx) === actor.id,
      validate: ({ input, ctx }) =>
        (ctx.submissions.values<string[]>(THEME_NAME.submissions)[
          input.winnerId
        ]?.length ?? 0) > 0,
      enumerate: ({ actor, ctx }) =>
        phases.is(ctx, 'choosing-winner') && support.juryId(ctx) === actor.id
          ? Object.entries(
              ctx.submissions.values<string[]>(THEME_NAME.submissions),
            ).flatMap(([winnerId, names]) =>
              names.length > 0 ? [{ winnerId: Number(winnerId) }] : [],
            )
          : [],
      execute: ({ state, actor, input, ctx }) => {
        if (
          !phases.is(ctx, 'choosing-winner') ||
          support.juryId(ctx) !== actor.id
        )
          rejectRule('Ce joueur ne fait pas partie du jury');
        if (
          !ctx.submissions.values<string[]>(THEME_NAME.submissions)[
            input.winnerId
          ]?.length
        )
          rejectRule('Le gagnant doit avoir soumis un prénom');
        ctx.score.add(input.winnerId, 1);
        if (ctx.score.get(input.winnerId) >= program.targetScore) {
          ctx.match.finish({
            winners: [input.winnerId],
            reason: 'president-7-points',
          });
          return;
        }
        support.closeRound(state, input.winnerId, ctx);
      },
    });
    const pass = defineAction<ThemeNameCardsState, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Passe pendant la collecte des prénoms.',
      available: ({ actor, ctx }) =>
        phases.is(ctx, 'collecting-names') &&
        support.pendingPlayers(ctx)[0] === actor.id,
      execute: ({ actor, ctx }) => {
        ctx.submissionFlow.submit(THEME_NAME.submissions, actor.id, []);
        support.updateCollectionPhase(ctx);
      },
    });
    return { setTheme, playName, playSpecial, chooseWinner, pass };
  };
  const { setTheme, playName, playSpecial, chooseWinner, pass } =
    createActions();
  const buildDefinition = () => {
    const specialCards = program.specialCards.flatMap((card) => [
      card.id,
      card.id,
    ]);
    const schema = defineCardsSchema({
      decks: {
        themes: cards.deck({
          id: 'themes',
          cards: program.themes,
          shuffle: true,
        }),
        names: cards.deck({
          id: 'names',
          cards: program.names,
          shuffle: true,
          empty: 'recycle',
        }),
        specials: cards.deck({
          id: 'specials',
          cards: specialCards,
          shuffle: true,
          empty: 'recycle',
        }),
      },
      hands: {
        names: cards.hands({
          id: THEME_NAME.names,
          deck: 'names',
          initial: 10,
          visibility: 'owner',
        }),
        specials: cards.hands({
          id: THEME_NAME.specials,
          deck: 'specials',
          initial: 2,
          visibility: 'owner',
        }),
      },
    });
    const setup = ({
      players,
      ctx,
    }: {
      players: ReturnType<ThemeNameCardsContext['players']['all']>;
      ctx: ThemeNameCardsContext;
    }): ThemeNameCardsState => {
      ctx.submissionFlow.startJudge(THEME_NAME.judge, {
        players: players.map((player) => player.id),
      });
      const state: ThemeNameCardsState = {};
      Reflect.set(state, 'currentThemeId', null);
      Reflect.set(state, 'secondThemeId', null);
      Reflect.set(state, 'lockedNameId', null);
      return state;
    };
    return {
      setTheme,
      playName,
      playSpecial,
      chooseWinner,
      pass,
      effects: createThemeNameCardsEffects(support),
      patterns: [
        cardGame({
          schema,
          deckId: 'names',
          handId: THEME_NAME.names,
        }),
      ],
      setup,
      viewExtension: ({
        state,
        actor,
        ctx,
      }: {
        state: ThemeNameCardsState;
        actor: { id: number } | null;
        ctx: ThemeNameCardsContext;
      }) => {
        const hidden =
          ctx.counters.get(THEME_NAME.themeSecret) > 0 &&
          actor?.id !== support.masterId(ctx);
        const current = themeNameCardsState(state, 'currentThemeId');
        const second = themeNameCardsState(state, 'secondThemeId');
        return {
          currentTheme: hidden
            ? 'Thème secret'
            : (program.themes.find((theme) => theme.id === current)?.text ??
              null),
          secondTheme: hidden
            ? null
            : (program.themes.find((theme) => theme.id === second)?.text ??
              null),
        };
      },
      chooseBot(actorId: number, ctx: Parameters<typeof support.masterId>[0]) {
        if (phases.is(ctx, 'waiting-theme'))
          return { recipe: 'cards-theme-name-set-theme' as const, payload: {} };
        if (phases.is(ctx, 'choosing-winner')) {
          const candidates = Object.entries(
            ctx.submissions.values<string[]>(THEME_NAME.submissions),
          )
            .filter(([, names]) => names.length > 0)
            .map(([id]) => Number(id));
          const winnerId = ctx.ranking.rank(candidates)[0]?.playerId;
          return winnerId == null
            ? null
            : {
                recipe: 'cards-theme-name-choose-winner' as const,
                payload: { winnerId },
              };
        }
        const name = ctx.cards.hand<ThemeNameCardsNameCard>(
          THEME_NAME.names,
          actorId,
        )[0]?.id;
        return name
          ? {
              recipe: 'cards-theme-name-play-name' as const,
              payload: { names: [name] },
            }
          : { recipe: 'cards-theme-name-pass' as const, payload: {} };
      },
    };
  };
  return buildDefinition();
}
function sameInput(left: SpecialInput, right: SpecialInput) {
  return (
    left.cardId === right.cardId &&
    left.targetPlayerId === right.targetPlayerId &&
    left.secondaryTargetId === right.secondaryTargetId &&
    left.name === right.name
  );
}
