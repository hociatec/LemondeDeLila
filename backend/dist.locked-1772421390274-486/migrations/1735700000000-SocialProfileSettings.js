"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialProfileSettings1735700000000", {
    enumerable: true,
    get: function() {
        return SocialProfileSettings1735700000000;
    }
});
const _typeorm = require("typeorm");
let SocialProfileSettings1735700000000 = class SocialProfileSettings1735700000000 {
    async up(queryRunner) {
        if (!await queryRunner.hasTable('social_profile_settings')) {
            await queryRunner.createTable(new _typeorm.Table({
                name: 'social_profile_settings',
                columns: [
                    {
                        name: 'id',
                        type: 'tinyint',
                        isPrimary: true
                    },
                    {
                        name: 'bio_min_length',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'bio_max_length',
                        type: 'int',
                        default: 500
                    }
                ]
            }), true);
        }
        const existing = await queryRunner.query('SELECT id FROM social_profile_settings WHERE id = 1 LIMIT 1');
        if (existing.length === 0) {
            await queryRunner.query('INSERT INTO social_profile_settings (id, bio_min_length, bio_max_length) VALUES (1, ?, ?)', [
                0,
                500
            ]);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('social_profile_settings', true);
    }
    constructor(){
        this.name = 'SocialProfileSettings1735700000000';
    }
};
