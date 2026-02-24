type MirrorCategory = {
    id: string;
    name: string;
    parentId: string | null;
};
export declare class GameCategoriesFsMirrorService {
    private readonly logger;
    private readonly root;
    constructor();
    syncAll(input: {
        categories: MirrorCategory[];
        assignments: Record<string, string | null>;
    }): Promise<void>;
    deleteCategory(id: string): Promise<void>;
    private upsertCategory;
    private cleanupOrphans;
    private resolveDesiredFolder;
    private findFolderByCategoryId;
    private safeMoveFolder;
    private tryReadCategoryMeta;
    private safeFolderName;
    private replaceControlCharacters;
    private safeWriteJson;
    private safeWriteText;
    private static parseJson;
    private static getTrimmedString;
}
export {};
