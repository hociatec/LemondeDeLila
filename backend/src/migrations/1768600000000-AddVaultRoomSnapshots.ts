import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVaultRoomSnapshots1768600000000 implements MigrationInterface {
  name = 'AddVaultRoomSnapshots1768600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vault_room_snapshots (
        id varchar(36) NOT NULL,
        owner_user_id int NOT NULL,
        name varchar(200) NOT NULL,
        game_type varchar(100) NOT NULL,
        room_name varchar(255) NOT NULL,
        players_label varchar(255) NOT NULL,
        snapshot_json longtext NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX idx_vault_room_snapshots_owner_created_at (owner_user_id, created_at)
      ) ENGINE=InnoDB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vault_room_snapshots`);
  }
}

