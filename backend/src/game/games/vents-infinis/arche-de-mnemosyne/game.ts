import {
  defineConfiguration,
  defineEvent,
  defineGame,
  gameInput,
  quiz,
  simultaneousAnswers,
} from '../../../core/application/public-api';
import { MNEMO_BANKS, MNEMO_CATEGORIES } from './content';
import {
  MNEMO_ACTIONS,
  MNEMO_NEXT_QUESTION_TIMER,
  MNEMO_PHASES,
  MNEMO_QUESTION_TIMER,
  MNEMO_SESSION,
} from './rules';
import type { MnemoGameConfig, MnemoPlayerView, MnemoState } from './state';

const MNEMO_DEFAULT_CONFIG: MnemoGameConfig = {
  categoryId: 'all',
  targetPoints: 20,
  useTimer: true,
  timerSeconds: 30,
  interQuestionSeconds: 15,
  correctSoloPoints: 2,
  correctMultiPoints: 1,
  wrongPoints: 0,
  timeoutPoints: -1,
};
const MNEMO_CATEGORY_IDS = MNEMO_BANKS.map((bank) => bank.id);
const QUIZ_STARTED = defineEvent({
  type: 'quiz.started',
  data: gameInput.object({ categoryId: gameInput.enum(MNEMO_CATEGORY_IDS) }),
});

export default defineGame<MnemoState, typeof MNEMO_ACTIONS, MnemoPlayerView>({
  id: 'arche-de-mnemosyne',
  displayName: "L'Arche de Mnémosyne",
  category: 'Quiz',
  subcategory: 'VentsInfinis',
  description: 'Quiz simultané par catégories aux réponses mélangées.',
  players: { min: 1, max: 8 },
  patterns: [simultaneousAnswers()],
  config: defineConfiguration<MnemoState, MnemoGameConfig>({
    input: gameInput.object({
      categoryId: gameInput.enum(MNEMO_CATEGORY_IDS),
      targetPoints: gameInput.number({ integer: true, min: 1, max: 200 }),
      useTimer: gameInput.boolean(),
      timerSeconds: gameInput.number({ integer: true, min: 5, max: 300 }),
      interQuestionSeconds: gameInput.number({
        integer: true,
        min: 0,
        max: 60,
      }),
      correctSoloPoints: gameInput.number({
        integer: true,
        min: -50,
        max: 50,
      }),
      correctMultiPoints: gameInput.number({
        integer: true,
        min: -50,
        max: 50,
      }),
      wrongPoints: gameInput.number({ integer: true, min: -50, max: 50 }),
      timeoutPoints: gameInput.number({ integer: true, min: -50, max: 50 }),
    }),
    defaults: MNEMO_DEFAULT_CONFIG,
    phase: MNEMO_PHASES.initialPhase,
    permission: 'owner',
    ui: {
      title: 'Configuration du quiz',
      submitLabel: 'Démarrer le quiz',
    },
    onConfigured: ({ config, ctx }) => {
      MNEMO_PHASES.transition(ctx, 'playing');
      ctx.round.start(ctx.players.all()[0]?.id);
      QUIZ_STARTED.emit(ctx, { categoryId: config.categoryId });
    },
  }),
  components: MNEMO_BANKS.map((bank) =>
    quiz.bank({ id: bank.id, questions: bank.questions, shuffle: true }),
  ),
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'draw' }],
  setup: () => ({}),
  initialPhase: MNEMO_PHASES.initialPhase,
  phases: MNEMO_PHASES.phases,
  actions: MNEMO_ACTIONS,
  viewFragment: ({ ctx }) => {
    const session = ctx.quiz.session(MNEMO_SESSION);
    const currentSession = session?.phase === 'closed' ? null : session;
    const answeredPlayerIds = Object.keys(currentSession?.answers ?? {}).map(
      Number,
    );
    return {
      notBeforeMs: ctx.scheduler.deadline(MNEMO_NEXT_QUESTION_TIMER),
      answeredPlayerIds,
      questionLeaderId: ctx.round.starter() ?? 0,
      currentQuestion: currentSession
        ? structuredClone(currentSession.question)
        : null,
      remainingMilliseconds: ctx.scheduler.remaining(MNEMO_QUESTION_TIMER),
      categories: MNEMO_CATEGORIES,
    };
  },
  bot: {
    choose: ({ availableActions, ctx }) => {
      if (availableActions.includes('answer'))
        return { type: 'answer', payload: { answerIndex: ctx.random.int(4) } };
      if (availableActions.includes('draw'))
        return { type: 'draw', payload: {} };
      if (availableActions.includes('timeout'))
        return { type: 'timeout', payload: {} };
      return null;
    },
  },
});
