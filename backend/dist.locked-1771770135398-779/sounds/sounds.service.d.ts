import { SoundManifest, SoundManifestEntry, TableAmbienceDefinition, TableAmbienceDefinitionsFile } from './sounds.types';
import { NotificationService } from '../notification/services/notification.service';
export declare class SoundsService {
    private readonly notifications;
    private readonly logger;
    constructor(notifications: NotificationService);
    private dataRoot;
    private getFfmpegPath;
    private getFfprobePath;
    private runProcess;
    private probeDurationSeconds;
    private detectSilence;
    private transcodeToStableWav;
    private removeUnusedFilesForSoundId;
    private manifestPath;
    private tableAmbiencesPath;
    private normalizeSoundKey;
    private normalizeTableAmbienceKey;
    private readManifest;
    private writeManifest;
    private readTableAmbiences;
    private writeTableAmbiences;
    listTableAmbiences(): Promise<TableAmbienceDefinitionsFile>;
    createTableAmbience(nameRaw: string): Promise<TableAmbienceDefinition>;
    renameTableAmbience(soundIdRaw: string, nameRaw: string): Promise<TableAmbienceDefinition>;
    deleteTableAmbience(soundIdRaw: string): Promise<{
        ok: true;
    }>;
    getPublicManifest(origin?: string | null): Promise<SoundManifest>;
    setSound(soundIdRaw: string, tempFilePath: string, originalName?: string): Promise<SoundManifestEntry>;
    clearSound(soundIdRaw: string): Promise<{
        ok: boolean;
    }>;
    reencodeAllSounds(): Promise<{
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
    private validateSoundFile;
    reencodeInvalidSounds(): Promise<{
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
    diagnoseSounds(): Promise<{
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
    cleanupUnusedSounds(): Promise<{
        ok: true;
        deletedFiles: number;
        deletedDirs: number;
    }>;
    resolveSoundFile(soundIdRaw: string, shaFromUrl?: string | null): Promise<{
        entry: SoundManifestEntry;
        filePath: string;
        ext: string;
    }>;
    ensureDirs(): Promise<void>;
}
