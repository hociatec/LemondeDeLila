import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../models/game-state.model';

export type ExchangeTarget = { targetPlayerId: number; targetUsername: string };

export type InteractiveExchangePending =
  | {
      type: 'exchange';
      step: 'choose_target';
      blocking: true;
      label?: string | null;
      playerId: number;
      card: string;
      targets: ExchangeTarget[];
    }
  | {
      type: 'exchange';
      step: 'choose_give';
      blocking: true;
      label?: string | null;
      playerId: number;
      card: string;
      targetPlayerId: number;
      targetUsername: string;
      giveChoices: string[];
    }
  | {
      type: 'exchange';
      step: 'confirm';
      blocking: true;
      label?: string | null;
      playerId: number;
      initiatorPlayerId: number;
      initiatorUsername: string;
      targetPlayerId: number;
      targetUsername: string;
      give: string;
      take: string | null;
      targetHadCards: boolean;
      bonusRequested: boolean;
    };

export type InteractiveExchangeAdapter = {
  listTargets(state: GameStateEntity, playerId: number): ExchangeTarget[];
  getInventory(state: GameStateEntity, playerId: number): string[];
  removeFromInventory(
    state: GameStateEntity,
    playerId: number,
    card: string,
  ): GameStateEntity;
  addCardToPlayer(
    state: GameStateEntity,
    playerId: number,
    card: string,
  ): GameStateEntity;
  setSkipTurns?(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity;
};

export function defaultExchangeTargets(
  state: GameStateEntity,
  playerId: number,
): ExchangeTarget[] {
  const players = state.players ?? [];
  return players
    .filter((p) => p && p.id !== playerId)
    .map((p: PlayerStateEntity) => ({
      targetPlayerId: p.id,
      targetUsername: p.username ?? `Joueur ${p.id}`,
    }));
}

export function defaultGetInventory(
  state: GameStateEntity,
  playerId: number,
): string[] {
  const player = (state.players ?? []).find(
    (p): p is PlayerStateEntity => p.id === playerId,
  );
  return toStringArray(player?.inventory);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (v == null ? '' : String(v)))
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (v == null ? '' : String(v)))
          .filter((v) => v.length > 0);
      }
    } catch {
      /* ignore */
    }
    return value
      .split(/[,;]+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}
