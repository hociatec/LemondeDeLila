import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ImportLegacySettingsJson1735900000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(_queryRunner: QueryRunner): Promise<void>;
}
