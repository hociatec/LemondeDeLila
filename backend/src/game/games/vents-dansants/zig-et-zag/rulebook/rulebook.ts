import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
import type {
  ZigEtZagMetadata,
  ZigEtZagRoundState,
} from '../model/zig-et-zag-state.entity';

function getMeta(state: GameStateEntity): ZigEtZagMetadata {
  return (state.metadata ?? {}) as ZigEtZagMetadata;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  if (getMeta(state).winnerId != null) return [];
  const round = getMeta(state).roundState;
  if (!round) return [];

  const waiting = waitingPlayerIds(round);
  if (!waiting.length || waiting[0] !== playerId) return [];
  const meta = getMeta(state);
  const actions: GameSingleActionDto[] = [];
  actions.push({ type: 'draw_card', payload: {} });
  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeLowerActionType(action);
  if (type !== 'draw_card') {
    throw new Error(`Action inconnue: ${action?.type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error('La partie n\'est pas démarrée.');
  }
  const meta = getMeta(state);
  if (meta.winnerId != null) {
    throw new Error('La partie est terminée.');
  }
  const round = meta.roundState;
  if (!round) {
    throw new Error("Ce n'est pas votre tour.");
  }
  const waiting = waitingPlayerIds(round);
  if (!waiting.length || waiting[0] !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  return {
    type: 'draw_card',
    payload: {},
  };
}

function waitingPlayerIds(round: ZigEtZagRoundState): number[] {
  return (round.waitingPlayers ?? [])
    .map((v: any) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })
    .filter((v: any): v is number => typeof v === 'number');
}



