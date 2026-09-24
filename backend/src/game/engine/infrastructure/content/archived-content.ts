import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomicSync } from '../../../../platform/filesystem/public-api';

/** Archives belong to the catalog's durable storage and must be backed up with it. */
export function archivedContent(directory: string) {
  return {
    save(source: object): string {
      const serialized = JSON.stringify(source);
      const version = createHash('sha256').update(serialized).digest('hex');
      mkdirSync(directory, { recursive: true });
      const file = join(directory, `${version}.json`);
      if (!existsSync(file)) writeFileAtomicSync(file, serialized);
      return version;
    },
    load(version: string): object {
      if (!/^[a-f0-9]{64}$/.test(version))
        throw new Error('Invalid content version');
      const source = readFileSync(join(directory, `${version}.json`), 'utf8');
      if (createHash('sha256').update(source).digest('hex') !== version)
        throw new Error('Corrupt content archive');
      const parsed: unknown = JSON.parse(source);
      if (parsed === null || typeof parsed !== 'object')
        throw new Error('Content archive must contain an object');
      return parsed;
    },
  };
}
