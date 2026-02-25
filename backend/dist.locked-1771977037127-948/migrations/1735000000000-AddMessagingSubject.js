"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMessagingSubject1735000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddMessagingSubject1735000000000 {
    name = 'AddMessagingSubject1735000000000';
    async up(queryRunner) {
        await queryRunner.addColumn('messaging_private_messages', new typeorm_1.TableColumn({
            name: 'subject',
            type: 'varchar',
            length: '200',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('messaging_private_messages', 'subject');
    }
}
exports.AddMessagingSubject1735000000000 = AddMessagingSubject1735000000000;
//# sourceMappingURL=1735000000000-AddMessagingSubject.js.map