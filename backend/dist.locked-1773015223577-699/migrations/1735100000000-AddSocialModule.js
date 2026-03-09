"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddSocialModule1735100000000", {
    enumerable: true,
    get: function() {
        return AddSocialModule1735100000000;
    }
});
const _typeorm = require("typeorm");
let AddSocialModule1735100000000 = class AddSocialModule1735100000000 {
    async up(queryRunner) {
        await queryRunner.createTable(new _typeorm.Table({
            name: 'social_profiles',
            columns: [
                {
                    name: 'user_id',
                    type: 'int',
                    isPrimary: true
                },
                {
                    name: 'bio',
                    type: 'varchar',
                    length: '500',
                    isNullable: true
                },
                {
                    name: 'visibility',
                    type: 'varchar',
                    length: '20',
                    default: `'public'`
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'updated_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP'
                }
            ],
            foreignKeys: [
                new _typeorm.TableForeignKey({
                    columnNames: [
                        'user_id'
                    ],
                    referencedTableName: 'users',
                    referencedColumnNames: [
                        'id'
                    ],
                    onDelete: 'CASCADE'
                })
            ]
        }), true);
        await queryRunner.createTable(new _typeorm.Table({
            name: 'social_relationships',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'requester_id',
                    type: 'int'
                },
                {
                    name: 'addressee_id',
                    type: 'int'
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '20',
                    default: `'pending'`
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'updated_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP'
                }
            ],
            uniques: [
                new _typeorm.TableUnique({
                    name: 'uniq_social_relationship',
                    columnNames: [
                        'requester_id',
                        'addressee_id'
                    ]
                })
            ],
            indices: [
                new _typeorm.TableIndex({
                    name: 'idx_social_relationship_status',
                    columnNames: [
                        'status'
                    ]
                }),
                new _typeorm.TableIndex({
                    name: 'idx_social_relationship_requester',
                    columnNames: [
                        'requester_id'
                    ]
                }),
                new _typeorm.TableIndex({
                    name: 'idx_social_relationship_addressee',
                    columnNames: [
                        'addressee_id'
                    ]
                })
            ],
            foreignKeys: [
                new _typeorm.TableForeignKey({
                    columnNames: [
                        'requester_id'
                    ],
                    referencedTableName: 'users',
                    referencedColumnNames: [
                        'id'
                    ],
                    onDelete: 'CASCADE'
                }),
                new _typeorm.TableForeignKey({
                    columnNames: [
                        'addressee_id'
                    ],
                    referencedTableName: 'users',
                    referencedColumnNames: [
                        'id'
                    ],
                    onDelete: 'CASCADE'
                })
            ]
        }), true);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('social_relationships', true);
        await queryRunner.dropTable('social_profiles', true);
    }
    constructor(){
        this.name = 'AddSocialModule1735100000000';
    }
};
