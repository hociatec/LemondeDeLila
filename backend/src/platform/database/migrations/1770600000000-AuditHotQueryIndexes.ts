import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditHotQueryIndexes1770600000000 implements MigrationInterface {
  name = 'AuditHotQueryIndexes1770600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of INDEX_CREATIONS) await queryRunner.query(statement);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, index] of [...INDEX_OWNERSHIP].reverse()) {
      await queryRunner.query(`DROP INDEX \`${index}\` ON \`${table}\``);
    }
  }
}

const INDEX_OWNERSHIP = [
  [
    'messaging_private_messages',
    'idx_messaging_private_messages_sender_created',
  ],
  [
    'messaging_private_messages',
    'idx_messaging_private_messages_recipient_created',
  ],
  ['social_relationships', 'idx_social_relationship_requester_status_updated'],
  ['social_relationships', 'idx_social_relationship_addressee_status_updated'],
  ['room_participants', 'idx_room_participants_room_active_joined'],
  ['room_participants', 'idx_room_participants_user_active'],
  ['rooms', 'idx_rooms_lobby_status_privacy_created'],
  ['game_matches', 'idx_game_matches_room_ended'],
  ['game_matches', 'idx_game_matches_type_ended'],
  ['bug_report_comments', 'idx_bug_report_comments_report_created'],
  ['notification_inbox_items', 'idx_notification_inbox_user_deleted_created'],
] as const;

const INDEX_CREATIONS = [
  'CREATE INDEX `idx_messaging_private_messages_sender_created` ON `messaging_private_messages` (`sender_id`, `created_at`)',
  'CREATE INDEX `idx_messaging_private_messages_recipient_created` ON `messaging_private_messages` (`recipient_id`, `created_at`)',
  'CREATE INDEX `idx_social_relationship_requester_status_updated` ON `social_relationships` (`requester_id`, `status`, `updated_at`)',
  'CREATE INDEX `idx_social_relationship_addressee_status_updated` ON `social_relationships` (`addressee_id`, `status`, `updated_at`)',
  'CREATE INDEX `idx_room_participants_room_active_joined` ON `room_participants` (`room_id`, `left_at`, `joined_at`)',
  'CREATE INDEX `idx_room_participants_user_active` ON `room_participants` (`user_id`, `left_at`)',
  'CREATE INDEX `idx_rooms_lobby_status_privacy_created` ON `rooms` (`status`, `is_private`, `created_at`)',
  'CREATE INDEX `idx_game_matches_room_ended` ON `game_matches` (`room_id`, `ended_at`)',
  'CREATE INDEX `idx_game_matches_type_ended` ON `game_matches` (`game_type`, `ended_at`)',
  'CREATE INDEX `idx_bug_report_comments_report_created` ON `bug_report_comments` (`report_id`, `created_at`)',
  'CREATE INDEX `idx_notification_inbox_user_deleted_created` ON `notification_inbox_items` (`user_id`, `deleted_at`, `created_at`)',
] as const;
