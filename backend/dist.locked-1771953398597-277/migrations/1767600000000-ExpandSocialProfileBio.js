"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpandSocialProfileBio1767600000000 = void 0;
class ExpandSocialProfileBio1767600000000 {
    name = 'ExpandSocialProfileBio1767600000000';
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` MODIFY `bio` LONGTEXT NULL');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` MODIFY `bio` VARCHAR(1000) NULL');
    }
}
exports.ExpandSocialProfileBio1767600000000 = ExpandSocialProfileBio1767600000000;
//# sourceMappingURL=1767600000000-ExpandSocialProfileBio.js.map