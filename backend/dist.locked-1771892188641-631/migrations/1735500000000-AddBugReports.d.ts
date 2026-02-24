import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddBugReports1735500000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
    private seedFromLegacyJson;
    private dataPath;
    private tryReadJson;
    private safeDate;
}
