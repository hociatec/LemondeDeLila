import {
  MigrationInterface,
  QueryRunner,
  TableForeignKey,
} from 'typeorm';

/**
 * User is a bounded context. Other contexts retain user_id as an optional
 * reference and must not make user deletion or schema deployment depend on
 * the users table. Referential cleanup is owned by each context.
 */
export class DecoupleUserForeignKeys1771000000000
  implements MigrationInterface
{
  name = 'DecoupleUserForeignKeys1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of await queryRunner.getTables()) {
      const userForeignKeys = table.foreignKeys.filter(
        (foreignKey) =>
          foreignKey.referencedTableName === 'users' ||
          foreignKey.referencedTableName === '`users`',
      );
      for (const foreignKey of userForeignKeys) {
        await queryRunner.dropForeignKey(table, foreignKey);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const references: Array<[string, string, 'CASCADE' | 'SET NULL']> = [
      ['chat_messages', 'user_id', 'CASCADE'],
      ['private_messages', 'sender_id', 'CASCADE'],
      ['private_messages', 'recipient_id', 'CASCADE'],
      ['rooms', 'owner_id', 'SET NULL'],
      ['room_participants', 'user_id', 'CASCADE'],
      ['social_relationships', 'user_id', 'CASCADE'],
      ['social_relationships', 'requester_id', 'CASCADE'],
      ['social_relationships', 'addressee_id', 'CASCADE'],
      ['game_matches', 'winner_user_id', 'SET NULL'],
      ['game_match_players', 'user_id', 'CASCADE'],
      ['notification_inbox_items', 'user_id', 'CASCADE'],
    ];

    for (const [tableName, columnName, onDelete] of references) {
      const table = await queryRunner.getTable(tableName);
      if (!table || table.foreignKeys.some((key) => key.columnNames.includes(columnName))) {
        continue;
      }
      await queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          name: `fk_${tableName}_${columnName}_users`,
          columnNames: [columnName],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete,
        }),
      );
    }
  }
}
