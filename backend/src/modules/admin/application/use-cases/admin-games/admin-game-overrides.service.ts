import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
    await this.overrides.setEnabled(normalizeGameType(gameType), enabled);
  }

  async update(command: UpdateAdminGameCommand) {
    const gameType = normalizeGameType(command.gameType);
    const update: AdminGameCatalogOverride = {};
    if (typeof command.enabled === 'boolean') update.enabled = command.enabled;
    if (typeof command.minPlayers === 'number') {
      update.minPlayers = normalizePlayerCount(command.minPlayers);
    }
    if (typeof command.maxPlayers === 'number') {
      update.maxPlayers = normalizePlayerCount(command.maxPlayers);
    }
    if (typeof command.name === 'string')
      update.name = normalizeText(command.name, 255);
    if (typeof command.description === 'string') {
      update.description = normalizeText(command.description, 255);
    }
    if (typeof command.rules === 'string')
      update.rules = normalizeText(command.rules, 4 * 1024 * 1024);
    if (
      command.status !== undefined &&
      !['construction', 'beta', 'finished'].includes(command.status)
    ) {
      throw new BadRequestException('Statut de jeu invalide.');
    }
    if (typeof command.status === 'string') update.status = command.status;
    if (typeof command.chatEnabled === 'boolean') {
      update.chatEnabled = command.chatEnabled;
    }
    if (typeof command.chatSoundsEnabled === 'boolean') {
      update.chatSoundsEnabled = command.chatSoundsEnabled;
    }

    await this.overrides.updateGameOverride(gameType, update);
  }

  async reset(gameType: string) {
    await this.overrides.clearGameOverride(normalizeGameType(gameType));
  }
}

function normalizeGameType(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 100) {
    throw new BadRequestException('Type de jeu invalide.');
  }
  return normalized;
}

function normalizePlayerCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 64) {
    throw new BadRequestException('Nombre de joueurs invalide.');
  }
  return value;
}

function normalizeText(value: string, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new BadRequestException('Contenu de catalogue trop volumineux.');
  }
  return normalized;
}
