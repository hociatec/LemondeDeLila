import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-kit';
import { defineCardsSchema } from '../../cards/typed-cards';
import type {
  GerardNameCard,
  GerardProgram,
  GerardThemeCard,
} from '../../extensions/gerard/program';
import { defineGamePhases } from '../../kits/phase-kit';
import { cardGame } from '../../patterns/gameplay-pattern-track-card';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import { createGerardEffects } from './gerard-effects';
import {
  combinations,
  createGerardSupport,
  GERARD,
  gerardState,
  setGerardState,
  type GerardState,
  type GerardContext,
  type SpecialInput,
} from './gerard-support';

export function gerardRules(source: GerardProgram) {
  const program = structuredClone(source);
  const phases = defineGamePhases<GerardState>()({
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
  const support = createGerardSupport(program, phases);
  const createActions = () => {
    const setTheme = defineAction<GerardState, Record<string, never>>({
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
        const theme = ctx.cards.drawOrRecycle<GerardThemeCard>('themes');
        if (!theme) rejectRule('Plus aucun thème disponible');
        setGerardState(state, 'currentThemeId', theme.id);
        setGerardState(state, 'secondThemeId', null);
        ctx.counters.set(GERARD.themeSecret, 0);
        const { participantPlayerIds } = ctx.submissionFlow.openForJudge({
          submissionId: GERARD.submissions,
          judgeId: GERARD.judge,
          players: ctx.players.all().map((player) => player.id),
          secret: true,
        });
        const next = participantPlayerIds.length
          ? 'collecting-names'
          : 'choosing-winner';
        ctx.round.start(support.masterId(ctx));
        ctx.counters.set(GERARD.juryOverride, 0);
        ctx.counters.set(GERARD.ghostNames, 0);
        support.clearSpecialAttackers(ctx);
        phases.transition(ctx, next);
        ctx.turn.to(participantPlayerIds[0] ?? actor.id);
      },
    });
    const playName = defineAction<GerardState, { names: string[] }>({
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
        const hand = ctx.cards.hand<GerardNameCard>(GERARD.names, actor.id);
        return (
          input.names.length > 0 &&
          input.names.length <= allowed &&
          names.size === input.names.length &&
          !input.names.includes(gerardState(state, 'lockedNameId') ?? '') &&
          input.names.every((id) => hand.some((card) => card.id === id))
        );
      },
      enumerate: ({ state, actor, ctx }) => {
        if (support.pendingPlayers(ctx)[0] !== actor.id) return [];
        const allowed = support.allowedNameCount(actor.id, ctx);
        const locked = gerardState(state, 'lockedNameId');
        const hand = ctx.cards
          .hand<GerardNameCard>(GERARD.names, actor.id)
          .map((card) => card.id)
          .filter((id) => id !== locked);
        return combinations(hand, allowed).map((names) => ({ names }));
      },
      execute: ({ state, actor, input, ctx }) => {
        const allowed = support.allowedNameCount(actor.id, ctx);
        const distinct = [...new Set(input.names)];
        const hand = ctx.cards.hand<GerardNameCard>(GERARD.names, actor.id);
        if (
          distinct.length !== input.names.length ||
          distinct.length > allowed ||
          distinct.includes(gerardState(state, 'lockedNameId') ?? '') ||
          !distinct.every((id) => hand.some((card) => card.id === id))
        )
          rejectRule('Soumission de prénoms invalide');
        for (const cardId of distinct) {
          const card = hand.find((candidate) => candidate.id === cardId);
          if (!card) rejectRule('Carte prénom absente de la main');
          ctx.cards.take(GERARD.names, actor.id, card);
        }
        ctx.submissionFlow.submit(GERARD.submissions, actor.id, distinct);
        ctx.resources.set(actor.id, GERARD.extraNames, 0);
        support.updateCollectionPhase(ctx);
      },
    });
    const playSpecial = defineAction<GerardState, SpecialInput>({
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
          .hand<string>(GERARD.specials, actor.id)
          .flatMap((cardId) => support.specialInputs(actor.id, cardId, ctx)),
      execute: ({ actor, input, ctx }) => {
        const card = program.specialCards.find(
          (candidate) => candidate.id === input.cardId,
        );
        if (!card) rejectRule('Carte spéciale absente de la main');
        support.validateTargets(actor.id, input, ctx);
        ctx.cards.play(GERARD.specials, 'specials', actor.id, card.id);
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
    const chooseWinner = defineAction<GerardState, { winnerId: number }>({
      input: gameInput.object({ winnerId: gameInput.playerId() }),
      documentation: 'Le jury attribue la manche à une soumission révélée.',
      available: ({ actor, ctx }) =>
        phases.is(ctx, 'choosing-winner') && support.juryId(ctx) === actor.id,
      validate: ({ input, ctx }) =>
        (ctx.submissions.values<string[]>(GERARD.submissions)[input.winnerId]
          ?.length ?? 0) > 0,
      enumerate: ({ actor, ctx }) =>
        phases.is(ctx, 'choosing-winner') && support.juryId(ctx) === actor.id
          ? Object.entries(
              ctx.submissions.values<string[]>(GERARD.submissions),
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
          !ctx.submissions.values<string[]>(GERARD.submissions)[input.winnerId]
            ?.length
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
    const pass = defineAction<GerardState, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Passe pendant la collecte des prénoms.',
      available: ({ actor, ctx }) =>
        phases.is(ctx, 'collecting-names') &&
        support.pendingPlayers(ctx)[0] === actor.id,
      execute: ({ actor, ctx }) => {
        ctx.submissionFlow.submit(GERARD.submissions, actor.id, []);
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
          id: GERARD.names,
          deck: 'names',
          initial: 10,
          visibility: 'owner',
        }),
        specials: cards.hands({
          id: GERARD.specials,
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
      players: ReturnType<GerardContext['players']['all']>;
      ctx: GerardContext;
    }): GerardState => {
      ctx.submissionFlow.startJudge(GERARD.judge, {
        players: players.map((player) => player.id),
      });
      const state: GerardState = {};
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
      effects: createGerardEffects(support),
      patterns: [
        cardGame({
          schema,
          deckId: 'names',
          handId: GERARD.names,
        }),
      ],
      setup,
      viewExtension: ({
        state,
        actor,
        ctx,
      }: {
        state: GerardState;
        actor: { id: number } | null;
        ctx: GerardContext;
      }) => {
        const hidden =
          ctx.counters.get(GERARD.themeSecret) > 0 &&
          actor?.id !== support.masterId(ctx);
        const current = gerardState(state, 'currentThemeId');
        const second = gerardState(state, 'secondThemeId');
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
          return { recipe: 'gerard-set-theme' as const, payload: {} };
        if (phases.is(ctx, 'choosing-winner')) {
          const candidates = Object.entries(
            ctx.submissions.values<string[]>(GERARD.submissions),
          )
            .filter(([, names]) => names.length > 0)
            .map(([id]) => Number(id));
          const winnerId = ctx.ranking.rank(candidates)[0]?.playerId;
          return winnerId == null
            ? null
            : {
                recipe: 'gerard-choose-winner' as const,
                payload: { winnerId },
              };
        }
        const name = ctx.cards.hand<GerardNameCard>(GERARD.names, actorId)[0]
          ?.id;
        return name
          ? { recipe: 'gerard-play-name' as const, payload: { names: [name] } }
          : { recipe: 'gerard-pass' as const, payload: {} };
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
