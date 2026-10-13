import type { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateUserShortcuts1791849700000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE user_shortcuts (user_id INT NOT NULL, revision INT NOT NULL DEFAULT 0, items JSON NOT NULL, PRIMARY KEY (user_id), CONSTRAINT fk_user_shortcuts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE user_shortcuts');
  }
}
