import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

type LegacyBugReport = {
  id: string;
  subject: string;
  content: string;
  status: 'pending' | 'in_progress' | 'done';
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
  createdByUsername: string;
};

type LegacyBugReportsFile = {
  items?: LegacyBugReport[];
};

export class AddBugReports1735500000000 implements MigrationInterface {
  name = 'AddBugReports1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bug_reports'))) {
      await queryRunner.createTable(
        new Table({
          name: 'bug_reports',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'subject', type: 'varchar', length: '200' },
            { name: 'content', type: 'longtext' },
            { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
            { name: 'created_by_user_id', type: 'int' },
            { name: 'created_by_username', type: 'varchar', length: '100' },
          ],
          indices: [
            new TableIndex({
              name: 'idx_bug_reports_status',
              columnNames: ['status'],
            }),
            new TableIndex({
              name: 'idx_bug_reports_created_at',
              columnNames: ['created_at'],
            }),
          ],
        }),
        true,
      );
    }

    await this.seedFromLegacyJson(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bug_reports', true);
  }

  private async seedFromLegacyJson(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      'SELECT COUNT(*) as c FROM bug_reports',
    )) as Array<{ c: number | string }>;
    const count = Number(rows?.[0]?.c ?? 0);
    if (count > 0) return;

    const legacy = this.tryReadJson<LegacyBugReportsFile>(this.dataPath('bug-reports.json'));
    const items = Array.isArray(legacy?.items) ? legacy!.items! : [];
    if (items.length === 0) return;

    for (const r of items) {
      if (!r?.id || !r.subject || !r.content) continue;
      const status = r.status === 'in_progress' || r.status === 'done' ? r.status : 'pending';
      await queryRunner.query(
        `INSERT INTO bug_reports
          (id, subject, content, status, created_at, updated_at, created_by_user_id, created_by_username)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          r.subject,
          r.content,
          status,
          this.safeDate(r.createdAt),
          this.safeDate(r.updatedAt),
          Number(r.createdByUserId || 0),
          String(r.createdByUsername || 'admin'),
        ],
      );
    }
  }

  private dataPath(file: string): string {
    return path.resolve(process.cwd(), 'data', file);
  }

  private tryReadJson<T>(filePath: string): T | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private safeDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
}

