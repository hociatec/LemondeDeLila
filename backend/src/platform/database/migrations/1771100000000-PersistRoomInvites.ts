import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PersistRoomInvites1771100000000 implements MigrationInterface {
  name = 'PersistRoomInvites1771100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`room_invites\` (
      \`id\` varchar(36) NOT NULL,
      \`room_id\` int NOT NULL,
      \`from_user_id\` int NOT NULL,
      \`to_user_id\` int NOT NULL,
      \`created_at\` datetime(6) NOT NULL,
      \`expires_at\` datetime(6) NOT NULL,
      \`consumed_at\` datetime(6) NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_room_invites_active\` (\`room_id\`, \`to_user_id\`, \`consumed_at\`, \`expires_at\`),
      KEY \`idx_room_invites_spectator\` (\`room_id\`, \`to_user_id\`, \`expires_at\`),
      CONSTRAINT \`fk_room_invites_room\` FOREIGN KEY (\`room_id\`) REFERENCES \`rooms\`(\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_room_invites_from_user\` FOREIGN KEY (\`from_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_room_invites_to_user\` FOREIGN KEY (\`to_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `room_invites`');
  }
}
