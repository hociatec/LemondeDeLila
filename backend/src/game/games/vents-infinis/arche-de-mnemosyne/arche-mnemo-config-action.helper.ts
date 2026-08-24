import type { GameStateEntity } from '../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../models/game-action.model';
import type {
  MnemoPrompt,
  MnemoQuizConfig,
  MnemoQuizMetadata,
} from './model/mnemo-quiz.model';

export function applyArcheMnemoConfigAction(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  type: string;
  payload: Record<string, unknown>;
  meta: MnemoQuizMetadata;
  canConfigure: (state: GameStateEntity, actorId: number | null) => boolean;
  getActionActorId: (action: GameSingleActionDto) => number | null;
  getPromptOwnerId: (meta: MnemoQuizMetadata) => number | null;
  clampInt: (
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ) => number;
  parseBool: (value: unknown, fallback: boolean) => boolean;
  buildConfigPrompt: (config: MnemoQuizConfig) => MnemoPrompt;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity | null {
  if (input.type === 'mnemo_prompt_cancel') {
    const cleared = {
      ...input.state,
      metadata: { ...input.meta, prompt: null, promptOwnerId: null },
    };
    return input.appendLog(cleared, 'Configuration fermÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e.');
  }

  if (input.type === 'mnemo_open_config') {
    const actorId = input.getActionActorId(input.action);
    if (!input.canConfigure(input.state, actorId)) {
      return input.state;
    }
    const prompt = input.buildConfigPrompt(input.meta.config);
    return {
      ...input.state,
      metadata: { ...input.meta, prompt, promptOwnerId: actorId },
    };
  }

  if (input.type === 'mnemo_set_config') {
    const actorId = input.getActionActorId(input.action);
    const ownerId = input.getPromptOwnerId(input.meta);
    if (actorId == null || ownerId == null || actorId !== ownerId) {
      return input.state;
    }
    const correctSoloPoints = input.clampInt(
      input.payload.correctSoloPoints,
      -50,
      50,
      Number(input.meta.config.correctSoloPoints ?? 2),
    );
    const correctMultiPoints = input.clampInt(
      input.payload.correctMultiPoints,
      -50,
      50,
      Number(input.meta.config.correctMultiPoints ?? 1),
    );
    const wrongPoints = input.clampInt(
      input.payload.wrongPoints,
      -50,
      50,
      Number(input.meta.config.wrongPoints ?? 0),
    );
    const timeoutPoints = input.clampInt(
      input.payload.timeoutPoints,
      -50,
      50,
      Number(input.meta.config.timeoutPoints ?? -1),
    );
    const targetPoints = Math.max(
      1,
      Math.min(200, Number(input.payload.targetPoints ?? 20)),
    );
    const timerSeconds = Math.max(
      5,
      Math.min(300, Number(input.payload.timerSeconds ?? 30)),
    );
    const useTimer = input.parseBool(input.payload.useTimer, false);
    const config: MnemoQuizConfig = {
      targetPoints,
      useTimer,
      timerSeconds,
      interQuestionSeconds: input.clampInt(
        input.payload.interQuestionSeconds,
        1,
        60,
        Number(input.meta.config.interQuestionSeconds ?? 15),
      ),
      correctSoloPoints,
      correctMultiPoints,
      wrongPoints,
      timeoutPoints,
    };
    const next = {
      ...input.state,
      metadata: { ...input.meta, config, prompt: null, promptOwnerId: null },
    };
    return input.appendLog(next, 'Configuration enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e.');
  }

  return null;
}


