"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitSchema1734800000000 = void 0;
const typeorm_1 = require("typeorm");
class InitSchema1734800000000 {
    name = 'InitSchema1734800000000';
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'users',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                {
                    name: 'email',
                    type: 'varchar',
                    length: '180',
                    isUnique: true,
                },
                {
                    name: 'roles',
                    type: 'json',
                },
                {
                    name: 'password',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'username',
                    type: 'varchar',
                    length: '100',
                    isUnique: true,
                },
                {
                    name: 'avatar',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'preferences',
                    type: 'json',
                    isNullable: true,
                },
                {
                    name: 'email_verified',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'banned_until',
                    type: 'datetime',
                    isNullable: true,
                },
                {
                    name: 'ban_reason',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'chat_messages',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                {
                    name: 'user_id',
                    type: 'int',
                },
                {
                    name: 'message_id',
                    type: 'varchar',
                    length: '36',
                    isUnique: true,
                },
                {
                    name: 'message',
                    type: 'longtext',
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'deleted_at',
                    type: 'datetime',
                    isNullable: true,
                },
            ],
            indices: [
                new typeorm_1.TableIndex({
                    name: 'idx_chat_messages_created_at',
                    columnNames: ['created_at'],
                }),
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['user_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'messaging_private_messages',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                {
                    name: 'sender_id',
                    type: 'int',
                },
                {
                    name: 'recipient_id',
                    type: 'int',
                },
                {
                    name: 'message_id',
                    type: 'varchar',
                    length: '36',
                },
                {
                    name: 'message',
                    type: 'text',
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'deleted_by_sender_at',
                    type: 'datetime',
                    isNullable: true,
                },
                {
                    name: 'deleted_by_recipient_at',
                    type: 'datetime',
                    isNullable: true,
                },
            ],
            uniques: [
                {
                    name: 'uniq_messaging_private_messages_message_id',
                    columnNames: ['message_id'],
                },
            ],
            indices: [
                new typeorm_1.TableIndex({
                    name: 'idx_messaging_private_messages_created_at',
                    columnNames: ['created_at'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_messaging_private_messages_sender',
                    columnNames: ['sender_id'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_messaging_private_messages_recipient',
                    columnNames: ['recipient_id'],
                }),
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['sender_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
                new typeorm_1.TableForeignKey({
                    columnNames: ['recipient_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rooms',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                { name: 'name', type: 'varchar', length: '255' },
                { name: 'game_type', type: 'varchar', length: '100' },
                { name: 'max_players', type: 'int', default: '4' },
                { name: 'is_private', type: 'boolean', default: false },
                { name: 'status', type: 'varchar', length: '50', default: `'setup'` },
                { name: 'owner_id', type: 'int', isNullable: true },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
                { name: 'started_at', type: 'datetime', isNullable: true },
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['owner_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'SET NULL',
                }),
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'room_participants',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                { name: 'room_id', type: 'int' },
                { name: 'user_id', type: 'int' },
                { name: 'role', type: 'varchar', length: '20', default: `'player'` },
                { name: 'joined_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
                { name: 'left_at', type: 'datetime', isNullable: true },
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['room_id'],
                    referencedTableName: 'rooms',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
                new typeorm_1.TableForeignKey({
                    columnNames: ['user_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'room_bots',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                { name: 'room_id', type: 'int' },
                { name: 'name', type: 'varchar', length: '100' },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['room_id'],
                    referencedTableName: 'rooms',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'bot_names',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                { name: 'name', type: 'varchar', length: '150', isUnique: true },
                { name: 'enabled', type: 'boolean', default: true },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('bot_names', true);
        await queryRunner.dropTable('room_bots', true);
        await queryRunner.dropTable('room_participants', true);
        await queryRunner.dropTable('rooms', true);
        await queryRunner.dropTable('messaging_private_messages', true);
        await queryRunner.dropTable('chat_messages', true);
        await queryRunner.dropTable('users', true);
    }
}
exports.InitSchema1734800000000 = InitSchema1734800000000;
//# sourceMappingURL=1734800000000-InitSchema.js.map