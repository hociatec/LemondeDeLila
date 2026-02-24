"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialProfileSettings1735700000000 = void 0;
const typeorm_1 = require("typeorm");
class SocialProfileSettings1735700000000 {
    name = 'SocialProfileSettings1735700000000';
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('social_profile_settings'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'social_profile_settings',
                columns: [
                    { name: 'id', type: 'tinyint', isPrimary: true },
                    { name: 'bio_min_length', type: 'int', default: 0 },
                    { name: 'bio_max_length', type: 'int', default: 500 },
                ],
            }), true);
        }
        const existing = (await queryRunner.query('SELECT id FROM social_profile_settings WHERE id = 1 LIMIT 1'));
        if (existing.length === 0) {
            await queryRunner.query('INSERT INTO social_profile_settings (id, bio_min_length, bio_max_length) VALUES (1, ?, ?)', [0, 500]);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('social_profile_settings', true);
    }
}
exports.SocialProfileSettings1735700000000 = SocialProfileSettings1735700000000;
//# sourceMappingURL=1735700000000-SocialProfileSettings.js.map