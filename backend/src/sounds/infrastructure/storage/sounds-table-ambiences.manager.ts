import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import {
  SOUND_KEYS,
  type SoundKey,
  type TableAmbienceDefinition,
  type TableAmbienceDefinitionsFile,
  type TableAmbienceSoundKey,
} from '../../application/models/sound-manifest.record';
import { toTableAmbienceDefinition } from './sounds-storage.utils';

type SoundsTableAmbiencesManagerDeps = {
  filePath: () => string;
  normalizeSoundKey: (input: string) => SoundKey;
  notifyUpdated: (updatedAt: string) => Promise<void>;
  clearSound: (soundId: SoundKey) => Promise<{ ok: true }>;
  storageIoError: (
    action: string,
    err: unknown,
  ) => InternalServerErrorException;
  now: () => string;
};

export class SoundsTableAmbiencesManager {
  constructor(private readonly deps: SoundsTableAmbiencesManagerDeps) {}

  async list(options?: {
    includeDisabled?: boolean;
  }): Promise<TableAmbienceDefinitionsFile> {
    const current = await this.read();
    if (options?.includeDisabled === true) {
      return current;
    }

    return {
      ...current,
      items: current.items.filter((item) => item.enabled !== false),
    };
  }

  async create(nameRaw: string): Promise<TableAmbienceDefinition> {
    const name = String(nameRaw ?? '').trim();
    if (!name) {
      throw new BadRequestException("Nom d'ambiance requis.");
    }

    const current = await this.read();
    const used = new Set(
      current.items.map((item) => item.soundId.toLowerCase()),
    );
    const available = (
      SOUND_KEYS.filter((key) =>
        /^TableAmbience\d+$/.test(key),
      ) as TableAmbienceSoundKey[]
    ).find((key) => !used.has(key.toLowerCase()));
    if (!available) {
      throw new BadRequestException(
        'Nombre maximum atteint (20 ambiances de table).',
      );
    }

    const created: TableAmbienceDefinition = {
      soundId: available,
      name,
      enabled: true,
    };
    await this.writeAndNotify({
      updatedAt: this.deps.now(),
      items: [...current.items, created],
    });
    return created;
  }

  async rename(
    soundIdRaw: string,
    nameRaw: string,
  ): Promise<TableAmbienceDefinition> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
    const name = String(nameRaw ?? '').trim();
    if (!name) {
      throw new BadRequestException("Nom d'ambiance requis.");
    }

    const current = await this.read();
    const index = current.items.findIndex(
      (item) => item.soundId.toLowerCase() === soundId.toLowerCase(),
    );
    if (index < 0) {
      throw new NotFoundException('Ambiance de table introuvable.');
    }

    const nextItems = [...current.items];
    nextItems[index] = {
      soundId,
      name,
      enabled: nextItems[index]?.enabled !== false,
    };
    await this.writeAndNotify({
      updatedAt: this.deps.now(),
      items: nextItems,
    });
    return nextItems[index];
  }

  async delete(soundIdRaw: string): Promise<{ ok: true }> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
    const current = await this.read();
    const next = {
      updatedAt: this.deps.now(),
      items: current.items.filter(
        (item) => item.soundId.toLowerCase() !== soundId.toLowerCase(),
      ),
    };
    await this.writeAndNotify(next);
    await this.deps.clearSound(soundId);
    return { ok: true };
  }

  async setEnabled(
    soundIdRaw: string,
    enabled: boolean,
  ): Promise<TableAmbienceDefinition> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
    const current = await this.read();
    const index = current.items.findIndex(
      (item) => item.soundId.toLowerCase() === soundId.toLowerCase(),
    );
    if (index < 0) {
      throw new NotFoundException('Ambiance de table introuvable.');
    }

    const nextItems = [...current.items];
    nextItems[index] = {
      ...nextItems[index],
      enabled: enabled === true,
    };
    await this.writeAndNotify({
      updatedAt: this.deps.now(),
      items: nextItems,
    });
    return nextItems[index];
  }

  private normalizeTableAmbienceKey(input: string): TableAmbienceSoundKey {
    const soundId = this.deps.normalizeSoundKey(input);
    if (!/^TableAmbience\d+$/i.test(soundId)) {
      throw new BadRequestException(`Ambiance de table invalide: ${soundId}`);
    }
    return soundId as TableAmbienceSoundKey;
  }

  private async read(): Promise<TableAmbienceDefinitionsFile> {
    const filePath = this.deps.filePath();
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''));
      const record = isRecord(parsed) ? parsed : {};
      const itemsRaw = Array.isArray(record.items) ? record.items : [];
      const items: TableAmbienceDefinition[] = itemsRaw
        .map((value) =>
          toTableAmbienceDefinition(value, (input) =>
            this.normalizeTableAmbienceKey(input),
          ),
        )
        .filter((item): item is TableAmbienceDefinition => item !== null);

      const seen = new Set<string>();
      const deduped: TableAmbienceDefinition[] = [];
      for (const item of items) {
        const key = item.soundId.toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        deduped.push(item);
      }

      return {
        updatedAt:
          typeof record.updatedAt === 'string' && record.updatedAt.trim()
            ? record.updatedAt
            : this.deps.now(),
        items: deduped,
      };
    } catch {
      return { updatedAt: this.deps.now(), items: [] };
    }
  }

  private async write(next: TableAmbienceDefinitionsFile): Promise<void> {
    try {
      await fs.promises.mkdir(
        this.deps.filePath().replace(/[\\/][^\\/]+$/, ''),
        { recursive: true },
      );
      await fs.promises.writeFile(
        this.deps.filePath(),
        JSON.stringify(next, null, 2),
        'utf-8',
      );
    } catch (err) {
      throw this.deps.storageIoError('écriture table-ambiences.json', err);
    }
  }

  private async writeAndNotify(
    next: TableAmbienceDefinitionsFile,
  ): Promise<void> {
    await this.write(next);
    await this.deps.notifyUpdated(next.updatedAt);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
