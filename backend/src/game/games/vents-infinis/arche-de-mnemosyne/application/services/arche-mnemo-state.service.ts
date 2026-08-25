import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import { stringOrEmpty } from '@common/utils/public-api';
import type {
  MnemoAdminPage,
  MnemoPrompt,
  MnemoQuestionStatus,
  MnemoQuizConfig,
  MnemoQuizMetadata,
} from '../../model/mnemo-quiz.model';

type ActionMeta = {
  actorId?: unknown;
  actor?: unknown;
};

export class ArcheMnemoStateService {
  normalizeStatus(value: unknown): MnemoQuestionStatus {
    const raw = stringOrEmpty(value).trim().toLowerCase();
    if (raw === 'validated') return 'validated';
    if (raw === 'to_edit') return 'to_edit';
    if (raw === 'trash') return 'trash';
    return 'pending';
  }

  statusLabel(value: unknown): string {
    const raw = stringOrEmpty(value).trim().toLowerCase();
    if (raw === 'all') return 'toutes';
    if (raw === 'validated') return 'validée';
    if (raw === 'pending') return 'en attente';
    if (raw === 'to_edit') return 'à modifier';
    if (raw === 'trash') return 'corbeille';
    return stringOrEmpty(value).trim() || raw || 'en attente';
  }

  buildConfigPrompt(config: MnemoQuizConfig): MnemoPrompt {
    return {
      type: 'config_prompt',
      title: 'Configuration - Arche de Mnémosyne',
      actionType: 'mnemo_set_config',
      cancelActionType: 'mnemo_prompt_cancel',
      fields: [
        { key: 'correctSoloPoints', label: 'Points accordés si un seul joueur répond correctement', kind: 'number', initialText: String(config?.correctSoloPoints ?? 2) },
        { key: 'correctMultiPoints', label: 'Points accordés par joueur en cas de bonnes réponses multiples', kind: 'number', initialText: String(config?.correctMultiPoints ?? 1) },
        { key: 'wrongPoints', label: 'Points appliqués en cas de mauvaise réponse', kind: 'number', initialText: String(config?.wrongPoints ?? 0) },
        { key: 'timeoutPoints', label: 'Points appliqués si le joueur ne répond pas à temps', kind: 'number', initialText: String(config?.timeoutPoints ?? -1) },
        { key: 'targetPoints', label: 'Score cible pour gagner la partie', kind: 'number', initialText: String(config?.targetPoints ?? 20) },
        { key: 'useTimer', label: 'Activer le chrono par question (oui/non)', kind: 'boolean', initialText: config?.useTimer ? 'oui' : 'non' },
        { key: 'timerSeconds', label: 'Durée du chrono par question (secondes)', kind: 'number', initialText: String(config?.timerSeconds ?? 30) },
        { key: 'interQuestionSeconds', label: 'Délai avant la question suivante (secondes)', kind: 'number', initialText: String(config?.interQuestionSeconds ?? 15) },
      ],
    };
  }

  clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) return this.clampInt(fallback, min, max, 0);
    const rounded = Math.round(candidate);
    if (rounded < min) return min;
    if (rounded > max) return max;
    return rounded;
  }

  compactQuestionLabel(value: string): string {
    const trimmed = stringOrEmpty(value).replace(/\s+/g, ' ').trim();
    if (trimmed.length <= 80) return trimmed;
    return trimmed.slice(0, 77) + '...';
  }

  isOwner(state: GameStateEntity, playerId: number | null): boolean {
    if (playerId == null) return false;
    const meta = this.getMeta(state);
    const ownerId = typeof meta?.ownerPlayerId === 'number' ? meta.ownerPlayerId : null;
    if (ownerId == null) return false;
    return ownerId === playerId;
  }

  canConfigure(state: GameStateEntity, actorId: number | null): boolean {
    if (actorId == null) return false;
    if (this.isOwner(state, actorId)) return true;
    if (String(state.phase ?? '').toLowerCase().trim() !== 'setup') return false;
    return state.turn?.currentPlayerId === actorId;
  }

  getMeta(state: GameStateEntity): MnemoQuizMetadata {
    const raw = this.asRecord(state.metadata);
    const rawAdminView = this.asRecord(raw.adminView);
    const adminView =
      typeof rawAdminView.page === 'string'
        ? (rawAdminView as unknown as MnemoAdminPage)
        : ({ page: 'setup' } as MnemoAdminPage);
    const rawConfig = this.asRecord(raw.config);
    const config =
      typeof rawConfig.targetPoints === 'number' &&
      typeof rawConfig.useTimer === 'boolean' &&
      typeof rawConfig.timerSeconds === 'number' &&
      typeof rawConfig.correctSoloPoints === 'number' &&
      typeof rawConfig.correctMultiPoints === 'number' &&
      typeof rawConfig.wrongPoints === 'number' &&
      typeof rawConfig.timeoutPoints === 'number'
        ? (rawConfig as unknown as MnemoQuizConfig)
        : ({
            targetPoints: 20,
            useTimer: true,
            timerSeconds: 30,
            interQuestionSeconds: 15,
            correctSoloPoints: 2,
            correctMultiPoints: 1,
            wrongPoints: 0,
            timeoutPoints: -1,
          } as MnemoQuizConfig);
    return { ...raw, adminView, config } as MnemoQuizMetadata;
  }

  asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  getActionMeta(action: GameSingleActionDto): ActionMeta {
    return this.asRecord(action.meta) as ActionMeta;
  }

  getActionActorId(action: GameSingleActionDto): number | null {
    const actorId = this.getActionMeta(action).actorId;
    return typeof actorId === 'number' && Number.isFinite(actorId) ? actorId : null;
  }

  getActionActorTag(action: GameSingleActionDto): string {
    return stringOrEmpty(this.getActionMeta(action).actor);
  }

  getPromptOwnerId(meta: MnemoQuizMetadata): number | null {
    const value = (meta as Record<string, unknown>).promptOwnerId;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  getInterQuestionUntilMs(meta: MnemoQuizMetadata): number | null {
    const value = (meta as Record<string, unknown>).interQuestionUntilMs;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  getQuizDeadlineAtMs(meta: MnemoQuizMetadata): number | null {
    const value = (meta as Record<string, unknown>).quizDeadlineAtMs;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  getQuizAnswers(meta: MnemoQuizMetadata): Record<number, number> {
    return (
      (this.asRecord(meta.quizAnswersByPlayerId) as Record<number, number>) ??
      {}
    );
  }
}
