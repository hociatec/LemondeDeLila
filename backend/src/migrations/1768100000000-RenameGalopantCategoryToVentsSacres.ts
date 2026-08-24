import type { QueryRunner } from 'typeorm';
import { MigrationInterface } from 'typeorm';

type CategoryRow = {
  id?: unknown;
  name?: unknown;
  parent_id?: unknown;
  enabled?: unknown;
};

function pickId(row: CategoryRow | undefined, key: keyof CategoryRow): string {
  const v = row?.[key];
  return typeof v === 'string' ? v : String(v ?? '');
}

export class RenameGalopantCategoryToVentsSacres1768100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('game_categories'))) return;

    const legacyId = 'galopant';
    const nextId = 'vents-sacres';

    const existingLegacy = (await queryRunner.query(
      'SELECT id, name, parent_id, enabled FROM game_categories WHERE id = ? LIMIT 1',
      [legacyId],
    )) as CategoryRow[];
    if (existingLegacy.length === 0) return;

    const existingNext = (await queryRunner.query(
      'SELECT id FROM game_categories WHERE id = ? LIMIT 1',
      [nextId],
    )) as CategoryRow[];
    if (existingNext.length > 0) return;

    const row = existingLegacy[0];
    const name = pickId(row, 'name');
    const parentIdRaw = pickId(row, 'parent_id');
    const parentId =
      parentIdRaw && parentIdRaw !== legacyId ? parentIdRaw : null;
    const enabled =
      typeof row?.enabled === 'boolean' ? row.enabled : row?.enabled !== 0;

    await queryRunner.query(
      'INSERT INTO game_categories (id, name, parent_id, enabled) VALUES (?, ?, ?, ?)',
      [nextId, name, parentId, enabled],
    );

    // Re-lier les enfants
    await queryRunner.query(
      'UPDATE game_categories SET parent_id = ? WHERE parent_id = ?',
      [nextId, legacyId],
    );

    if (await queryRunner.hasTable('game_category_assignments')) {
      await queryRunner.query(
        'UPDATE game_category_assignments SET category_id = ? WHERE category_id = ?',
        [nextId, legacyId],
      );
    }

    await queryRunner.query('DELETE FROM game_categories WHERE id = ?', [
      legacyId,
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('game_categories'))) return;

    const legacyId = 'galopant';
    const nextId = 'vents-sacres';

    const existingNext = (await queryRunner.query(
      'SELECT id, name, parent_id, enabled FROM game_categories WHERE id = ? LIMIT 1',
      [nextId],
    )) as CategoryRow[];
    if (existingNext.length === 0) return;

    const existingLegacy = (await queryRunner.query(
      'SELECT id FROM game_categories WHERE id = ? LIMIT 1',
      [legacyId],
    )) as CategoryRow[];
    if (existingLegacy.length > 0) return;

    const row = existingNext[0];
    const name = pickId(row, 'name');
    const parentIdRaw = pickId(row, 'parent_id');
    const parentId = parentIdRaw && parentIdRaw !== nextId ? parentIdRaw : null;
    const enabled =
      typeof row?.enabled === 'boolean' ? row.enabled : row?.enabled !== 0;

    await queryRunner.query(
      'INSERT INTO game_categories (id, name, parent_id, enabled) VALUES (?, ?, ?, ?)',
      [legacyId, name, parentId, enabled],
    );

    await queryRunner.query(
      'UPDATE game_categories SET parent_id = ? WHERE parent_id = ?',
      [legacyId, nextId],
    );

    if (await queryRunner.hasTable('game_category_assignments')) {
      await queryRunner.query(
        'UPDATE game_category_assignments SET category_id = ? WHERE category_id = ?',
        [legacyId, nextId],
      );
    }

    await queryRunner.query('DELETE FROM game_categories WHERE id = ?', [
      nextId,
    ]);
  }
}
