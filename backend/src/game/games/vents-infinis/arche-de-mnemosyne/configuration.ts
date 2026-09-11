import {
  defineConfiguration,
  defineEvent,
  gameInput,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import type { MnemoGameConfig } from './config';
import { MNEMO_BANKS } from './content';
import { MNEMO_PHASES } from './rules';
export const MNEMO_DEFAULT_CONFIG: MnemoGameConfig = {
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
export const MNEMO_CATEGORY_IDS = MNEMO_BANKS.map((bank) => bank.id);
export const QUIZ_STARTED = defineEvent({
  type: 'quiz.started',
  data: gameInput.object({ categoryId: gameInput.enum(MNEMO_CATEGORY_IDS) }),
});
export const GAME_CONFIGURATION = defineConfiguration<
  NoGameState,
  MnemoGameConfig
>({
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
});
