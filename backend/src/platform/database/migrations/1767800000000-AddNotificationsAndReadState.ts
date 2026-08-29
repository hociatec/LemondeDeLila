import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsAndReadState1767800000000 implements MigrationInterface {
  name = 'AddNotificationsAndReadState1767800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`notification_inbox_items\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` int NOT NULL,
        \`kind\` varchar(50) NOT NULL,
        \`contact_id\` varchar(36) NULL,
        \`from_user_id\` int NULL,
        \`from_username\` varchar(100) NULL,
        \`to_user_id\` int NULL,
        \`message\` text NULL,
        \`payload\` json NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`read_at\` datetime NULL,
        \`deleted_at\` datetime NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_notification_inbox_user_created\` (\`user_id\`, \`created_at\`),
        KEY \`idx_notification_inbox_user_unread\` (\`user_id\`, \`read_at\`),
        KEY \`idx_notification_inbox_user_deleted\` (\`user_id\`, \`deleted_at\`),
        CONSTRAINT \`fk_notification_inbox_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      ALTER TABLE \`messaging_private_messages\`
      ADD COLUMN \`read_by_recipient_at\` datetime NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX \`idx_messaging_private_messages_recipient_unread\`
      ON \`messaging_private_messages\` (\`recipient_id\`, \`read_by_recipient_at\`, \`deleted_by_recipient_at\`);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_messaging_private_messages_recipient_unread\` ON \`messaging_private_messages\`;`,
    );
    await queryRunner.query(
      `ALTER TABLE \`messaging_private_messages\` DROP COLUMN \`read_by_recipient_at\`;`,
    );
    await queryRunner.query(`DROP TABLE \`notification_inbox_items\`;`);
  }
}
