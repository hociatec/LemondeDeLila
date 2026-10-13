import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserShortcutsEntity } from '../entities/user-shortcuts.entity';
import { UserShortcutsTypeormRepository } from './user-shortcuts-typeorm.repository';

describe('Shortcut persistence isolation', () => {
  async function setup(affected = 1) {
    const query = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected }),
    };
    const rows = {
      findOneBy: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => query),
    };
    const module = await Test.createTestingModule({
      providers: [
        UserShortcutsTypeormRepository,
        { provide: getRepositoryToken(UserShortcutsEntity), useValue: rows },
      ],
    }).compile();
    return {
      repository: module.get(UserShortcutsTypeormRepository),
      rows,
      query,
      module,
    };
  }

  it('returns empty preferences for a new user without reading another account', async () => {
    const { repository, rows, module } = await setup();
    try {
      expect(await repository.get(17)).toEqual({ revision: 0, items: [] });
      expect(rows.findOneBy).toHaveBeenCalledWith({ userId: 17 });
    } finally {
      await module.close();
    }
  });

  it('initializes without overwriting existing data and atomically matches owner and revision', async () => {
    const { repository, query, module } = await setup();
    try {
      expect(await repository.replace(17, 0, [])).toBe(true);
      expect(query.values).toHaveBeenCalledWith({
        userId: 17,
        revision: 0,
        items: [],
      });
      expect(query.orIgnore).toHaveBeenCalledTimes(1);
      expect(query.where).toHaveBeenCalledWith(
        'user_id = :userId AND revision = :revision',
        { userId: 17, revision: 0 },
      );
      expect(query.set).toHaveBeenCalledWith({ revision: 1, items: [] });
    } finally {
      await module.close();
    }
  });

  it('reports a stale revision instead of treating a skipped write as successful', async () => {
    const { repository, query, module } = await setup(0);
    try {
      expect(await repository.replace(17, 3, [])).toBe(false);
      expect(query.insert).not.toHaveBeenCalled();
      expect(query.where).toHaveBeenCalledWith(
        'user_id = :userId AND revision = :revision',
        { userId: 17, revision: 3 },
      );
    } finally {
      await module.close();
    }
  });
});
