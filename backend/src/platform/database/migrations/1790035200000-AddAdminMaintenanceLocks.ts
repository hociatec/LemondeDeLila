import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminMaintenanceLocks1790035200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE admin_maintenance_locks (
        lock_name VARCHAR(32) NOT NULL PRIMARY KEY,
        owner_token CHAR(36) NOT NULL,
        operation VARCHAR(128) NOT NULL,
        started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const locks: unknown = await queryRunner.query(
      'SELECT lock_name FROM admin_maintenance_locks LIMIT 1',
    );
    if (!Array.isArray(locks) || locks.length > 0)
      throw new Error('Cannot remove maintenance locks while an owner exists');
    await queryRunner.query('DROP TABLE admin_maintenance_locks');
  }
}
