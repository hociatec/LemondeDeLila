import { DynamicModule } from '@nestjs/common';
export declare class GamePluginsModule {
    private static readonly logger;
    static forRoot(): DynamicModule;
    private static discoverGameModules;
    private static resolveGamesRoot;
    private static findModuleFiles;
    private static loadModuleClasses;
}
