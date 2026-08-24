import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  MnemoQuizConfig,
  MnemoQuizMetadata,
} from '../../model/mnemo-quiz.model';
import type { ArcheMnemoStateService } from './arche-mnemo-state.service';

type ArcheSetupDeps = {
  stateSvc: ArcheMnemoStateService;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
};

export function hydrateArcheInitialState(
  deps: ArcheSetupDeps,
  baseState: GameStateEntity,
): GameStateEntity {
  const players = Array.isArray(baseState.players) ? baseState.players : [];
  const initialFirstId = players[0]?.id ?? null;
  const baseMeta = deps.stateSvc.asRecord(baseState.metadata);
  const ownerPlayerId = (() => {
    if (typeof baseMeta.roomOwnerId === 'number') return baseMeta.roomOwnerId;
    if (typeof baseMeta.ownerPlayerId === 'number') return baseMeta.ownerPlayerId;

    const firstHumanId = players.find((p) => p && p.isBot !== true)?.id ?? null;
    return firstHumanId ?? initialFirstId;
  })();

  const config: MnemoQuizConfig = {
    targetPoints: 20,
    useTimer: true,
    timerSeconds: 30,
    interQuestionSeconds: 15,
    correctSoloPoints: 2,
    correctMultiPoints: 1,
    wrongPoints: 0,
    timeoutPoints: -1,
  };

  const meta: MnemoQuizMetadata = {
    rng:
      typeof baseState.metadata === 'object' && baseState.metadata
        ? (deps.stateSvc.asRecord(baseState.metadata).rng as
            | Record<string, unknown>
            | undefined)
        : undefined,
    ownerPlayerId,
    config,
    selectedCategoryId: null,
    scoresByPlayerId: Object.fromEntries(players.map((p) => [p.id, 0])),
    usedQuestionIds: [],
    currentQuestion: null,
    quizAnswersByPlayerId: {},
    quizDeadlineAtMs: null,
    adminView: { page: 'setup' },
    prompt: deps.stateSvc.buildConfigPrompt(config),
    promptOwnerId: ownerPlayerId,
    winnerId: null,
  };

  const firstId =
    players.find((p) => p?.id === ownerPlayerId)?.id ?? initialFirstId;

  const state: GameStateEntity = {
    ...baseState,
    status: 'started',
    phase: 'setup',
    round: baseState.round ?? 1,
    turnIndex: baseState.turnIndex ?? 0,
    turn: { currentPlayerId: firstId, direction: 1 },
    pending: null,
    metadata: meta,
    log: Array.isArray(baseState.log) ? baseState.log : [],
  };

  return deps.appendLog(
    state,
    'Quiz : choisissez une catégorie (ou Mélange) pour démarrer.',
  );
}
