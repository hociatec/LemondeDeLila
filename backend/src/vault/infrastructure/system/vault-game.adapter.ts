import { Injectable } from '@nestjs/common';
import {
  GameEngineService,
  GameRegistryService,
  type GameStateEntity,
} from '../../../game/public-api';
import type { VaultGameState } from '../../application/models/vault-game-state.model';
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
    return state as unknown as VaultGameState | null;
  }

  restoreState(
    roomId: number,
    gameType: string,
    state: VaultGameState,
  ): Promise<void> {
    return this.engine.restoreInternalState(
      roomId,
      gameType,
      state as unknown as GameStateEntity,
    );
  }

  getDisplayName(gameType: string): string | null {
    const name = String(
      this.registry.getHandler(gameType)?.displayName ?? '',
    ).trim();
    return name || null;
  }
}
