import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GameCategoryAssignmentRecord } from '../../../../application/models/game-category-assignment.model';
import type { GameCategoryRecord } from '../../../../application/models/game-category.model';
import type { GameCategoriesRepository } from '../../../../application/ports/game-categories.repository';
import { GameCategoryAssignmentEntity } from '../entities/game-category-assignment.entity';
import { GameCategoryEntity } from '../entities/game-category.entity';

@Injectable()
export class GameCategoriesTypeormRepository implements GameCategoriesRepository {
  constructor(
    @InjectRepository(GameCategoryEntity)
    private readonly categoriesRepo: Repository<GameCategoryEntity>,
    @InjectRepository(GameCategoryAssignmentEntity)
    private readonly assignmentsRepo: Repository<GameCategoryAssignmentEntity>,
  ) {}

  async createCategory(input: {
    name: string;
    parentId: string | null;
  }): Promise<void> {
    const entity = this.categoriesRepo.create({
      name: input.name.trim(),
      parentId: input.parentId ?? null,
    });
    await this.categoriesRepo.save(entity);
  }

  async updateCategory(
    id: string,
    data: { name?: string; parentId?: string | null },
  ): Promise<void> {
    await this.categoriesRepo.update(
      { id },
      {
        ...(typeof data.name === 'string' ? { name: data.name.trim() } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      },
    );
  }

  async assignCategory(
    gameType: string,
    categoryId: string | null,
  ): Promise<void> {
    if (categoryId === null) {
      await this.assignmentsRepo.delete({ gameType });
      return;
    }

    const entity = this.assignmentsRepo.create({ gameType, categoryId });
    await this.assignmentsRepo.save(entity);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.assignmentsRepo.delete({ categoryId: id });
    await this.categoriesRepo.delete({ id });
  }

  async findAssignment(gameType: string): Promise<string | null | undefined> {
    const row = await this.assignmentsRepo.findOne({ where: { gameType } });
    return row?.categoryId;
  }

  async listCategories(): Promise<GameCategoryRecord[]> {
    const rows = await this.categoriesRepo.find({
      order: { name: 'ASC', id: 'ASC' },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
    }));
  }

  async listAssignments(): Promise<GameCategoryAssignmentRecord[]> {
    const rows = await this.assignmentsRepo.find({
      order: { gameType: 'ASC' },
      take: 500,
    });
    return rows.map((row) => ({
      gameType: row.gameType,
      categoryId: row.categoryId ?? null,
    }));
  }
}
