"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Auto1767479024162 = void 0;
class Auto1767479024162 {
    name = 'Auto1767479024162';
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` CHANGE `bio` `bio` VARCHAR(1000) NULL');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` CHANGE `bio` `bio` VARCHAR(500) NULL');
    }
}
exports.Auto1767479024162 = Auto1767479024162;
//# sourceMappingURL=1767479024162-auto.js.map