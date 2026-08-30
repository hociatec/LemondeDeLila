import { Injectable } from '@nestjs/common';
import {
  GameEngineService,
  GameRegistryService,
  type GameStateEntity,
} from '../../../../game/public-api';
import type { VaultGameState } from '../../application/contracts/vault-game-state.model';
import type { VaultGamePort } from '../../application/ports/vault-game.port';

@Injectable()
export class VaultGameAdapter implements VaultGamePort {
  constructor(
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
  ) {}

  async exportState(
    roomId: number,
    gameType: string,
  ): Promise<VaultGameState | null> {
    const state = await this.engine.exportInternalState(roomId, gameType);
    return state ? toVaultGameState(state) : null;
  }

  restoreState(
    roomId: number,
    gameType: string,
    state: VaultGameState,
  ): Promise<void> {
    if (!isGameStateEntity(state)) {
      throw new Error('État de jeu Vault invalide');
    }
    return this.engine.restoreInternalState(roomId, gameType, state);
  }

  getDisplayName(gameType: string): string | null {
    const name = String(
      this.registry.getHandler(gameType)?.displayName ?? '',
    ).trim();
    return name || null;
  }
}

function toVaultGameState(state: GameStateEntity): VaultGameState {
  return {
    ...structuredClone(state),
    status: state.status,
    metadata: state.metadata ? { ...state.metadata } : null,
    players: state.players?.map((player) => ({ ...player })),
    turn: state.turn ? { ...state.turn } : null,
  };
}

function isGameStateEntity(value: unknown): value is GameStateEntity {
  return (
    value != null &&
    typeof value === 'object' &&
    'status' in value &&
    typeof value.status === 'string' &&
    'phase' in value &&
    typeof value.phase === 'string' &&
    'log' in value &&
    Array.isArray(value.log)
  );
}
