import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class GameChatSoundsEnabledOverride1736200000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
