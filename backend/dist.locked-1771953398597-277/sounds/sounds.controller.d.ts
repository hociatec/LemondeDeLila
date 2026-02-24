import type { Request, Response } from 'express';
import { SoundsService } from './sounds.service';
export declare class SoundsController {
    private readonly sounds;
    constructor(sounds: SoundsService);
    manifest(req: Request): Promise<import("./sounds.types").SoundManifest>;
    tableAmbiences(): Promise<import("./sounds.types").TableAmbienceDefinitionsFile>;
    getSound(soundId: string, sha: string, res: Response): Promise<void>;
    getSoundWav(soundId: string, sha: string, res: Response): Promise<void>;
}
