import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_GAME_OVERRIDES_PORT,
  type AdminGameCatalogOverride,
  type AdminGameOverridesPort,
} from '../../ports/admin-game-overrides.port';
import type { UpdateAdminGameCommand } from './admin-games.types';

@Injectable()
export class AdminGameOverridesService {
  constructor(
    @Inject(ADMIN_GAME_OVERRIDES_PORT)
    private readonly overrides: AdminGameOverridesPort,
  ) {}

  async setEnabled(gameType: string, enabled: boolean) {
    await this.overrides.setEnabled(gameType, enabled);
  }

  async update(command: UpdateAdminGameCommand) {
    const update: AdminGameCatalogOverride = {};
    if (typeof command.enabled === 'boolean') update.enabled = command.enabled;
    if (typeof command.minPlayers === 'number') {
      update.minPlayers = command.minPlayers;
    }
    if (typeof command.maxPlayers === 'number') {
      update.maxPlayers = command.maxPlayers;
    }
    if (typeof command.name === 'string') update.name = command.name;
    if (typeof command.description === 'string') {
      update.description = command.description;
    }
    if (typeof command.rules === 'string') update.rules = command.rules;
    if (typeof command.status === 'string') update.status = command.status;
    if (typeof command.chatEnabled === 'boolean') {
      update.chatEnabled = command.chatEnabled;
    }
    if (typeof command.chatSoundsEnabled === 'boolean') {
      update.chatSoundsEnabled = command.chatSoundsEnabled;
    }

    await this.overrides.updateGameOverride(command.gameType, update);
  }

  async reset(gameType: string) {
    await this.overrides.clearGameOverride(gameType);
  }
}
