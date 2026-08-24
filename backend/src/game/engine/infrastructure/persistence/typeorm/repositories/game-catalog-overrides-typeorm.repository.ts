import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GameCatalogOverrideRecord } from '../../../application/models/game-catalog-override.model';
import type { GameCatalogOverridesRepository } from '../../../application/ports/game-catalog-overrides.repository';
import { GameCatalogOverrideEntity } from '../entities/game-catalog-override.entity';

@Injectable()
export class GameCatalogOverridesTypeormRepository implements GameCatalogOverridesRepository {
  constructor(
    @InjectRepository(GameCatalogOverrideEntity)
    private readonly repo: Repository<GameCatalogOverrideEntity>,
  ) {}

  async findOne(gameType: string) {
    const row = await this.repo.findOne({ where: { gameType } });
    return row ? toRecord(row) : null;
  }

  async save(gameType: string, update: GameCatalogOverrideRecord) {
    const current = await this.repo.findOne({ where: { gameType } });
    const next = this.repo.create({
      gameType,
      ...(current ?? {}),
      ...compact(update),
    });
    const saved = await this.repo.save(next);
    return toRecord(saved);
  }

  async delete(gameType: string): Promise<void> {
    await this.repo.delete({ gameType });
  }

  async findAll() {
    const rows = await this.repo.find();
    return rows.map((row) => ({
      gameType: row.gameType,
      override: toRecord(row),
    }));
  }
}

function compact(update: GameCatalogOverrideRecord): GameCatalogOverrideRecord {
  const next: GameCatalogOverrideRecord = {};
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined) {
      next[key as keyof GameCatalogOverrideRecord] =
        value as GameCatalogOverrideRecord[keyof GameCatalogOverrideRecord];
    }
  }
  return next;
}

function toRecord(row: GameCatalogOverrideEntity): GameCatalogOverrideRecord {
  return {
    enabled: row.enabled ?? undefined,
    minPlayers: row.minPlayers ?? undefined,
    maxPlayers: row.maxPlayers ?? undefined,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    rules: row.rules ?? undefined,
    status: row.status ?? undefined,
    chatEnabled: row.chatEnabled ?? undefined,
    chatSoundsEnabled: row.chatSoundsEnabled ?? undefined,
  };
}
