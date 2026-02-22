"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddGameStats1735200000000 = void 0;
const typeorm_1 = require("typeorm");
class AddGameStats1735200000000 {
    name = 'AddGameStats1735200000000';
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'game_matches',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                {
                    name: 'room_id',
                    type: 'int',
                },
                {
                    name: 'game_type',
                    type: 'varchar',
                    length: '100',
                },
                {
                    name: 'with_bots',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'bots_count',
                    type: 'int',
                    default: 0,
                },
                {
                    name: 'humans_count',
                    type: 'int',
                    default: 0,
                },
                {
                    name: 'started_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'ended_at',
                    type: 'datetime',
                    isNullable: true,
                },
                {
                    name: 'ended_reason',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                },
                {
                    name: 'winner_user_id',
                    type: 'int',
                    isNullable: true,
                },
            ],
            indices: [
                new typeorm_1.TableIndex({
                    name: 'idx_game_matches_room',
                    columnNames: ['room_id'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_game_matches_game_type',
                    columnNames: ['game_type'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_game_matches_ended_at',
                    columnNames: ['ended_at'],
                }),
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['winner_user_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'SET NULL',
                }),
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'game_match_players',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                {
                    name: 'match_id',
                    type: 'int',
                },
                {
                    name: 'user_id',
                    type: 'int',
                },
                {
                    name: 'username',
                    type: 'varchar',
                    length: '80',
                },
                {
                    name: 'outcome',
                    type: 'varchar',
                    length: '20',
                    default: `'unknown'`,
                },
                {
                    name: 'left_at',
                    type: 'datetime',
                    isNullable: true,
                },
            ],
            uniques: [
                new typeorm_1.TableUnique({
                    name: 'uniq_game_match_player',
                    columnNames: ['match_id', 'user_id'],
                }),
            ],
            indices: [
                new typeorm_1.TableIndex({
                    name: 'idx_game_match_players_match',
                    columnNames: ['match_id'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_game_match_players_user',
                    columnNames: ['user_id'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_game_match_players_outcome',
                    columnNames: ['outcome'],
                }),
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['match_id'],
                    referencedTableName: 'game_matches',
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
    }
    async down(queryRunner) {
        await queryRunner.dropTable('game_match_players', true);
        await queryRunner.dropTable('game_matches', true);
    }
}
exports.AddGameStats1735200000000 = AddGameStats1735200000000;
//# sourceMappingURL=1735200000000-AddGameStats.js.map