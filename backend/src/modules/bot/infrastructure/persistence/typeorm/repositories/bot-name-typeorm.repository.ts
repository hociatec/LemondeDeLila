import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  BotNameRepository,
  CreateBotNameInput,
} from '../../../../application/ports/bot-name.repository';
import type { BotNameRecord } from '../../../../application/models/bot-name.record';
import { BotName } from '../entities/bot-name.entity';

@Injectable()
export class BotNameTypeormRepository implements BotNameRepository {
  constructor(
    @InjectRepository(BotName)
    private readonly botNames: Repository<BotName>,
  ) {}

  async listAll(): Promise<BotNameRecord[]> {
    const rows = await this.botNames.find({
      order: { name: 'ASC' },
      take: 500,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listEnabled(): Promise<BotNameRecord[]> {
    const rows = await this.botNames.find({
      where: { enabled: true },
      order: { name: 'ASC' },
      take: 500,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findById(id: number): Promise<BotNameRecord | null> {
    const row = await this.botNames.findOne({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByName(name: string): Promise<BotNameRecord | null> {
    const row = await this.botNames.findOne({ where: { name } });
    return row ? this.toRecord(row) : null;
  }

  async create(input: CreateBotNameInput): Promise<BotNameRecord> {
    const entity = this.botNames.create(input);
    const saved = await this.botNames.save(entity);
    return this.toRecord(saved);
  }

  async save(record: BotNameRecord): Promise<BotNameRecord> {
    const entity = this.botNames.create(record);
    const saved = await this.botNames.save(entity);
    return this.toRecord(saved);
  }

  async delete(id: number): Promise<void> {
    await this.botNames.delete(id);
  }

  count(): Promise<number> {
    return this.botNames.count();
  }

  private toRecord(entity: BotName): BotNameRecord {
    return {
      id: entity.id,
      name: entity.name,
      enabled: entity.enabled,
      createdAt: entity.createdAt,
    };
  }
}
