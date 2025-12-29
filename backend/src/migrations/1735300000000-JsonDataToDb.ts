import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

type RoleDefinition = {
  name: string;
  description: string;
  permissions: string[];
};

type BotSettingsFile = {
  botTurnDelayMs?: number;
};

type GameCategory = {
  id: string;
  name: string;
  parentId: string | null;
  enabled: boolean;
};

type CategoriesFile = {
  categories?: GameCategory[];
  assignments?: Record<string, string | null>;
};

type GameCatalogOverride = {
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
};

type OverridesFile = {
  games?: Record<string, GameCatalogOverride>;
};

export class JsonDataToDb1735300000000 implements MigrationInterface {
  name = 'JsonDataToDb1735300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('role_definitions'))) {
      await queryRunner.createTable(
        new Table({
          name: 'role_definitions',
          columns: [
            { name: 'name', type: 'varchar', length: '100', isPrimary: true },
            { name: 'description', type: 'varchar', length: '255' },
            { name: 'permissions', type: 'json' },
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('bot_settings'))) {
      await queryRunner.createTable(
        new Table({
          name: 'bot_settings',
          columns: [
            { name: 'id', type: 'tinyint', isPrimary: true },
            {
              name: 'bot_turn_delay_ms',
              type: 'int',
              default: 4000,
            },
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('game_categories'))) {
      await queryRunner.createTable(
        new Table({
          name: 'game_categories',
          columns: [
            { name: 'id', type: 'varchar', length: '120', isPrimary: true },
            { name: 'name', type: 'varchar', length: '200' },
            {
              name: 'parent_id',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            { name: 'enabled', type: 'boolean', default: true },
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('game_category_assignments'))) {
      await queryRunner.createTable(
        new Table({
          name: 'game_category_assignments',
          columns: [
            {
              name: 'game_type',
              type: 'varchar',
              length: '100',
              isPrimary: true,
            },
            {
              name: 'category_id',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
          ],
          indices: [
            new TableIndex({
              name: 'idx_game_category_assignments_category_id',
              columnNames: ['category_id'],
            }),
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('game_catalog_overrides'))) {
      await queryRunner.createTable(
        new Table({
          name: 'game_catalog_overrides',
          columns: [
            {
              name: 'game_type',
              type: 'varchar',
              length: '100',
              isPrimary: true,
            },
            { name: 'enabled', type: 'boolean', isNullable: true },
            { name: 'min_players', type: 'int', isNullable: true },
            { name: 'max_players', type: 'int', isNullable: true },
            { name: 'name', type: 'varchar', length: '255', isNullable: true },
            { name: 'description', type: 'text', isNullable: true },
          ],
        }),
        true,
      );
    }

    await this.seedRoleDefinitions(queryRunner);
    await this.seedBotSettings(queryRunner);
    await this.seedGameCategoriesAndAssignments(queryRunner);
    await this.seedGameCatalogOverrides(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('game_catalog_overrides', true);
    await queryRunner.dropTable('game_category_assignments', true);
    await queryRunner.dropTable('game_categories', true);
    await queryRunner.dropTable('bot_settings', true);
    await queryRunner.dropTable('role_definitions', true);
  }

  private async seedRoleDefinitions(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      'SELECT COUNT(*) as c FROM role_definitions',
    )) as Array<{ c: number | string }>;
    const count = Number(rows?.[0]?.c ?? 0);
    if (count > 0) return;

    const fromFile = this.tryReadJson<RoleDefinition[]>(
      this.dataPath('role-definitions.json'),
    );

    const definitions = Array.isArray(fromFile) && fromFile.length > 0
      ? fromFile
      : this.getDefaultRoleDefinitions();

    for (const def of definitions) {
      if (!def?.name || !def?.description) continue;
      await queryRunner.query(
        'INSERT INTO role_definitions (name, description, permissions) VALUES (?, ?, ?)',
        [def.name, def.description, JSON.stringify(def.permissions ?? [])],
      );
    }
  }

  private async seedBotSettings(queryRunner: QueryRunner): Promise<void> {
    const existing = (await queryRunner.query(
      'SELECT id FROM bot_settings WHERE id = 1 LIMIT 1',
    )) as Array<{ id: number }>;
    if (existing.length > 0) return;

    const fromFile = this.tryReadJson<BotSettingsFile>(
      this.dataPath('bot-settings.json'),
    );
    const candidate = typeof fromFile?.botTurnDelayMs === 'number'
      ? fromFile.botTurnDelayMs
      : 4000;
    const delay = this.clampInt(candidate, 0, 60000, 4000);

    await queryRunner.query(
      'INSERT INTO bot_settings (id, bot_turn_delay_ms) VALUES (1, ?)',
      [delay],
    );
  }

  private async seedGameCategoriesAndAssignments(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const rows = (await queryRunner.query(
      'SELECT COUNT(*) as c FROM game_categories',
    )) as Array<{ c: number | string }>;
    const count = Number(rows?.[0]?.c ?? 0);
    if (count > 0) return;

    const fromFile = this.tryReadJson<CategoriesFile>(
      this.dataPath('game-categories.json'),
    );
    const categories = Array.isArray(fromFile?.categories)
      ? fromFile.categories
      : [];
    const assignments =
      fromFile?.assignments && typeof fromFile.assignments === 'object'
        ? fromFile.assignments
        : {};

    const known = new Set<string>();
    for (const category of categories) {
      const id = typeof category?.id === 'string' ? category.id.trim() : '';
      const name = typeof category?.name === 'string' ? category.name.trim() : '';
      if (!id || !name) continue;
      known.add(id);
      const parentId =
        typeof category.parentId === 'string' && category.parentId.trim()
          ? category.parentId.trim()
          : null;
      const enabled = category.enabled !== false;
      await queryRunner.query(
        'INSERT INTO game_categories (id, name, parent_id, enabled) VALUES (?, ?, ?, ?)',
        [id, name, parentId, enabled],
      );
    }

    for (const [gameTypeRaw, categoryIdRaw] of Object.entries(assignments)) {
      const gameType = (gameTypeRaw ?? '').trim();
      if (!gameType) continue;
      const categoryId =
        typeof categoryIdRaw === 'string' && categoryIdRaw.trim()
          ? categoryIdRaw.trim()
          : null;
      const safeCategoryId = categoryId && known.has(categoryId) ? categoryId : null;
      await queryRunner.query(
        'INSERT INTO game_category_assignments (game_type, category_id) VALUES (?, ?)',
        [gameType, safeCategoryId],
      );
    }
  }

  private async seedGameCatalogOverrides(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      'SELECT COUNT(*) as c FROM game_catalog_overrides',
    )) as Array<{ c: number | string }>;
    const count = Number(rows?.[0]?.c ?? 0);
    if (count > 0) return;

    const fromFile = this.tryReadJson<OverridesFile>(
      this.dataPath('game-overrides.json'),
    );
    const games =
      fromFile?.games && typeof fromFile.games === 'object' ? fromFile.games : {};

    for (const [gameTypeRaw, ov] of Object.entries(games)) {
      const gameType = (gameTypeRaw ?? '').trim();
      if (!gameType) continue;
      await queryRunner.query(
        `INSERT INTO game_catalog_overrides
          (game_type, enabled, min_players, max_players, name, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          gameType,
          typeof ov?.enabled === 'boolean' ? ov.enabled : null,
          typeof ov?.minPlayers === 'number' ? Math.round(ov.minPlayers) : null,
          typeof ov?.maxPlayers === 'number' ? Math.round(ov.maxPlayers) : null,
          typeof ov?.name === 'string' && ov.name.trim() ? ov.name.trim() : null,
          typeof ov?.description === 'string' && ov.description.trim()
            ? ov.description
            : null,
        ],
      );
    }
  }

  private dataPath(filename: string): string {
    return path.resolve(process.cwd(), 'data', filename);
  }

  private tryReadJson<T>(filePath: string): T | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw.replace(/^\uFEFF/, '')) as T;
    } catch {
      return null;
    }
  }

  private clampInt(value: number, min: number, max: number, fallback: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) return fallback;
    const rounded = Math.round(candidate);
    if (rounded < min) return min;
    if (rounded > max) return max;
    return rounded;
  }

  private getDefaultRoleDefinitions(): RoleDefinition[] {
    return [
      {
        name: 'ROLE_USER',
        description: "Accès utilisateur standard, peut rejoindre et jouer aux parties.",
        permissions: ['game.play', 'game.history', 'chat.read'],
      },
      {
        name: 'ROLE_MODERATOR',
        description: 'Peut gérer les utilisateurs (ban/unban) et surveiller les parties.',
        permissions: ['game.play', 'game.history', 'chat.read', 'admin.users'],
      },
      {
        name: 'ROLE_ADMIN',
        description: 'Accès complet à l’administration, aux jeux et aux configurations.',
        permissions: ['admin.*', 'game.*', 'log.read'],
      },
    ];
  }
}

