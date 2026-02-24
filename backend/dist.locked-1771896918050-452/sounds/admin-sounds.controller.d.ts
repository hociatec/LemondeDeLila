import { SoundsService } from './sounds.service';
export declare class AdminSoundsController {
    private readonly sounds;
    constructor(sounds: SoundsService);
    cleanup(): Promise<{
        ok: true;
        deletedFiles: number;
        deletedDirs: number;
    }>;
    reencodeAll(): Promise<{
        ok: true;
        updated: number;
        skipped: number;
        missing: number;
        errors: number;
        details: {
            updated: string[];
            skipped: string[];
            missing: string[];
            errors: {
                soundId: string;
                message: string;
            }[];
        };
    }>;
    reencodeInvalid(): Promise<{
        ok: true;
        updated: number;
        skipped: number;
        missing: number;
        invalid: number;
        errors: number;
        details: {
            updated: string[];
            skipped: string[];
            missing: string[];
            invalid: string[];
            errors: {
                soundId: string;
                message: string;
            }[];
        };
    }>;
    diagnostic(): Promise<{
        ok: true;
        dataRoot: string;
        manifestPath: string;
        manifestUpdatedAt: string;
        total: number;
        missing: string[];
        sounds: {
            soundId: string;
            inManifest: boolean;
            sha256?: string | null;
            filePath?: string | null;
            exists: boolean;
            bytes?: number | null;
            url?: string | null;
            uploadedAt?: string | null;
        }[];
    }>;
    listTableAmbiences(): Promise<import("./sounds.types").TableAmbienceDefinitionsFile>;
    createTableAmbience(body: any): Promise<import("./sounds.types").TableAmbienceDefinition>;
    renameTableAmbience(soundId: string, body: any): Promise<import("./sounds.types").TableAmbienceDefinition>;
    deleteTableAmbience(soundId: string): Promise<{
        ok: true;
    }>;
    upload(soundId: string, file?: any): Promise<{
        ok: boolean;
        sound: import("./sounds.types").SoundManifestEntry;
    }>;
    clear(soundId: string): Promise<{
        ok: boolean;
    }>;
}
