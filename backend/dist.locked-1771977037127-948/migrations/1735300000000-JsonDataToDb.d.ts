import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class JsonDataToDb1735300000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
    private seedRoleDefinitions;
    private seedBotSettings;
    private seedGameCategoriesAndAssignments;
    private seedGameCatalogOverrides;
    private dataPath;
    private tryReadJson;
    private clampInt;
    private getDefaultRoleDefinitions;
}
