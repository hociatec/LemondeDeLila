import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

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
            {
              name: 'status',
              type: 'varchar',
              length: '20',
              default: "'pending'",
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bug_reports', true);
  }

}
