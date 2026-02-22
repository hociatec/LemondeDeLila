import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class UniqueRoomBotNamePerRoom1734900000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
