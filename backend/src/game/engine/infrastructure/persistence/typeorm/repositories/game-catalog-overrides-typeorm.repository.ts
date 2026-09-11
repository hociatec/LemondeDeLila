import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type {
  GameCatalogOverrideRecord,
  GameCatalogStatus,
} from '../../../../application/models/game-catalog-override.model';
import type { GameCatalogOverridesRepository } from '../../../../application/ports/game-catalog-overrides.repository';
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
    const result: { gameType: string; override: GameCatalogOverrideRecord }[] =
      [];
    const pageSize = 100;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.repo.find({
        where: cursor === undefined ? {} : { gameType: MoreThan(cursor) },
        order: { gameType: 'ASC' },
        take: pageSize,
      });
      result.push(
        ...rows.map((row) => ({
          gameType: row.gameType,
          override: toRecord(row),
        })),
      );
      if (rows.length < pageSize) return result;
      cursor = rows[rows.length - 1].gameType;
    }
  }
}

function compact(update: GameCatalogOverrideRecord): GameCatalogOverrideRecord {
  return Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined),
  );
}

function toRecord(row: GameCatalogOverrideEntity): GameCatalogOverrideRecord {
  return {
    enabled: row.enabled ?? undefined,
    minPlayers: row.minPlayers ?? undefined,
    maxPlayers: row.maxPlayers ?? undefined,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    rules: row.rules ?? undefined,
    status: toCatalogStatus(row.status),
    chatEnabled: row.chatEnabled ?? undefined,
    chatSoundsEnabled: row.chatSoundsEnabled ?? undefined,
  };
}

function toCatalogStatus(value: string | null): GameCatalogStatus | undefined {
  return value === 'construction' || value === 'beta' || value === 'finished'
    ? value
    : undefined;
}
