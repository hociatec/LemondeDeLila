import type { GameStateEntity } from '../entities/game-state.entity';
import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';

export type PendingPawnChoiceAction = {
  playerId: number;
  options: any[];
  chosen: any;
  pending: any;
};

export function resolvePendingPawnChoiceAction(params: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  pendingType?: string;
  resolveChoice: (rawValue: unknown, options: any[]) => any;
}): PendingPawnChoiceAction | null {
  const pendingType =
    String(params.pendingType ?? '').trim() || 'choose_pawn';
  const pending = params.state?.pending as any;
  if (!pending || pending.type !== pendingType) return null;

  const playerIdRaw =
    typeof pending.playerId === 'number'
      ? pending.playerId
      : params.state?.turn?.currentPlayerId ?? null;
  if (typeof playerIdRaw !== 'number' || !Number.isFinite(playerIdRaw)) {
    return null;
  }

  const payload = (params.action?.payload ?? {}) as any;
  const rawChoice = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
  const options = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
  const chosen = params.resolveChoice(rawChoice, options);
  if (!chosen) return null;

  return {
    playerId: playerIdRaw,
    options,
    chosen,
    pending,
  };
}

